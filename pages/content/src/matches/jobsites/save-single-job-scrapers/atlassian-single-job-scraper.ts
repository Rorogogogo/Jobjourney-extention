import type { JobData } from '../types';
import { BaseSingleJobScraper } from './base-single-job-scraper';

export class AtlassianScraper extends BaseSingleJobScraper {
  protected platformName = 'Atlassian';
  protected companyLogoUrl = 'https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/favicon-32x32.png';

  isOnJobDetailPage(): boolean {
    const url = window.location.href;
    return url.includes('/careers/details/');
  }

  extractJobData(): JobData | undefined {
    if (!this.isOnJobDetailPage()) {
      console.log('Atlassian: Not on a job detail page');
      return undefined;
    }

    // Extract job information based on the provided HTML structure
    const titleElement = document.querySelector('.default.heading');

    if (!titleElement) {
      console.warn('Atlassian: Could not find job title');
      return undefined;
    }

    // Company is always Atlassian for this domain
    const company = 'Atlassian';

    // Extract location and department from the highlight paragraph
    const highlightElement = document.querySelector('.job-posting-detail--highlight');
    let location = '';
    let department = '';

    if (highlightElement) {
      const highlightText = highlightElement.textContent?.trim() || '';
      // Format: "Engineering | Sydney, Australia | Remote, Remote |"
      const parts = highlightText.split('|').map(part => part.trim());
      if (parts.length >= 2) {
        department = parts[0];
        location = parts[1];
      }
    }

    // Extract job description from the main content area
    const descriptionContainer = document.querySelector('.column.colspan-10.text-left.push.push-1');
    let description = '';
    if (descriptionContainer) {
      // Get all text content but clean it up
      const textContent = descriptionContainer.textContent?.trim() || '';
      // Remove excessive whitespace and normalize line breaks
      description = textContent.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n\n');
    }

    return {
      title: titleElement.textContent?.trim() || '',
      company,
      location,
      jobUrl: window.location.href.split('?')[0],
      description: description.trim(),
      requiredSkills: undefined,
      employmentTypes: department, // Use department as employment type
      workArrangement: undefined,
      platform: this.platformName,
      companyLogoUrl: this.companyLogoUrl,
    };
  }

  findInsertionPoint(): HTMLElement | undefined {
    // Find the main content area where the title is located
    const atlassianTitle = document.querySelector('.default.heading');

    if (!atlassianTitle) return undefined;

    // Find the container that holds both title and job details
    const titleContainer = atlassianTitle.closest('.column.colspan-10.text-left.push.push-1');
    if (titleContainer) {
      // Look for the job details paragraph within this container
      const jobDetails = titleContainer.querySelector('.job-posting-detail--highlight');
      if (jobDetails) {
        // Create a wrapper div after the job details to ensure proper positioning
        const wrapperDiv = document.createElement('div');
        wrapperDiv.style.cssText = 'width: 100%; margin: 16px 0; clear: both;';

        // Insert the wrapper after the job details paragraph
        if (jobDetails.parentElement) {
          jobDetails.parentElement.insertAdjacentElement('afterend', wrapperDiv);
          return wrapperDiv;
        }
      }
    }

    // Alternative: Look for the main content column and append at the end
    const mainContentColumn = document.querySelector('.column.colspan-10.text-left.push.push-1');
    if (mainContentColumn) {
      // Create a wrapper at the bottom of the content
      const bottomWrapper = document.createElement('div');
      bottomWrapper.style.cssText = 'width: 100%; margin: 20px 0; clear: both; display: block;';
      mainContentColumn.appendChild(bottomWrapper);
      return bottomWrapper;
    }

    // Final fallback to title's container
    return (atlassianTitle.parentElement as HTMLElement) || undefined;
  }
}
