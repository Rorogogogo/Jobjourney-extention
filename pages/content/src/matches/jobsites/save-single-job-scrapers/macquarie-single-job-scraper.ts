// Macquarie Group job scraper
import type { JobData } from '../types';
import { BaseScraper } from './base-single-job-scraper';

export class MacquarieScraper extends BaseScraper {
  protected platform = 'Macquarie Group';

  extractJobData(): JobData | null {
    // Check if we're on a job detail page by checking URL pattern
    const url = window.location.href;
    if (!url.includes('JobDetail') || !url.includes('jobId=')) {
      console.log('Macquarie: Not on a job detail page');
      return null;
    }

    // Extract job information based on the provided HTML structure
    const titleElement = document.querySelector('.title.title--11');

    // Company is always Macquarie Group for this domain
    const company = 'Macquarie Group';

    const locationElement = document.querySelector(
      '.article__content__view__field.field--location .article__content__view__field__value',
    );

    const employmentTypeElement = document.querySelector(
      '.article__content__view__field.field--employmentterm .article__content__view__field__value',
    );

    const _datePostedElement = document.querySelector(
      '.article__content__view__field.field--date .article__content__view__field__value',
    );

    // Extract job description from all relevant sections
    const descriptionElements = document.querySelectorAll('.article__content__view__field__value');
    let description = '';
    descriptionElements.forEach(element => {
      const text = this.extractText(element);
      if (text && text.length > 50) {
        // Only include substantial content
        description += text + '\n\n';
      }
    });

    // Use official Macquarie Group logo
    const companyLogoUrl = 'https://upload.wikimedia.org/wikipedia/commons/8/86/Macquarie_Group_logo.jpg';

    if (!titleElement) {
      console.warn('Macquarie: Could not find job title');
      return null;
    }

    return {
      title: this.extractText(titleElement),
      company,
      location: this.extractText(locationElement),
      jobUrl: this.cleanUrl(window.location.href),
      description: description.trim(),
      employmentTypes: this.extractText(employmentTypeElement),
      platform: this.platform,
      companyLogoUrl,
    };
  }

  findInsertionPoint(): HTMLElement | null {
    // Try to find a good insertion point near the job title
    const titleElement = document.querySelector('.title.title--11');

    if (!titleElement) return null;

    // Look for the section header that contains the title
    const sectionHeader = titleElement.closest('.section__header__text');
    if (sectionHeader) {
      // Insert after the section header
      return (sectionHeader.parentElement as HTMLElement) || null;
    }

    // Fallback to title's parent container
    let container = titleElement.parentElement;
    let attempts = 0;

    while (container && attempts < 3) {
      // Look for a container that seems suitable for button placement
      const containerElement = container as HTMLElement;
      if (containerElement.offsetWidth > 300) {
        console.log('Macquarie Debug - Using container:', container);
        return containerElement;
      }
      container = container.parentElement;
      attempts++;
    }

    // Final fallback
    return (titleElement.parentElement as HTMLElement) || null;
  }
}
