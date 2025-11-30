// Save Job Button functionality for job detail pages
import { detectPRRequirement } from './prDetection';

export {};

interface JobData {
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  description?: string;
  requiredSkills?: string;
  employmentTypes?: string;
  workArrangement?: string;
  platform: string;
  companyLogoUrl?: string;
}

class SaveJobButton {
  private button: HTMLElement | null = null;
  private currentJobData: JobData | null = null;
  private isAuthenticated = false;

  constructor() {
    this.init();
  }

  private async init() {
    console.log('🔵 SaveJobButton initialized for:', window.location.hostname);

    // Check authentication status
    await this.checkAuthStatus();

    // Start monitoring for job details
    this.startJobDetailMonitoring();
  }

  private async checkAuthStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_AUTH_STATUS',
      });

      this.isAuthenticated = response.success && response.data?.isAuthenticated;
      console.log('🔐 Auth status:', this.isAuthenticated);
    } catch (error) {
      console.warn('Failed to check auth status:', error);
      this.isAuthenticated = false;
    }
  }

  private startJobDetailMonitoring() {
    // Initial check
    this.detectAndCreateButton();

    // Monitor for changes (when user navigates to different jobs)
    const observer = new MutationObserver(() => {
      this.detectAndCreateButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also check periodically for dynamic content
    setInterval(() => {
      this.detectAndCreateButton();
    }, 3000);
  }

  private detectAndCreateButton() {
    // Always show the button, even when not authenticated
    const platform = this.getCurrentPlatform();
    if (!platform) {
      console.log('SaveJobButton: Platform not detected:', window.location.hostname);
      return;
    }

    console.log('SaveJobButton: Detected platform:', platform);

    const jobData = this.extractJobData(platform);
    if (!jobData) {
      console.log('SaveJobButton: Could not extract job data for platform:', platform);
      return;
    }

    console.log('SaveJobButton: Extracted job data:', jobData);

    // Only create/update button if we have valid job data
    if (this.shouldCreateButton(jobData)) {
      console.log('SaveJobButton: Creating button for job:', jobData.title);
      this.createOrUpdateButton(jobData, platform);
    } else {
      console.log('SaveJobButton: Button creation not needed (data unchanged)');
    }
  }

  private getCurrentPlatform(): string | null {
    const hostname = window.location.hostname.toLowerCase();

    // Use exact hostname or subdomain matching to prevent injection attacks
    if (hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')) return 'linkedin';
    if (
      hostname === 'seek.com.au' ||
      hostname.endsWith('.seek.com.au') ||
      hostname === 'seek.co.nz' ||
      hostname.endsWith('.seek.co.nz')
    )
      return 'seek';
    if (hostname === 'indeed.com' || hostname.endsWith('.indeed.com')) return 'indeed';
    if (hostname === 'reed.co.uk' || hostname.endsWith('.reed.co.uk')) return 'reed';
    if (hostname === 'recruitment.macquarie.com') return 'macquarie';
    if (hostname === 'atlassian.com' || hostname.endsWith('.atlassian.com')) return 'atlassian';
    if (hostname === 'ebuu.fa.ap1.oraclecloud.com') return 'westpac';
    if (hostname === 'lifeatcanva.com' || hostname === 'www.lifeatcanva.com') return 'canva';

    return null;
  }

  private extractJobData(platform: string): JobData | null {
    try {
      switch (platform) {
        case 'linkedin':
          return this.extractLinkedInJobData();
        case 'indeed':
          return this.extractIndeedJobData();
        case 'seek':
          return this.extractSeekJobData();
        case 'reed':
          return this.extractReedJobData();
        case 'macquarie':
          return this.extractMacquarieJobData();
        case 'atlassian':
          return this.extractAtlassianJobData();
        case 'westpac':
          return this.extractWestpacJobData();
        case 'canva':
          return this.extractCanvaJobData();
        default:
          return null;
      }
    } catch (error) {
      console.warn(`Error extracting ${platform} job data:`, error);
      return null;
    }
  }

  private extractLinkedInJobData(): JobData | null {
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
    const titleElement = document.querySelector(
      '.job-details-jobs-unified-top-card__job-title h1, .t-24.job-details-jobs-unified-top-card__job-title, h1.job-title',
    );
    const companyElement = document.querySelector(
      '.job-details-jobs-unified-top-card__company-name a, .jobs-details-top-card__company-url, .job-details-jobs-unified-top-card__company-name',
    );
    const locationElement = document.querySelector(
      '.job-details-jobs-unified-top-card__primary-description-container, .jobs-details-top-card__job-info',
    );
    const descriptionElement = document.querySelector(
      '.jobs-description__content .jobs-box__html-content, .jobs-description-content__text, div#job-details',
    );

    // Extract company logo - from LinkedIn job detail company section
    const logoElement = document.querySelector(
      '.artdeco-entity-lockup__image img.evi-image, ' +
        '.jobs-company img.evi-image, ' +
        '.job-details-jobs-unified-top-card__container--two-pane .evi-image',
    ) as HTMLImageElement;
    const companyLogoUrl = logoElement?.src || undefined;

    if (!titleElement || !companyElement) return null;

    // Extract job ID from URL if possible
    let jobUrl = window.location.href.split('?')[0];
    const currentJobIdMatch = window.location.href.match(/currentJobId=(\d+)/);
    if (currentJobIdMatch) {
      // Convert collections URL to proper job view URL
      jobUrl = `https://www.linkedin.com/jobs/view/${currentJobIdMatch[1]}/`;
    }

    return {
      title: titleElement.textContent?.trim() || '',
      company: companyElement.textContent?.trim() || '',
      location: locationElement?.textContent?.trim().split('·')[0]?.trim() || '',
      jobUrl: jobUrl,
      description: descriptionElement?.textContent?.trim() || '',
      platform: 'LinkedIn',
      companyLogoUrl: companyLogoUrl,
    };
  }

  private extractIndeedJobData(): JobData | null {
    // Check if we're on a job detail page
    const titleElement = document.querySelector(
      'h2[data-testid="jobsearch-JobInfoHeader-title"], h2[data-testid="simpler-jobTitle"]',
    );
    const companyElement = document.querySelector(
      '[data-testid="inlineHeader-companyName"] a, span.jobsearch-JobInfoHeader-companyNameSimple',
    );
    const locationElement = document.querySelector(
      '[data-testid="inlineHeader-companyLocation"] div, div[data-testid="jobsearch-JobInfoHeader-companyLocation"] div:first-child',
    );
    const descriptionElement = document.querySelector('#jobDescriptionText');
    const jobTypeElement = document.querySelector('#salaryInfoAndJobType .css-18poi35');

    // Extract company logo - from actual Indeed DOM structure
    const logoElement = document.querySelector(
      'img[data-testid="jobsearch-JobInfoHeader-logo-overlay-lower"], img.jobsearch-JobInfoHeader-logo, img.jobsearch-JobInfoHeader-logo-overlay-lower',
    ) as HTMLImageElement;
    const companyLogoUrl = logoElement?.src || undefined;

    if (!titleElement || !companyElement) return null;

    return {
      title: titleElement.textContent?.trim() || '',
      company: companyElement.textContent?.trim() || '',
      location: locationElement?.textContent?.trim() || '',
      jobUrl: window.location.href.split('?')[0],
      description: descriptionElement?.textContent?.trim() || '',
      employmentTypes: jobTypeElement?.textContent?.trim() || '',
      platform: 'Indeed',
      companyLogoUrl: companyLogoUrl,
    };
  }

  private extractSeekJobData(): JobData | null {
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

    let titleElement = null;
    let companyElement = null;

    // Try to find title element
    for (const selector of titleSelectors) {
      titleElement = document.querySelector(selector);
      if (titleElement && titleElement.textContent?.trim()) break;
    }

    // Try to find company element
    for (const selector of companySelectors) {
      companyElement = document.querySelector(selector);
      if (companyElement && companyElement.textContent?.trim()) break;
    }

    console.log('SEEK Debug - Title element:', titleElement);
    console.log('SEEK Debug - Company element:', companyElement);
    console.log('SEEK Debug - Title text:', titleElement?.textContent?.trim());
    console.log('SEEK Debug - Company text:', companyElement?.textContent?.trim());

    if (!titleElement || !companyElement) {
      console.warn('SEEK: Could not find required elements for job data extraction');
      return null;
    }

    const locationElement = document.querySelector('[data-automation="job-detail-location"]');
    const descriptionElement = document.querySelector('[data-automation="jobAdDetails"]');
    const workTypeElement = document.querySelector('[data-automation="job-detail-work-type"]');

    // Extract company logo - from SEEK job detail page
    const logoElement = document.querySelector(
      '[data-testid="bx-logo-container"] [data-testid="bx-logo-image"] img.lkc6bp0, [data-testid="bx-logo-image"] img.lkc6bp0, [data-testid="bx-logo-container"] img, img.lkc6bp0',
    ) as HTMLImageElement;
    const companyLogoUrl = logoElement?.src || undefined;

    return {
      title: titleElement.textContent?.trim() || '',
      company: companyElement.textContent?.trim() || '',
      location: locationElement?.textContent?.trim() || '',
      jobUrl: window.location.href.split('?')[0],
      description: descriptionElement?.textContent?.trim() || '',
      employmentTypes: workTypeElement?.textContent?.trim() || '',
      platform: 'SEEK',
      companyLogoUrl: companyLogoUrl,
    };
  }

  private extractReedJobData(): JobData | null {
    // Basic Reed extraction - adjust selectors as needed
    const titleElement = document.querySelector('h1.job-title, h1');
    const companyElement = document.querySelector('.company-name, .company');
    const locationElement = document.querySelector('.location, .job-location');
    const descriptionElement = document.querySelector('.job-description, .description');

    if (!titleElement || !companyElement) return null;

    return {
      title: titleElement.textContent?.trim() || '',
      company: companyElement.textContent?.trim() || '',
      location: locationElement?.textContent?.trim() || '',
      jobUrl: window.location.href.split('?')[0],
      description: descriptionElement?.textContent?.trim() || '',
      platform: 'Reed',
    };
  }

  private extractMacquarieJobData(): JobData | null {
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

    // Extract job description from all relevant sections
    const descriptionElements = document.querySelectorAll('.article__content__view__field__value');
    let description = '';
    descriptionElements.forEach(element => {
      const text = element.textContent?.trim();
      if (text && text.length > 50) {
        // Only include substantial content
        description += text + '\n\n';
      }
    });

    if (!titleElement) {
      console.warn('Macquarie: Could not find job title');
      return null;
    }

    return {
      title: titleElement.textContent?.trim() || '',
      company,
      location: locationElement?.textContent?.trim() || '',
      jobUrl: window.location.href.split('?')[0],
      description: description.trim(),
      employmentTypes: employmentTypeElement?.textContent?.trim() || '',
      platform: 'Macquarie Group',
      companyLogoUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Macquarie_Group_logo.jpg',
    };
  }

  private extractAtlassianJobData(): JobData | null {
    // Check if we're on a job detail page by checking URL pattern
    const url = window.location.href;
    if (!url.includes('/careers/details/')) {
      console.log('Atlassian: Not on a job detail page');
      return null;
    }

    // Extract job information based on the provided HTML structure
    const titleElement = document.querySelector('.default.heading');

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

    if (!titleElement) {
      console.warn('Atlassian: Could not find job title');
      return null;
    }

    return {
      title: titleElement.textContent?.trim() || '',
      company,
      location,
      jobUrl: window.location.href.split('?')[0],
      description: description.trim(),
      employmentTypes: department, // Use department as employment type
      platform: 'Atlassian',
      companyLogoUrl: 'https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/favicon-32x32.png',
    };
  }

  private extractWestpacJobData(): JobData | null {
    // Check if we're on a job detail page by checking URL pattern
    const url = window.location.href;
    if (!url.includes('/job/')) {
      console.log('Westpac: Not on a job detail page');
      return null;
    }

    // Extract job information based on the Oracle HCM structure
    const titleElement = document.querySelector('.job-details__title');

    // Company is always Westpac for this domain
    const company = 'Westpac';

    // Extract location from posting locations component - try multiple selectors
    let locationElement = document.querySelector('.job-details__subtitle posting-locations span');
    if (!locationElement) {
      // Alternative: look in job meta for locations
      const metaItems = document.querySelectorAll('.job-meta__item');
      metaItems.forEach(item => {
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
    scheduleElements.forEach(element => {
      const titleElement = element.querySelector('.job-meta__title');
      const valueElement = element.querySelector('.job-meta__subitem');
      if (titleElement?.textContent?.trim() === 'Job Schedule' && valueElement) {
        jobSchedule = valueElement.textContent?.trim() || '';
      }
    });

    if (!titleElement) {
      console.warn('Westpac: Could not find job title');
      return null;
    }

    return {
      title: titleElement.textContent?.trim() || '',
      company,
      location: locationElement?.textContent?.trim() || '',
      jobUrl: window.location.href.split('?')[0],
      description: description.trim(),
      employmentTypes: jobSchedule, // Use job schedule as employment type
      platform: 'Westpac',
      companyLogoUrl: 'https://1000logos.net/wp-content/uploads/2019/10/Westpac-Logo.jpg',
    };
  }

  private extractCanvaJobData(): JobData | null {
    // Check if we're on a job detail page by checking URL pattern
    const url = window.location.href;
    if (!url.includes('/jobs/')) {
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
      platform: 'Canva',
      companyLogoUrl: 'https://www.pngmart.com/files/23/Canva-Logo-PNG-Picture.png',
    };
  }

  private shouldCreateButton(jobData: JobData): boolean {
    // Don't create button if we don't have essential data
    // Location is optional for some platforms like Westpac where it might be extracted differently
    if (!jobData.title || !jobData.company || !jobData.jobUrl) {
      console.log('SaveJobButton: Missing essential data', {
        title: jobData.title,
        company: jobData.company,
        jobUrl: jobData.jobUrl,
      });
      return false;
    }

    // Check if button already exists in DOM
    const existingButton = document.getElementById('jobjourney-button-container');
    if (existingButton) {
      console.log('SaveJobButton: Button already exists in DOM');
      return false;
    }

    // Don't create button if job data hasn't changed
    if (
      this.currentJobData &&
      this.currentJobData.title === jobData.title &&
      this.currentJobData.company === jobData.company &&
      this.currentJobData.jobUrl === jobData.jobUrl
    ) {
      console.log('SaveJobButton: Job data unchanged, skipping button creation');
      return false;
    }

    return true;
  }

  private createOrUpdateButton(jobData: JobData, platform: string) {
    // Remove existing button
    this.removeButton();

    // Update current job data
    this.currentJobData = jobData;

    // Find insertion point based on platform
    const insertionPoint = this.findInsertionPoint(platform);
    if (!insertionPoint) {
      console.warn(`Could not find insertion point for ${platform}`);
      return;
    }

    // Create button container div
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'jobjourney-button-container';
    buttonContainer.style.cssText = `
      margin: 12px 0;
      display: flex;
      justify-content: center;
      align-items: center;
    `;

    // Create button
    this.button = this.createButton();

    // Add button to container
    buttonContainer.appendChild(this.button);

    // Insert container below title
    insertionPoint.appendChild(buttonContainer);

    console.log('✅ Save in JJ button created for:', jobData.title);
  }

  private findInsertionPoint(platform: string): HTMLElement | null {
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

      case 'atlassian':
        // Find the main content area where the title is located
        const atlassianTitle = document.querySelector('.default.heading');

        if (!atlassianTitle) return null;

        // Look for the job details paragraph first
        const jobDetails = document.querySelector('.job-posting-detail--highlight');
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
        return (atlassianTitle.parentElement as HTMLElement) || null;

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
        return (mainContent as HTMLElement) || null;

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
        return (canvaMain as HTMLElement) || null;

      default:
        return null;
    }
  }

  private createButton(): HTMLElement {
    const button = document.createElement('button');
    button.id = 'jobjourney-save-button';

    // Get JobJourney icon from extension resources
    const iconUrl = chrome.runtime.getURL('icon-16.png');

    button.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <img src="${iconUrl}" width="16" height="16" style="flex-shrink: 0; margin-bottom: 0 !important; vertical-align: middle !important;" alt="JobJourney" />
        <span>Save in JJ</span>
      </div>
    `;

    // Outline variant styling with reduced border radius
    button.style.cssText = `
      position: relative;
      background: transparent;
      color: black;
      border: 2px solid black;
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: none;
      transform-origin: center;
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
    `;

    // Hover effects for outline variant
    button.addEventListener('mouseenter', () => {
      if (!button.classList.contains('saving') && !button.classList.contains('saved')) {
        button.style.background = 'black';
        button.style.color = 'white';
        button.style.borderColor = 'black';
        button.style.transform = 'scale(1.02)';
        button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
      }
    });

    button.addEventListener('mouseleave', () => {
      if (!button.classList.contains('saving') && !button.classList.contains('saved')) {
        button.style.background = 'transparent';
        button.style.color = 'black';
        button.style.borderColor = 'black';
        button.style.transform = 'scale(1)';
        button.style.boxShadow = 'none';
      }
    });

    // Click effect with multi-state animation
    button.addEventListener('mousedown', () => {
      if (!button.classList.contains('saving') && !button.classList.contains('saved')) {
        button.style.transform = 'scale(0.98)';
      }
    });

    button.addEventListener('mouseup', () => {
      if (!button.classList.contains('saving') && !button.classList.contains('saved')) {
        button.style.transform = 'scale(1.02)';
        setTimeout(() => {
          if (!button.classList.contains('saving') && !button.classList.contains('saved')) {
            button.style.transform = 'scale(1)';
          }
        }, 100);
      }
    });

    // Click handler
    button.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      this.handleSaveJob();
    });

    return button;
  }

  private async handleSaveJob() {
    if (!this.currentJobData) return;

    // Check authentication first
    if (!this.isAuthenticated) {
      // Show toast asking user to sign in
      this.showToast('Please open JobJourney extension and sign in first', 'error');
      return;
    }

    // Show loading state
    this.setButtonLoading(true);

    try {
      // Determine IsRPRequired based on platform type
      let isRPRequired = false;
      const platform = this.currentJobData.platform;

      // Job aggregator websites - always run PR detection
      const jobAggregatorSites = ['LinkedIn', 'Indeed', 'SEEK', 'Reed'];
      if (jobAggregatorSites.includes(platform)) {
        isRPRequired = detectPRRequirement(this.currentJobData.description || '');
      }
      // Company-specific websites - use predefined company policies
      else if (platform === 'Atlassian' || platform === 'Canva' || platform === 'Westpac') {
        isRPRequired = true; // These companies require RP
      } else if (platform === 'Macquarie Group') {
        isRPRequired = false; // Macquarie doesn't require RP
      }
      // Default fallback for any other platforms
      else {
        isRPRequired = detectPRRequirement(this.currentJobData.description || '');
      }

      // Prepare job data for API
      const jobData = {
        Name: this.currentJobData.title,
        CompanyName: this.currentJobData.company,
        Location: this.currentJobData.location,
        JobUrl: this.currentJobData.jobUrl,
        Description: this.currentJobData.description || '',
        RequiredSkills: this.currentJobData.requiredSkills || '',
        EmploymentTypes: this.currentJobData.employmentTypes || '',
        WorkArrangement: this.currentJobData.workArrangement || '',
        CompanyLogoUrl: this.currentJobData.companyLogoUrl || null,
        Status: 1, // Default to "Saved" status
        IsStarred: false,
        IsRPRequired: isRPRequired,
      };

      // Send request to background script
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_JOB_MANUALLY',
        data: jobData,
      });

      if (response.success) {
        this.showToast('Job saved successfully to JobJourney!', 'success');
        this.setButtonSaved();
      } else {
        // Handle 401 or authentication errors
        if (response.error === 'User not authenticated' || response.error === 'Unauthorized - logged out') {
          this.isAuthenticated = false;
          this.showToast('Please open JobJourney extension and sign in first', 'error');
        } else {
          throw new Error(response.error || 'Failed to save job');
        }
      }
    } catch (error) {
      console.error('Error saving job:', error);
      this.showToast('Failed to save job. Please try again.', 'error');
      this.setButtonLoading(false);
    }
  }

  private setButtonLoading(loading: boolean) {
    if (!this.button) return;

    if (loading) {
      this.button.classList.add('saving');
      this.button.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="
            width: 12px; 
            height: 12px; 
            border: 2px solid rgba(0,0,0,0.2); 
            border-top: 2px solid black; 
            border-radius: 50%; 
            animation: spin 1s linear infinite;
          "></div>
          <span>Saving...</span>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;

      // Loading state styling - outline variant
      this.button.style.background = 'transparent';
      this.button.style.color = 'black';
      this.button.style.border = '2px solid #ccc';
      this.button.style.pointerEvents = 'none';
      this.button.style.transform = 'scale(1)';
    } else {
      this.button.classList.remove('saving');

      // Get JobJourney icon from extension resources
      const iconUrl = chrome.runtime.getURL('icon-16.png');

      this.button.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <img src="${iconUrl}" width="16" height="16" style="flex-shrink: 0; margin-bottom: 0 !important; vertical-align: middle !important;" alt="JobJourney" />
          <span>Save in JJ</span>
        </div>
      `;

      // Reset to default outline state
      this.button.style.background = 'transparent';
      this.button.style.color = 'black';
      this.button.style.border = '2px solid black';
      this.button.style.pointerEvents = 'auto';
    }
  }

  private setButtonSaved() {
    if (!this.button) return;

    this.button.classList.add('saved');

    // Success animation with scale effect
    this.button.style.transform = 'scale(1.1)';

    setTimeout(() => {
      if (this.button) {
        this.button.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0;">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Saved!</span>
          </div>
        `;

        // Success state styling - filled variant
        this.button.style.background = 'black';
        this.button.style.color = 'white';
        this.button.style.border = '2px solid black';
        this.button.style.pointerEvents = 'none';
        this.button.style.transform = 'scale(1)';
      }
    }, 100);

    // Reset button after 2.5 seconds with smooth transition
    setTimeout(() => {
      if (this.button) {
        this.button.classList.remove('saved');

        // Smooth transition back to outline variant
        this.button.style.transition = 'all 0.3s ease';
        this.setButtonLoading(false);
        this.button.style.pointerEvents = 'auto';

        // Reset transition after animation
        setTimeout(() => {
          if (this.button) {
            this.button.style.transition = 'all 0.15s ease';
          }
        }, 300);
      }
    }, 2500);
  }

  private showToast(message: string, type: 'success' | 'error') {
    // Remove existing toast
    const existingToast = document.getElementById('jobjourney-toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'jobjourney-toast';

    // Get JobJourney icon
    const iconUrl = chrome.runtime.getURL('icon-16.png');
    const icon =
      type === 'success'
        ? `<img src="${iconUrl}" width="16" height="16" style="flex-shrink: 0;" alt="JobJourney" />`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        ${icon}
        <span>${message}</span>
      </div>
    `;

    // Elegant styling
    const bgColor = type === 'success' ? '#000000' : '#dc2626';
    const borderColor = type === 'success' ? '#333333' : '#ef4444';

    toast.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: ${bgColor};
      color: white;
      border: 1px solid ${borderColor};
      border-radius: 12px;
      padding: 16px 20px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideInToast 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      max-width: 360px;
      word-wrap: break-word;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    `;

    // Add elegant animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInToast {
        from {
          transform: translateX(100%) scale(0.9);
          opacity: 0;
        }
        to {
          transform: translateX(0) scale(1);
          opacity: 1;
        }
      }
      @keyframes slideOutToast {
        from {
          transform: translateX(0) scale(1);
          opacity: 1;
        }
        to {
          transform: translateX(100%) scale(0.9);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(toast);

    // Remove toast after 4 seconds with elegant exit animation
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOutToast 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }
    }, 4000);
  }

  private removeButton() {
    // Remove the container (which contains the button)
    const container = document.getElementById('jobjourney-button-container');
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }

    // Also remove the button directly if it exists elsewhere
    if (this.button && this.button.parentNode) {
      this.button.parentNode.removeChild(this.button);
    }

    this.button = null;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new SaveJobButton();
  });
} else {
  new SaveJobButton();
}

console.log('🔵 SaveJobButton script loaded');
