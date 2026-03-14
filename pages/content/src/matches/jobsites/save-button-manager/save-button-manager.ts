// Main Save Button Manager
import type { JobData, PlatformId, PrDetectionResult } from '@extension/types';
import { ApiService } from './api-service';
import { AuthManager } from './auth-manager';
import { ButtonComponent } from './button-component';
import { InsertionPointFinder } from './insertion-point-finder';
import { JobDataExtractor } from './job-data-extractor';
import { PlatformDetector } from './platform-detector';
import { ToastService } from './toast-service';

export interface ISaveButtonManager {
  init(): Promise<void>;
  detectAndCreateButton(): void;
  removeButton(): void;
}

export class SaveButtonManager implements ISaveButtonManager {
  private button: HTMLElement | null = null;
  private currentJobData: JobData | null = null;
  private currentPRDetection: PrDetectionResult | null = null;
  private currentUrl: string = '';
  private currentJobId: string = '';
  constructor() {
    this.init();
  }

  async init(): Promise<void> {
    // Start monitoring immediately — don't wait for auth check
    // Auth is only needed when saving, not for showing the button
    this.startJobDetailMonitoring();

    // Check authentication status in parallel
    AuthManager.checkAuthStatus();
  }

  private startJobDetailMonitoring() {
    // Store initial URL and job ID
    this.currentUrl = window.location.href;
    this.currentJobId = this.extractJobId();

    // Initial check
    this.detectAndCreateButton();

    // Monitor for DOM changes (when user navigates to different jobs)
    // This provides instant detection when SPA frameworks update the page
    const observer = new MutationObserver(() => {
      const existingButton = document.getElementById('jobjourney-button-container');
      if (!existingButton) {
        // Button missing — either never created or removed by SPA re-render
        this.detectAndCreateButton();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also poll for URL/job ID changes (MutationObserver doesn't catch URL changes)
    const isLinkedIn =
      window.location.hostname === 'linkedin.com' || window.location.hostname.endsWith('.linkedin.com');
    const urlCheckInterval = isLinkedIn ? 500 : 3000;

    setInterval(() => {
      const newUrl = window.location.href;
      const newJobId = this.extractJobId();

      if (newUrl !== this.currentUrl || newJobId !== this.currentJobId) {
        this.currentUrl = newUrl;
        this.currentJobId = newJobId;

        // New job — clear state and remove old button
        this.currentJobData = null;
        this.currentPRDetection = null;
        this.removeButton();
      }

      // Always try to create button if missing (handles SPA navigations,
      // collection page switches, and any case where the button disappeared)
      const btnExists = !!document.getElementById('jobjourney-button-container');
      if (!btnExists && window.location.pathname.startsWith('/jobs')) {
        console.log('[JJ Debug] Polling: button missing on jobs page, attempting detection...');
        this.detectAndCreateButton();
      }
    }, urlCheckInterval);
  }

  detectAndCreateButton(): void {
    // Always show the button, even when not authenticated
    const platform = PlatformDetector.getCurrentPlatform();
    if (!platform) {
      console.log('[JJ Debug] No platform detected, URL:', window.location.href);
      return;
    }

    const jobData = JobDataExtractor.extractJobData(platform);
    if (!jobData) {
      console.log('[JJ Debug] No job data extracted for platform:', platform, 'URL:', window.location.pathname);
      return;
    }

    // Only create/update button if we have valid job data
    if (this.shouldCreateButton(jobData)) {
      console.log('[JJ Debug] Creating button for:', jobData.title, 'at', jobData.jobUrl);
      this.createOrUpdateButton(jobData, platform);
    }
  }

  private shouldCreateButton(jobData: JobData): boolean {
    // Don't create button if we don't have essential data
    // Location is optional for some platforms like Westpac where it might be extracted differently
    if (!jobData.title || !jobData.company || !jobData.jobUrl) {
      return false;
    }

    // Check if button already exists in DOM and job data hasn't changed
    const existingButton = document.getElementById('jobjourney-button-container');
    if (existingButton && this.currentJobData) {
      // Only skip if job data is exactly the same
      if (
        this.currentJobData.title === jobData.title &&
        this.currentJobData.company === jobData.company &&
        this.currentJobData.jobUrl === jobData.jobUrl &&
        // Also check description length to detect when content loads
        (this.currentJobData.description?.length || 0) === (jobData.description?.length || 0)
      ) {
        return false;
      }
    }

    return true;
  }

  private createOrUpdateButton(jobData: JobData, platform: PlatformId) {
    // Remove existing button
    this.removeButton();

    // Update current job data
    this.currentJobData = jobData;

    // Get PR detection from job analysis (already performed during extraction)
    // If analysis exists and has PR detection, use it; otherwise create a default one
    if (jobData.analysis?.prDetection) {
      this.currentPRDetection = {
        isRPRequired: jobData.analysis.prDetection.isRPRequired,
        confidence: jobData.analysis.prDetection.confidence,
        matchedPatterns: jobData.analysis.prDetection.matchedPatterns,
        reasoning: jobData.analysis.prDetection.reasoning,
      };
    } else {
      // Fallback if no analysis available (shouldn't normally happen)
      this.currentPRDetection = {
        isRPRequired: false,
        confidence: 'low',
        matchedPatterns: [],
        reasoning: 'No analysis available',
      };
    }

    // Find insertion point based on platform
    const insertionPoint = InsertionPointFinder.findInsertionPoint(platform);
    if (!insertionPoint) {
      console.warn(`Could not find insertion point for ${platform}`);
      return;
    }

    // Create button container div (now includes icon)
    const buttonContainer = ButtonComponent.createButtonContainer();

    // Create badges (including PR status and applied status)
    const appliedStatus = this.currentJobData.isAlreadyApplied
      ? { isApplied: true, appliedDateUtc: this.currentJobData.appliedDateUtc ?? undefined }
      : undefined;
    const badges = ButtonComponent.createBadges(
      this.currentJobData.analysis,
      this.currentPRDetection || undefined,
      appliedStatus,
    );
    buttonContainer.appendChild(badges);

    // Company link buttons
    if (this.currentJobData.company) {
      buttonContainer.appendChild(ButtonComponent.createCompanyLinks(this.currentJobData.company));
    }

    // Create button (no PR badge on it anymore)
    this.button = ButtonComponent.createButton(undefined);

    // Add click handler
    this.button.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      this.handleSaveJob(platform);
    });

    // Add button to container
    buttonContainer.appendChild(this.button);

    // Insert container below title
    insertionPoint.appendChild(buttonContainer);
  }

  private async handleSaveJob(platform: PlatformId) {
    if (!this.currentJobData || !this.button) return;

    // Check authentication first
    if (!AuthManager.getAuthStatus()) {
      // Show toast asking user to sign in
      ToastService.showToast('Please open JobJourney extension and sign in first', 'error');
      return;
    }

    // Show loading state
    ButtonComponent.setLoadingState(this.button, true);

    try {
      const response = await ApiService.saveJob(this.currentJobData, platform);

      if (response.success) {
        ToastService.showToast('Job saved successfully to JobJourney!', 'success');
        ButtonComponent.setSavedState(this.button);
      } else {
        // Handle 401 or authentication errors
        if (response.error === 'User not authenticated' || response.error === 'Unauthorized - logged out') {
          AuthManager.setAuthStatus(false);
          ToastService.showToast('Please open JobJourney extension and sign in first', 'error');
        } else {
          throw new Error(response.error || 'Failed to save job');
        }
      }
    } catch (error) {
      console.error('Error saving job:', error);
      ToastService.showToast('Failed to save job. Please try again.', 'error');
      ButtonComponent.setLoadingState(this.button, false);
    }
  }

  removeButton(): void {
    // Remove the container (which contains the button)
    const container = document.getElementById('jobjourney-button-container');
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }

    // Also remove the button directly if it exists elsewhere
    if (this.button && this.button.parentNode) {
      this.button.parentNode.removeChild(this.button);
    }

    this.button = null;
  }

  private extractJobId(): string {
    const url = window.location.href;

    // LinkedIn job ID extraction
    const hostname = window.location.hostname;
    if (hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')) {
      // Handle both direct job URLs and collections with currentJobId
      const jobIdMatch = url.match(/\/jobs\/view\/(\d+)/) || url.match(/currentJobId=(\d+)/);
      return jobIdMatch ? jobIdMatch[1] : '';
    }

    // Indeed job ID extraction
    if (hostname === 'indeed.com' || hostname.endsWith('.indeed.com')) {
      const jobIdMatch = url.match(/\/viewjob\?jk=([^&]+)/);
      return jobIdMatch ? jobIdMatch[1] : '';
    }

    // SEEK job ID extraction
    if (
      hostname === 'seek.com.au' ||
      hostname === 'seek.co.nz' ||
      hostname.endsWith('.seek.com.au') ||
      hostname.endsWith('.seek.co.nz')
    ) {
      const jobIdMatch = url.match(/\/job\/(\d+)/);
      return jobIdMatch ? jobIdMatch[1] : '';
    }

    // Reed job ID extraction
    if (hostname === 'reed.co.uk' || hostname.endsWith('.reed.co.uk')) {
      const jobIdMatch = url.match(/\/jobs\/([^\/]+)/);
      return jobIdMatch ? jobIdMatch[1] : '';
    }

    // For other platforms, use full URL as identifier
    return url;
  }
}
