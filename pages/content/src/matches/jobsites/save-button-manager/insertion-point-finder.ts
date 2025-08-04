// Button insertion point finder for different platforms
import type { Platform } from './types';

export class InsertionPointFinder {
  static findInsertionPoint(platform: Platform): HTMLElement | null {
    switch (platform) {
      case 'linkedin':
        // Find the title container and get its parent to insert below
        const linkedinTitle = document.querySelector(
          '.job-details-jobs-unified-top-card__job-title, .t-24.job-details-jobs-unified-top-card__job-title, h1.job-title',
        );
        return linkedinTitle?.parentElement?.parentElement || linkedinTitle?.parentElement || null;

      case 'indeed':
        // Find the header container to insert below title
        const indeedTitle = document.querySelector(
          'h2[data-testid="jobsearch-JobInfoHeader-title"], h2[data-testid="simpler-jobTitle"]',
        );
        return indeedTitle?.parentElement?.parentElement || indeedTitle?.parentElement || null;

      case 'seek':
        // Try multiple selectors to find the title container
        const seekTitleSelectors = [
          '[data-automation="job-detail-title"]',
          'h1[data-automation="job-detail-title"]',
          'h1',
          'h2',
          '.jobTitle',
          '[class*="title"]',
        ];

        let seekTitle = null;
        for (const selector of seekTitleSelectors) {
          seekTitle = document.querySelector(selector);
          if (seekTitle && seekTitle.textContent?.trim()) break;
        }

        console.log('SEEK Debug - Found title element for insertion:', seekTitle);

        // Try different insertion strategies
        if (seekTitle) {
          // Try to find a good container - go up the DOM tree
          let container = seekTitle.parentElement;
          let attempts = 0;

          while (container && attempts < 3) {
            // Look for a container that seems suitable
            if (container.offsetWidth > 300) {
              // Has reasonable width
              console.log('SEEK Debug - Using container:', container);
              return container;
            }
            container = container.parentElement;
            attempts++;
          }

          // Fallback to direct parent
          return seekTitle.parentElement || null;
        }

        return null;

      case 'reed':
        const reedTitle = document.querySelector('h1.job-title, h1');
        return reedTitle?.parentElement || null;

      case 'macquarie':
        // Try to find a good insertion point near the job title
        const titleElement = document.querySelector('.title.title--11');
        
        if (!titleElement) return null;

        // Look for the section header that contains the title
        const sectionHeader = titleElement.closest('.section__header__text');
        if (sectionHeader) {
          // Insert after the section header
          return sectionHeader.parentElement as HTMLElement || null;
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
        return titleElement.parentElement as HTMLElement || null;

      case 'atlassian':
        // Find the main content area where the title is located
        const atlassianTitle = document.querySelector('.default.heading');
        
        if (!atlassianTitle) return null;

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
        return atlassianTitle.parentElement as HTMLElement || null;

      case 'westpac':
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
        return mainContent as HTMLElement || null;

      case 'canva':
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
        return canvaMain as HTMLElement || null;

      default:
        return null;
    }
  }
}