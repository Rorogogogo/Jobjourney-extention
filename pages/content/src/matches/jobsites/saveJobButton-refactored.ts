// Refactored Save Job Button functionality for job detail pages
import { ButtonManager } from './button-manager';
import { ScraperFactory } from './scraper-factory';
import { ToastManager } from './toast-manager';
import type { JobData } from './types';

export {};

class SaveJobButton {
  private buttonManager = new ButtonManager();
  private currentJobData: JobData | null = null;
  private isAuthenticated = false;

  constructor() {
    this.init();
  }

  private async init() {
    console.log('🔵 SaveJobButton initialized for:', window.location.hostname);

    // Check authentication status
    await this.checkAuthStatus();

    // Start monitoring for job details
    this.startJobDetailMonitoring();
  }

  private async checkAuthStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_AUTH_STATUS',
      });

      this.isAuthenticated = response.success && response.data?.isAuthenticated;
      console.log('🔐 Auth status:', this.isAuthenticated);
    } catch (error) {
      console.warn('Failed to check auth status:', error);
      this.isAuthenticated = false;
    }
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

  private detectAndCreateButton() {
    // Always show the button, even when not authenticated
    const platform = ScraperFactory.detectPlatform();
    if (!platform) {
      console.log('SaveJobButton: Platform not detected:', window.location.hostname);
      return;
    }

    console.log('SaveJobButton: Detected platform:', platform);

    const scraper = ScraperFactory.createScraper(platform);
    if (!scraper) {
      console.log('SaveJobButton: Could not create scraper for platform:', platform);
      return;
    }

    const jobData = scraper.extractJobData();
    if (!jobData) {
      console.log('SaveJobButton: Could not extract job data for platform:', platform);
      return;
    }

    console.log('SaveJobButton: Extracted job data:', jobData);

    // Only create/update button if we have valid job data
    if (this.shouldCreateButton(jobData)) {
      console.log('SaveJobButton: Creating button for job:', jobData.title);
      this.createOrUpdateButton(jobData, scraper);
    } else {
      console.log('SaveJobButton: Button creation not needed (data unchanged)');
    }
  }

  private shouldCreateButton(jobData: JobData): boolean {
    // Don't create button if we don't have essential data
    if (!jobData.title || !jobData.company || !jobData.jobUrl) return false;

    // Don't create button if job data hasn't changed
    if (
      this.currentJobData &&
      this.currentJobData.title === jobData.title &&
      this.currentJobData.company === jobData.company &&
      this.currentJobData.jobUrl === jobData.jobUrl
    ) {
      return false;
    }

    return true;
  }

  private createOrUpdateButton(jobData: JobData, scraper: any) {
    // Remove existing button
    this.buttonManager.removeButton();

    // Update current job data
    this.currentJobData = jobData;

    // Find insertion point based on platform
    const insertionPoint = scraper.findInsertionPoint();
    if (!insertionPoint) {
      console.warn(`Could not find insertion point for ${jobData.platform}`);
      return;
    }

    // Create button container div
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'jobjourney-button-container';
    buttonContainer.style.cssText = `
      margin: 12px 0;
      display: flex;
      justify-content: flex-start;
      align-items: center;
    `;

    // Create button
    const button = this.buttonManager.createButton();

    // Add click handler
    this.buttonManager.addClickHandler(() => this.handleSaveJob());

    // Add button to container
    buttonContainer.appendChild(button);

    // Insert container below title
    insertionPoint.appendChild(buttonContainer);

    console.log('✅ Save in JJ button created for:', jobData.title);
  }

  private async handleSaveJob() {
    if (!this.currentJobData) return;

    // Check authentication first
    if (!this.isAuthenticated) {
      // Show toast asking user to sign in
      ToastManager.showToast('Please open JobJourney extension and sign in first', 'error');
      return;
    }

    // Show loading state
    this.buttonManager.setButtonLoading(true);

    try {
      // Prepare job data for API
      const jobData = {
        Name: this.currentJobData.title,
        CompanyName: this.currentJobData.company,
        Location: this.currentJobData.location,
        JobUrl: this.currentJobData.jobUrl,
        Description: this.currentJobData.description || '',
        RequiredSkills: this.currentJobData.requiredSkills || '',
        EmploymentTypes: this.currentJobData.employmentTypes || '',
        WorkArrangement: this.currentJobData.workArrangement || '',
        CompanyLogoUrl: this.currentJobData.companyLogoUrl || null,
        Status: 1, // Default to "Saved" status
        IsStarred: false,
        IsRPRequired: false,
      };

      // Send request to background script
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_JOB_MANUALLY',
        data: jobData,
      });

      if (response.success) {
        ToastManager.showToast('Job saved successfully to JobJourney!', 'success');
        this.buttonManager.setButtonSaved();
      } else {
        // Handle 401 or authentication errors
        if (response.error === 'User not authenticated' || response.error === 'Unauthorized - logged out') {
          this.isAuthenticated = false;
          ToastManager.showToast('Please open JobJourney extension and sign in first', 'error');
        } else {
          throw new Error(response.error || 'Failed to save job');
        }
      }
    } catch (error) {
      console.error('Error saving job:', error);
      ToastManager.showToast('Failed to save job. Please try again.', 'error');
      this.buttonManager.setButtonLoading(false);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new SaveJobButton();
  });
} else {
  new SaveJobButton();
}

console.log('🔵 SaveJobButton (refactored) script loaded');
