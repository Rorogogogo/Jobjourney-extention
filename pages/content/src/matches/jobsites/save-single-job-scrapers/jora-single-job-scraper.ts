// Jora single job scraper
import type { JobData } from '../types';
import { BaseScraper } from './base-single-job-scraper';

export class JoraScraper extends BaseScraper {
  protected platform = 'Jora';

  extractJobData(): JobData | null {
    const activeCard = document.querySelector('.job-card[data-active="true"]');
    const panel = document.querySelector('.jdv-content:not([data-hidden="true"])');

    if (!activeCard && !panel) {
      return null;
    }

    const titleElement = panel?.querySelector('h1') || activeCard?.querySelector('.job-title a.job-link, .job-title a');
    const companyElement =
      panel?.querySelector('.job-view-company, .job-company') || activeCard?.querySelector('.job-company');
    const locationElement =
      panel?.querySelector('.job-view-location, .job-location') || activeCard?.querySelector('.job-location');
    const descriptionElement =
      panel?.querySelector('.job-description, .job-view-body, [data-testid="job-description"]') || panel;

    const linkElement =
      activeCard?.querySelector<HTMLAnchorElement>('.job-title a.job-link, .job-title a') ||
      (titleElement as HTMLAnchorElement);

    let jobUrl = window.location.href;
    if (linkElement?.href) {
      try {
        jobUrl = new URL(linkElement.href, window.location.origin).href;
      } catch {
        jobUrl = linkElement.href;
      }
    }

    return {
      title: this.extractText(titleElement as Element),
      company: this.extractText(companyElement as Element),
      location: this.extractText(locationElement as Element),
      jobUrl,
      description: this.extractText(descriptionElement as Element),
      platform: this.platform,
    };
  }

  findInsertionPoint(): HTMLElement | null {
    const panelHeader = document.querySelector('.jdv-content:not([data-hidden="true"]) h1');
    if (panelHeader?.parentElement) {
      return panelHeader.parentElement as HTMLElement;
    }

    const activeCardTitle = document.querySelector('.job-card[data-active="true"] .job-title');
    return (activeCardTitle?.parentElement as HTMLElement) || null;
  }
}
