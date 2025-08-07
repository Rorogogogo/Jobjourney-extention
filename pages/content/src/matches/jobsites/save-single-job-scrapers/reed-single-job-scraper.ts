// Reed job scraper
import { BaseScraper } from './base-single-job-scraper';
import type { JobData } from '../types';

export class ReedScraper extends BaseScraper {
  protected platform = 'Reed';

  extractJobData(): JobData | null {
    // Basic Reed extraction - adjust selectors as needed
    const titleElement = this.querySelector(['h1.job-title', 'h1']);
    const companyElement = this.querySelector(['.company-name', '.company']);
    const locationElement = document.querySelector('.location, .job-location');
    const descriptionElement = document.querySelector('.job-description, .description');

    if (!titleElement || !companyElement) return null;

    return {
      title: this.extractText(titleElement),
      company: this.extractText(companyElement),
      location: this.extractText(locationElement),
      jobUrl: this.cleanUrl(window.location.href),
      description: this.extractText(descriptionElement),
      platform: this.platform,
    };
  }

  findInsertionPoint(): HTMLElement | null {
    const reedTitle = document.querySelector('h1.job-title, h1');
    return (reedTitle?.parentElement as HTMLElement) || null;
  }
}
