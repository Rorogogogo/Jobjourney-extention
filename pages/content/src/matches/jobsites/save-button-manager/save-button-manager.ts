// Main Save Button Manager
import type { JobData, Platform, SaveButtonManager as ISaveButtonManager } from './types';
import { PlatformDetector } from './platform-detector';
import { JobDataExtractor } from './job-data-extractor';
import { InsertionPointFinder } from './insertion-point-finder';
import { ButtonComponent } from './button-component';
import { AuthManager } from './auth-manager';
import { ApiService } from './api-service';
import { ToastService } from './toast-service';

export class SaveButtonManager implements ISaveButtonManager {
  private button: HTMLElement | null = null;
  private currentJobData: JobData | null = null;

  constructor() {
    this.init();
  }

  async init(): Promise<void> {
    console.log('🔵 SaveButtonManager initialized for:', window.location.hostname);

    // Check authentication status
    await AuthManager.checkAuthStatus();

    // Start monitoring for job details
    this.startJobDetailMonitoring();
  }

  private startJobDetailMonitoring() {
    // Initial check
    this.detectAndCreateButton();

    // Monitor for changes (when user navigates to different jobs)
    const observer = new MutationObserver(() => {
      this.detectAndCreateButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also check periodically for dynamic content
    setInterval(() => {
      this.detectAndCreateButton();
    }, 3000);
  }

  detectAndCreateButton(): void {
    // Always show the button, even when not authenticated
    const platform = PlatformDetector.getCurrentPlatform();
    if (!platform) {
      console.log('SaveButtonManager: Platform not detected:', window.location.hostname);
      return;
    }

    console.log('SaveButtonManager: Detected platform:', platform);

    const jobData = JobDataExtractor.extractJobData(platform);
    if (!jobData) {
      console.log('SaveButtonManager: Could not extract job data for platform:', platform);
      return;
    }

    console.log('SaveButtonManager: Extracted job data:', jobData);

    // Only create/update button if we have valid job data
    if (this.shouldCreateButton(jobData)) {
      console.log('SaveButtonManager: Creating button for job:', jobData.title);
      this.createOrUpdateButton(jobData, platform);
    } else {
      console.log('SaveButtonManager: Button creation not needed (data unchanged)');
    }
  }

  private shouldCreateButton(jobData: JobData): boolean {
    // Don't create button if we don't have essential data
    // Location is optional for some platforms like Westpac where it might be extracted differently
    if (!jobData.title || !jobData.company || !jobData.jobUrl) {
      console.log('SaveButtonManager: Missing essential data', { 
        title: jobData.title, 
        company: jobData.company, 
        jobUrl: jobData.jobUrl 
      });
      return false;
    }

    // Check if button already exists in DOM
    const existingButton = document.getElementById('jobjourney-button-container');
    if (existingButton) {
      console.log('SaveButtonManager: Button already exists in DOM');
      return false;
    }

    // Don't create button if job data hasn't changed
    if (
      this.currentJobData &&
      this.currentJobData.title === jobData.title &&
      this.currentJobData.company === jobData.company &&
      this.currentJobData.jobUrl === jobData.jobUrl
    ) {
      console.log('SaveButtonManager: Job data unchanged, skipping button creation');
      return false;
    }

    return true;
  }

  private createOrUpdateButton(jobData: JobData, platform: Platform) {
    // Remove existing button
    this.removeButton();

    // Update current job data
    this.currentJobData = jobData;

    // Find insertion point based on platform
    const insertionPoint = InsertionPointFinder.findInsertionPoint(platform);
    if (!insertionPoint) {
      console.warn(`Could not find insertion point for ${platform}`);
      return;
    }

    // Create button container div
    const buttonContainer = ButtonComponent.createButtonContainer();

    // Create button
    this.button = ButtonComponent.createButton();

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

    console.log('✅ Save in JJ button created for:', jobData.title);
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
}