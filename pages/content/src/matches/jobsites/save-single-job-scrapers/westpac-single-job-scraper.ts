import { BaseSingleJobScraper } from './base-single-job-scraper';
import type { JobData } from '../types';

export class WestpacScraper extends BaseSingleJobScraper {
  protected platformName = 'Westpac';
  protected companyLogoUrl = 'https://1000logos.net/wp-content/uploads/2019/10/Westpac-Logo.jpg';

  isOnJobDetailPage(): boolean {
    const url = window.location.href;
    return url.includes('/job/');
  }

  extractJobData(): JobData | undefined {
    if (!this.isOnJobDetailPage()) {
      console.log('Westpac: Not on a job detail page');
      return undefined;
    }

    // Extract job information based on the Oracle HCM structure
    const titleElement = document.querySelector('.job-details__title');
    
    if (!titleElement) {
      console.warn('Westpac: Could not find job title');
      return undefined;
    }

    // Company is always Westpac for this domain
    const company = 'Westpac';

    // Extract location from posting locations component - try multiple selectors
    let locationElement = document.querySelector('.job-details__subtitle posting-locations span');
    if (!locationElement) {
      // Alternative: look in job meta for locations
      const metaItems = document.querySelectorAll('.job-meta__item');
      metaItems.forEach((item) => {
        const titleEl = item.querySelector('.job-meta__title');
        if (titleEl?.textContent?.trim() === 'Locations') {
          locationElement = item.querySelector('.job-meta__pin-item');
        }
      });
    }
    if (!locationElement) {
      // Another alternative: direct posting locations selector
      locationElement = document.querySelector('posting-locations span');
    }
    
    // Extract job description from the main content
    const descriptionElement = document.querySelector('.job-details__description-content.basic-formatter');
    let description = '';
    if (descriptionElement) {
      description = descriptionElement.textContent?.trim() || '';
    }

    // Extract job schedule (Full time, Part time, etc.)
    const scheduleElements = document.querySelectorAll('.job-meta__item');
    let jobSchedule = '';
    scheduleElements.forEach((element) => {
      const titleElement = element.querySelector('.job-meta__title');
      const valueElement = element.querySelector('.job-meta__subitem');
      if (titleElement?.textContent?.trim() === 'Job Schedule' && valueElement) {
        jobSchedule = valueElement.textContent?.trim() || '';
      }
    });

    return {
      title: titleElement.textContent?.trim() || '',
      company,
      location: locationElement?.textContent?.trim() || '',
      jobUrl: window.location.href.split('?')[0],
      description: description.trim(),
      requiredSkills: undefined,
      employmentTypes: jobSchedule, // Use job schedule as employment type
      workArrangement: undefined,
      platform: this.platformName,
      companyLogoUrl: this.companyLogoUrl,
    };
  }

  findInsertionPoint(): HTMLElement | undefined {
    // Find the subtitle/location area and insert after it
    const subtitle = document.querySelector('.job-details__subtitle');
    if (subtitle && subtitle.parentElement) {
      return subtitle.parentElement as HTMLElement;
    }

    // Alternative: Find the job title and insert after it
    const westpacTitle = document.querySelector('.job-details__title');
    if (westpacTitle && westpacTitle.parentElement) {
      return westpacTitle.parentElement as HTMLElement;
    }

    // Final fallback to main content area
    const mainContent = document.querySelector('.job-details');
    return mainContent as HTMLElement || undefined;
  }
}