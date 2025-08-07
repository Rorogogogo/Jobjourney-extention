// Indeed job scraper
import { BaseScraper } from './base-single-job-scraper';
import type { JobData } from '../types';

export class IndeedScraper extends BaseScraper {
  protected platform = 'Indeed';

  extractJobData(): JobData | null {
    // Check if we're on a job detail page
    const titleElement = this.querySelector([
      'h2[data-testid="jobsearch-JobInfoHeader-title"]',
      'h2[data-testid="simpler-jobTitle"]',
    ]);

    const companyElement = this.querySelector([
      '[data-testid="inlineHeader-companyName"] a',
      'span.jobsearch-JobInfoHeader-companyNameSimple',
    ]);

    const locationElement = this.querySelector([
      '[data-testid="inlineHeader-companyLocation"] div',
      'div[data-testid="jobsearch-JobInfoHeader-companyLocation"] div:first-child',
    ]);

    const descriptionElement = document.querySelector('#jobDescriptionText');
    const jobTypeElement = document.querySelector('#salaryInfoAndJobType .css-18poi35');

    // Extract company logo
    const companyLogoUrl = this.queryImageSrc([
      'img[data-testid="jobsearch-JobInfoHeader-logo-overlay-lower"]',
      'img.jobsearch-JobInfoHeader-logo',
      'img.jobsearch-JobInfoHeader-logo-overlay-lower',
    ]);

    if (!titleElement || !companyElement) return null;

    return {
      title: this.extractText(titleElement),
      company: this.extractText(companyElement),
      location: this.extractText(locationElement),
      jobUrl: this.cleanUrl(window.location.href),
      description: this.extractText(descriptionElement),
      employmentTypes: this.extractText(jobTypeElement),
      platform: this.platform,
      companyLogoUrl: companyLogoUrl || undefined,
    };
  }

  findInsertionPoint(): HTMLElement | null {
    // Find the header container to insert below title
    const indeedTitle = document.querySelector(
      'h2[data-testid="jobsearch-JobInfoHeader-title"], h2[data-testid="simpler-jobTitle"]',
    );
    return indeedTitle?.parentElement?.parentElement || indeedTitle?.parentElement || null;
  }
}
