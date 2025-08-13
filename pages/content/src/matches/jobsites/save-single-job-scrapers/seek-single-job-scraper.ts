// SEEK job scraper
import { BaseScraper } from './base-single-job-scraper';
import type { JobData } from '../types';

export class SeekScraper extends BaseScraper {
  protected platform = 'SEEK';

  extractJobData(): JobData | null {
    // Check if we're on a job detail page - try multiple selectors
    const titleSelectors = [
      '[data-automation="job-detail-title"]',
      'h1[data-automation="job-detail-title"]',
      'h1',
      'h2',
      '.jobTitle',
      '[class*="title"]',
    ];

    const companySelectors = [
      '[data-automation="advertiser-name"]',
      '.advertiser-name',
      '[class*="company"]',
      '[class*="advertiser"]',
    ];

    const titleElement = this.querySelector(titleSelectors);
    const companyElement = this.querySelector(companySelectors);

    console.log('SEEK Debug - Title element:', titleElement);
    console.log('SEEK Debug - Company element:', companyElement);
    console.log('SEEK Debug - Title text:', this.extractText(titleElement));
    console.log('SEEK Debug - Company text:', this.extractText(companyElement));

    if (!titleElement || !companyElement) {
      console.warn('SEEK: Could not find required elements for job data extraction');
      return null;
    }

    const locationElement = document.querySelector('[data-automation="job-detail-location"]');
    const descriptionElement = document.querySelector('[data-automation="jobAdDetails"]');
    const workTypeElement = document.querySelector('[data-automation="job-detail-work-type"]');

    // Extract company logo
    const companyLogoUrl = this.queryImageSrc([
      '[data-testid="bx-logo-container"] [data-testid="bx-logo-image"] img.lkc6bp0',
      '[data-testid="bx-logo-image"] img.lkc6bp0',
      '[data-testid="bx-logo-container"] img',
      'img.lkc6bp0',
    ]);

    return {
      title: this.extractText(titleElement),
      company: this.extractText(companyElement),
      location: this.extractText(locationElement),
      jobUrl: window.location.href,
      description: this.extractText(descriptionElement),
      employmentTypes: this.extractText(workTypeElement),
      platform: this.platform,
      companyLogoUrl: companyLogoUrl || undefined,
    };
  }

  findInsertionPoint(): HTMLElement | null {
    // Try multiple selectors to find the title container
    const seekTitleSelectors = [
      '[data-automation="job-detail-title"]',
      'h1[data-automation="job-detail-title"]',
      'h1',
      'h2',
      '.jobTitle',
      '[class*="title"]',
    ];

    const seekTitle = this.querySelector(seekTitleSelectors);

    console.log('SEEK Debug - Found title element for insertion:', seekTitle);

    // Try different insertion strategies
    if (seekTitle) {
      // Try to find a good container - go up the DOM tree
      let container = seekTitle.parentElement;
      let attempts = 0;

      while (container && attempts < 3) {
        // Look for a container that seems suitable
        if ((container as HTMLElement).offsetWidth > 300) {
          // Has reasonable width
          console.log('SEEK Debug - Using container:', container);
          return container as HTMLElement;
        }
        container = container.parentElement;
        attempts++;
      }

      // Fallback to direct parent
      return (seekTitle.parentElement as HTMLElement) || null;
    }

    return null;
  }
}
