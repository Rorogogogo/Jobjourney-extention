// Job data extraction for different platforms
import { analyzeJobDescription } from '../descriptionAnalysis';
import type { JobData, Platform } from './types';

export class JobDataExtractor {
  static extractJobData(platform: Platform): JobData | null {
    try {
      let jobData: JobData | null = null;

      switch (platform) {
        case 'linkedin':
          jobData = this.extractLinkedInJobData();
          break;
        case 'indeed':
          jobData = this.extractIndeedJobData();
          break;
        case 'seek':
          jobData = this.extractSeekJobData();
          break;
        case 'jora':
          jobData = this.extractJoraJobData();
          break;
        case 'reed':
          jobData = this.extractReedJobData();
          break;
        case 'macquarie':
          jobData = this.extractMacquarieJobData();
          break;
        case 'atlassian':
          jobData = this.extractAtlassianJobData();
          break;
        case 'westpac':
          jobData = this.extractWestpacJobData();
          break;
        case 'canva':
          jobData = this.extractCanvaJobData();
          break;
        default:
          return null;
      }

      if (jobData && jobData.description) {
        jobData.analysis = analyzeJobDescription(jobData.description);
      }

      return jobData;
    } catch (error) {
      console.warn(`Error extracting ${platform} job data:`, error);
      return null;
    }
  }

  private static extractLinkedInJobData(): JobData | null {
    // First check if we're on a job detail page by checking the URL
    const url = window.location.href;

    // LinkedIn job detail pages have URLs like:
    // 1. https://www.linkedin.com/jobs/view/123456789/
    // 2. https://www.linkedin.com/jobs/collections/...?currentJobId=123456789
    // 3. https://www.linkedin.com/jobs/search-results/?currentJobId=123456789
    // We should show button when there's a specific currentJobId parameter OR on /jobs/view/ pages
    const hasCurrentJobId = url.includes('currentJobId=');
    const isDirectJobView = url.includes('/jobs/view/');

    if (!hasCurrentJobId && !isDirectJobView) {
      console.log('LinkedIn: Not on a job detail page - no currentJobId or direct view');
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

  private static extractIndeedJobData(): JobData | null {
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
      jobUrl: window.location.href,
      description: descriptionElement?.textContent?.trim() || '',
      employmentTypes: jobTypeElement?.textContent?.trim() || '',
      platform: 'Indeed',
      companyLogoUrl: companyLogoUrl,
    };
  }

  private static extractSeekJobData(): JobData | null {
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
      jobUrl: window.location.href,
      description: descriptionElement?.textContent?.trim() || '',
      employmentTypes: workTypeElement?.textContent?.trim() || '',
      platform: 'SEEK',
      companyLogoUrl: companyLogoUrl,
    };
  }

  private static extractJoraJobData(): JobData | null {
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
      panel?.querySelector(
        '.job-description-container, .job-description, .job-view-body, [data-testid="job-description"]',
      ) || panel;

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

    const badgeTexts = Array.from(panel?.querySelectorAll('.badge .content') || [])
      .map(el => el.textContent?.trim() || '')
      .filter(Boolean);

    const jobTypeBadge = badgeTexts.find(text => /full time|part time|contract|permanent|casual/i.test(text));
    const workArrangementBadge = badgeTexts.find(text => /hybrid|remote|on[- ]?site/i.test(text));

    const rawDescription = descriptionElement?.textContent?.trim() || '';
    const description = rawDescription
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const companyLogoUrl =
      (panel?.querySelector('.job-view-company-logo img, .company-logo img') as HTMLImageElement)?.src || undefined;

    return {
      title: titleElement?.textContent?.trim() || '',
      company: companyElement?.textContent?.trim() || '',
      location: locationElement?.textContent?.trim() || '',
      jobUrl,
      description,
      employmentTypes: jobTypeBadge || '',
      workArrangement: workArrangementBadge || '',
      platform: 'Jora',
      companyLogoUrl,
    };
  }

  private static extractReedJobData(): JobData | null {
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

  private static extractMacquarieJobData(): JobData | null {
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
      jobUrl: window.location.href,
      description: description.trim(),
      employmentTypes: employmentTypeElement?.textContent?.trim() || '',
      platform: 'Macquarie Group',
      companyLogoUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Macquarie_Group_logo.jpg',
    };
  }

  private static extractAtlassianJobData(): JobData | null {
    // Check if we're on a job detail page by checking URL pattern
    const url = window.location.href;
    if (!url.includes('/careers/details/')) {
      console.log('Atlassian: Not on a job detail page');
      return null;
    }

    // Extract job information based on the provided HTML structure
    const titleElement = document.querySelector('.default.heading');

    if (!titleElement) {
      console.warn('Atlassian: Could not find job title');
      return null;
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
      employmentTypes: department, // Use department as employment type
      platform: 'Atlassian',
      companyLogoUrl: 'https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/favicon-32x32.png',
    };
  }

  private static extractWestpacJobData(): JobData | null {
    // Check if we're on a job detail page by checking URL pattern
    const url = window.location.href;
    if (!url.includes('/job/')) {
      console.log('Westpac: Not on a job detail page');
      return null;
    }

    // Extract job information based on the Oracle HCM structure
    const titleElement = document.querySelector('.job-details__title');

    if (!titleElement) {
      console.warn('Westpac: Could not find job title');
      return null;
    }

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

  private static extractCanvaJobData(): JobData | null {
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
      employmentTypes: jobSchedule,
      platform: 'Canva',
      companyLogoUrl: 'https://www.pngmart.com/files/23/Canva-Logo-PNG-Picture.png',
    };
  }
}
