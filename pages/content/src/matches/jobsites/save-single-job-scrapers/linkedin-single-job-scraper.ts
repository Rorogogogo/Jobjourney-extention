// LinkedIn job scraper
import { BaseScraper } from './base-single-job-scraper';
import type { JobData } from '../types';

export class LinkedInScraper extends BaseScraper {
  protected platform = 'LinkedIn';

  extractJobData(): JobData | null {
    // First check if we're on a job detail page by checking the URL
    const url = window.location.href;

    // LinkedIn job detail pages have URLs like:
    // https://www.linkedin.com/jobs/view/123456789/
    // or with currentJobId parameter
    // We should NOT show button on /jobs/collections/ pages
    if (url.includes('/jobs/collections/') && !url.includes('currentJobId=')) {
      console.log('LinkedIn: On job collections page without specific job selected');
      return null;
    }

    // Check if we're on a job detail page
    const titleElement = this.querySelector([
      '.job-details-jobs-unified-top-card__job-title h1',
      '.t-24.job-details-jobs-unified-top-card__job-title',
      'h1.job-title'
    ]);

    const companyElement = this.querySelector([
      '.job-details-jobs-unified-top-card__company-name a',
      '.jobs-details-top-card__company-url',
      '.job-details-jobs-unified-top-card__company-name'
    ]);

    const locationElement = document.querySelector(
      '.job-details-jobs-unified-top-card__primary-description-container, .jobs-details-top-card__job-info'
    );

    const descriptionElement = document.querySelector(
      '.jobs-description__content .jobs-box__html-content, .jobs-description-content__text, div#job-details'
    );

    // Extract company logo
    const companyLogoUrl = this.queryImageSrc([
      '.artdeco-entity-lockup__image img.evi-image',
      '.jobs-company img.evi-image',
      '.job-details-jobs-unified-top-card__container--two-pane .evi-image'
    ]);

    if (!titleElement || !companyElement) return null;

    // Extract job ID from URL if possible
    let jobUrl = this.cleanUrl(window.location.href);
    const currentJobIdMatch = window.location.href.match(/currentJobId=(\d+)/);
    if (currentJobIdMatch) {
      // Convert collections URL to proper job view URL
      jobUrl = `https://www.linkedin.com/jobs/view/${currentJobIdMatch[1]}/`;
    }

    return {
      title: this.extractText(titleElement),
      company: this.extractText(companyElement),
      location: this.extractText(locationElement)?.split('·')[0]?.trim() || '',
      jobUrl,
      description: this.extractText(descriptionElement),
      platform: this.platform,
      companyLogoUrl: companyLogoUrl || undefined,
    };
  }

  findInsertionPoint(): HTMLElement | null {
    // Find the title container and get its parent to insert below
    const linkedinTitle = document.querySelector(
      '.job-details-jobs-unified-top-card__job-title, .t-24.job-details-jobs-unified-top-card__job-title, h1.job-title'
    );
    return linkedinTitle?.parentElement?.parentElement || linkedinTitle?.parentElement || null;
  }
}