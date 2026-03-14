import type { JobData } from '@extension/types';
import { BaseSingleJobScraper } from './base-single-job-scraper';

export class CanvaScraper extends BaseSingleJobScraper {
  protected platform = 'Canva';
  protected companyLogoUrl = 'https://www.pngmart.com/files/23/Canva-Logo-PNG-Picture.png';

  isOnJobDetailPage(): boolean {
    const url = window.location.href;
    return url.includes('/jobs/');
  }

  extractJobData(): JobData | null {
    if (!this.isOnJobDetailPage()) {
      console.log('Canva: Not on a job detail page');
      return null;
    }

    // Extract job information based on the Canva structure
    const titleElement = document.querySelector('.hero-heading');

    if (!titleElement) {
      console.warn('Canva: Could not find job title');
      return null;
    }

    // Company is always Canva for this domain
    const company = 'Canva';

    // Extract location from job meta list
    let location = '';
    const jobMetaItems = document.querySelectorAll('.job-meta li');
    jobMetaItems.forEach(item => {
      const label = item.querySelector('p');
      if (label?.textContent?.trim() === 'Country') {
        const links = item.querySelectorAll('a');
        if (links.length > 0) {
          // Get the first location link text
          location = links[0].textContent?.trim() || '';
        }
      }
    });

    // Extract job schedule (Full-time, etc.)
    let jobSchedule = '';
    jobMetaItems.forEach(item => {
      const label = item.querySelector('p');
      if (label?.textContent?.trim() === 'Schedule') {
        const span = item.querySelector('span');
        if (span) {
          jobSchedule = span.textContent?.trim() || '';
        }
      }
    });

    // Extract job description from the main article
    const descriptionElement = document.querySelector('article.cms-content');
    let description = '';
    if (descriptionElement) {
      description = descriptionElement.textContent?.trim() || '';
    }

    return {
      title: titleElement.textContent?.trim() || '',
      company,
      location,
      jobUrl: window.location.href.split('?')[0],
      description: description.trim(),
      requiredSkills: undefined,
      employmentTypes: jobSchedule,
      workArrangement: undefined,
      platform: this.platform,
      companyLogoUrl: this.companyLogoUrl,
    };
  }

  findInsertionPoint(): HTMLElement | null {
    // Find the job meta area and insert after it
    const jobMeta = document.querySelector('.job-meta');
    if (jobMeta && jobMeta.parentElement) {
      return jobMeta.parentElement as HTMLElement;
    }

    // Alternative: Find the hero section and insert after it
    const heroSection = document.querySelector('.hero-job');
    if (heroSection && heroSection.parentElement) {
      return heroSection.parentElement as HTMLElement;
    }

    // Final fallback to main content
    const canvaMain = document.querySelector('main#content');
    return (canvaMain as HTMLElement) || null;
  }
}
