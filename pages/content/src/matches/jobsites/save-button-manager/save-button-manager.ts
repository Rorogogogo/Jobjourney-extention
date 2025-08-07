// Main Save Button Manager
import { ApiService } from './api-service';
import { AuthManager } from './auth-manager';
import { ButtonComponent } from './button-component';
import { InsertionPointFinder } from './insertion-point-finder';
import { JobDataExtractor } from './job-data-extractor';
import { PlatformDetector } from './platform-detector';
import { detectPRRequirement } from './pr-detection';
import { ToastService } from './toast-service';
import type { JobData, Platform, SaveButtonManager as ISaveButtonManager, PRDetectionResult } from './types';

export class SaveButtonManager implements ISaveButtonManager {
  private button: HTMLElement | null = null;
  private currentJobData: JobData | null = null;
  private currentPRDetection: PRDetectionResult | null = null;
  private currentUrl: string = '';
  private currentJobId: string = '';

  constructor() {
    this.init();
  }

  async init(): Promise<void> {
    // Check authentication status
    await AuthManager.checkAuthStatus();

    // Start monitoring for job details
    this.startJobDetailMonitoring();
  }

  private startJobDetailMonitoring() {
    // Store initial URL and job ID
    this.currentUrl = window.location.href;
    this.currentJobId = this.extractJobId();

    // Initial check
    this.detectAndCreateButton();

    // Monitor for DOM changes (when user navigates to different jobs)
    const observer = new MutationObserver(() => {
      this.detectAndCreateButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Check for URL changes more frequently for LinkedIn
    const isLinkedIn = window.location.hostname.includes('linkedin.com');
    const urlCheckInterval = isLinkedIn ? 500 : 3000; // 500ms for LinkedIn, 3s for others

    setInterval(() => {
      const newUrl = window.location.href;
      const newJobId = this.extractJobId();

      // If URL or job ID changed, force re-detection
      if (newUrl !== this.currentUrl || newJobId !== this.currentJobId) {
        this.currentUrl = newUrl;
        this.currentJobId = newJobId;

        // Force re-detection by clearing current data
        this.currentJobData = null;
        this.currentPRDetection = null;

        this.detectAndCreateButton();
      } else {
        // Regular detection for dynamic content
        this.detectAndCreateButton();
      }
    }, urlCheckInterval);
  }

  detectAndCreateButton(): void {
    // Always show the button, even when not authenticated
    const platform = PlatformDetector.getCurrentPlatform();
    if (!platform) {
      return;
    }

    const jobData = JobDataExtractor.extractJobData(platform);
    if (!jobData) {
      return;
    }

    // Only create/update button if we have valid job data
    if (this.shouldCreateButton(jobData)) {
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

  private createOrUpdateButton(jobData: JobData, platform: Platform) {
    // Remove existing button
    this.removeButton();

    // Update current job data
    this.currentJobData = jobData;

    // Run PR detection if we have substantial job description content
    if (jobData.description && jobData.description.length > 100) {
      this.currentPRDetection = detectPRRequirement(jobData.description);
    } else {
      // Show "detecting" state and start retry mechanism
      this.currentPRDetection = {
        isRPRequired: false,
        confidence: 'low',
        matchedPatterns: [],
        reasoning: 'Detecting PR requirements...',
      };
      // Start retry mechanism
      this.retryPRDetectionWithDelay(platform);
    }

    // Find insertion point based on platform
    const insertionPoint = InsertionPointFinder.findInsertionPoint(platform);
    if (!insertionPoint) {
      console.warn(`Could not find insertion point for ${platform}`);
      return;
    }

    // Create button container div
    const buttonContainer = ButtonComponent.createButtonContainer();

    // Create button with PR detection badge
    this.button = ButtonComponent.createButton(this.currentPRDetection || undefined);

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

  private async handleSaveJob(platform: Platform) {
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
    if (url.includes('linkedin.com')) {
      // Handle both direct job URLs and collections with currentJobId
      const jobIdMatch = url.match(/\/jobs\/view\/(\d+)/) || url.match(/currentJobId=(\d+)/);
      return jobIdMatch ? jobIdMatch[1] : '';
    }

    // Indeed job ID extraction
    if (url.includes('indeed.com')) {
      const jobIdMatch = url.match(/\/viewjob\?jk=([^&]+)/);
      return jobIdMatch ? jobIdMatch[1] : '';
    }

    // SEEK job ID extraction
    if (url.includes('seek.com')) {
      const jobIdMatch = url.match(/\/job\/(\d+)/);
      return jobIdMatch ? jobIdMatch[1] : '';
    }

    // Reed job ID extraction
    if (url.includes('reed.co.uk')) {
      const jobIdMatch = url.match(/\/jobs\/([^\/]+)/);
      return jobIdMatch ? jobIdMatch[1] : '';
    }

    // For other platforms, use full URL as identifier
    return url;
  }

  private retryPRDetectionWithDelay(platform: Platform, retryCount: number = 0): void {
    if (retryCount >= 3) {
      return;
    }

    setTimeout(
      () => {
        if (!this.currentJobData) return;

        // Re-extract job data to get fresh description
        const freshJobData = JobDataExtractor.extractJobData(platform);
        if (!freshJobData) return;

        // Check if description is now available and substantial
        if (freshJobData.description && freshJobData.description.length > 100) {
          // Update current job data
          this.currentJobData = freshJobData;

          // Re-run PR detection with fresh description
          const newPRDetection = detectPRRequirement(freshJobData.description);

          // Update badge with real detection result
          this.currentPRDetection = newPRDetection;
          this.updateButtonBadge();
        } else {
          // Try again with longer delay
          this.retryPRDetectionWithDelay(platform, retryCount + 1);
        }
      },
      1000 + retryCount * 1000,
    ); // 1s, 2s, 3s delays
  }

  private updateButtonBadge(): void {
    if (!this.button) return;

    // Find insertion point to get platform info
    const platform = PlatformDetector.getCurrentPlatform();
    if (!platform) return;

    // Create new button with updated badge
    const newButton = ButtonComponent.createButton(this.currentPRDetection || undefined);

    // Copy event listeners from old button
    newButton.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      this.handleSaveJob(platform);
    });

    // Replace the button content
    if (this.button.parentElement) {
      this.button.parentElement.replaceChild(newButton, this.button);
      this.button = newButton;
    }
  }
}
