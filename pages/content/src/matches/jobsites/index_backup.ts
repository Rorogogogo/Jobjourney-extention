// JobJourney Content Script for Job Sites
// Import modularized functions
import { initializeAuthMonitoring } from './authMonitoring';
import { createJobJourneyIndicator } from './indicator';
import { detectPRRequirement } from './prDetection';
import { scrapingFunctions, Job, getCurrentPlatform } from './scrapingFunctions';

// Import the working scrapers
import './linkedin-scraper';
import './indeed-scraper';
import './seek-scraper';

console.log('🔵 JobJourney content script loaded on:', window.location.href);

// Add the indicator when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createJobJourneyIndicator);
} else {
  createJobJourneyIndicator();
}

// Make Job and timeout config available globally
(window as any).Job = Job;

// Make TIMEOUT_CONFIG available to scrapers
(window as any).TIMEOUT_CONFIG = {
  PLATFORM_SCRAPING_TOTAL: 900000, // 15 minutes
  PAGE_LOAD: 60000, // 60 seconds
  JOB_PANEL_MAX_WAIT: 3000, // 3 seconds
  JOB_PANEL_MAX_ATTEMPTS: 15,
  LINKEDIN: {
    JOB_PANEL_MAX_ATTEMPTS: 30,
    JOB_PANEL_MAX_WAIT: 3000,
  },
  SEEK: {
    JOB_PANEL_MAX_ATTEMPTS: 25,
    JOB_PANEL_MAX_WAIT: 3000,
  },
};

// Helper function to check localStorage quota and cleanup if needed
function checkAndCleanupLocalStorage() {
  try {
    // Check current storage usage
    const jobsData = localStorage.getItem('jobjourney_scraped_jobs');
    if (jobsData) {
      // Rough estimate: each character is 1 byte, localStorage limit is ~5-10MB
      const sizeInBytes = new Blob([jobsData]).size;
      const sizeInMB = sizeInBytes / (1024 * 1024);

      console.log(`📊 Current localStorage usage: ${sizeInMB.toFixed(2)}MB`);

      // If approaching 3MB, clear old data
      if (sizeInMB > 3) {
        console.log('🧹 localStorage approaching quota limit, clearing old data');
        localStorage.removeItem('jobjourney_scraped_jobs');
        localStorage.removeItem('jobjourney_last_scrape');
      }
    }
  } catch (error) {
    console.warn('Failed to check localStorage usage:', error);
    // If there's any error, try to clear data
    try {
      localStorage.removeItem('jobjourney_scraped_jobs');
      localStorage.removeItem('jobjourney_last_scrape');
    } catch (clearError) {
      console.error('Failed to clear localStorage:', clearError);
    }
  }
}

// Run cleanup check when content script loads
checkAndCleanupLocalStorage();

// Interface for job data (legacy compatibility)
interface JobData {
  id: string;
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  description?: string;
  salary?: string;
  postedDate?: string;
  isRPRequired?: boolean;
  companyLogoUrl?: string;
}

// Advanced Indeed scraper helper function from working version
function scrapeIndeedJobDetailPanel(panelElement: Element, basicInfo: any = {}): any {
  console.log('Attempting to scrape Indeed detail panel...');
  if (!panelElement) {
    console.error('scrapeIndeedJobDetailPanel called with null panelElement.');
    return null;
  }

  try {
    // Extractors based on provided detail HTML
    const titleElement = panelElement.querySelector('h2[data-testid="simpler-jobTitle"]');
    const companyElement = panelElement.querySelector('span.jobsearch-JobInfoHeader-companyNameSimple');
    const locationElement = panelElement.querySelector(
      'div[data-testid="jobsearch-JobInfoHeader-companyLocation"] div:first-child',
    );
    const descriptionElement = panelElement.querySelector('#jobDescriptionText');
    const jobDetailsContainer = panelElement.querySelector('#jobDetailsSection');

    // Basic Info
    const title = titleElement?.textContent?.trim() || basicInfo.title || '';
    const company = companyElement?.textContent?.trim() || basicInfo.company || '';
    const jobUrl = basicInfo.jobUrl || window.location.href.split('?')[0] || '';

    // Location & Workplace Type
    let location = '';
    let workplaceType = '';
    if (locationElement) {
      const locationText = locationElement.textContent?.trim() || '';
      if (locationText.includes('Hybrid work')) {
        workplaceType = 'Hybrid';
        location = locationText.replace('• Hybrid work', '').trim();
      } else if (locationText.includes('Remote')) {
        workplaceType = 'Remote';
        location = locationText.replace('• Remote', '').trim();
        if (location.toLowerCase() === 'remote') location = '';
      } else {
        location = locationText;
        workplaceType = 'On-site';
      }
    }
    location = location || basicInfo.location || '';
    workplaceType = workplaceType || basicInfo.workplaceType || '';

    // Salary & Job Type from Details Panel
    let salary = '';
    let jobType = '';
    if (jobDetailsContainer) {
      const payElement = jobDetailsContainer.querySelector('[aria-label="Pay"] [data-testid*="-tile"] span');
      const jobTypeElement = jobDetailsContainer.querySelector('[aria-label="Job type"] [data-testid*="-tile"] span');

      salary = payElement?.textContent?.trim() || '';
      jobType = jobTypeElement?.textContent?.trim() || '';

      const jobTypeMatch = jobType.match(/\b(Full-time|Part-time|Contract|Temporary|Internship|Casual|Contractor)\b/i);
      jobType = jobTypeMatch ? jobTypeMatch[0] : '';
    }
    salary = salary || basicInfo.salary || '';
    jobType = jobType || basicInfo.jobType || '';

    // Description
    let description = '';
    if (descriptionElement) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = descriptionElement.innerHTML;

      // Replace <p> and <br> with newlines
      Array.from(tempDiv.querySelectorAll('p, br')).forEach(el => el.replaceWith('\n'));
      // Handle lists
      Array.from(tempDiv.querySelectorAll('li')).forEach(li => {
        li.prepend(document.createTextNode('• '));
        li.appendChild(document.createTextNode('\n'));
      });
      // Handle bold
      Array.from(tempDiv.querySelectorAll('b, strong')).forEach(strong => {
        const boldText = strong.textContent?.trim();
        if (boldText) {
          strong.replaceWith(document.createTextNode(`**${boldText}**`));
        } else {
          strong.remove();
        }
      });

      // Remove remaining HTML tags
      Array.from(tempDiv.querySelectorAll('*:not(p):not(br):not(li):not(b):not(strong)')).forEach(el => {
        if (el.parentNode) {
          el.replaceWith(...Array.from(el.childNodes));
        }
      });

      description = tempDiv.textContent || '';
      description = description.replace(/\n{3,}/g, '\n\n').trim();
    }
    description = description || basicInfo.description || '';

    // Other fields
    const postedDate = basicInfo.postedDate || '';
    const companyLogoUrl = basicInfo.companyLogoUrl || null;
    const applicantCount = basicInfo.applicantCount || '';

    if (!title || !company) {
      console.warn('Failed to extract essential details (title or company) from Indeed panel. Returning null.', {
        title,
        company,
      });
      return null;
    }

    const job = (window as any).Job.createFromIndeed({
      title,
      company,
      location,
      jobUrl,
      description,
      salary,
      postedDate,
      companyLogoUrl,
      jobType,
      workplaceType,
      applicantCount,
    });

    console.log('Successfully scraped Indeed job detail from panel:', job);
    return job;
  } catch (error) {
    console.error('Error scraping Indeed job details panel:', error);
    if (basicInfo && basicInfo.title) {
      console.warn('Returning basic info due to error during panel scraping.');
      return (window as any).Job.createFromIndeed(basicInfo);
    }
    return null;
  }
}

// Advanced scraping functions from working version
const scrapingFunctions = {
  linkedin: async (): Promise<JobData[]> => {
    console.log('=== LinkedIn Scraping Started ===');
    console.log('Current URL:', window.location.href);

    // Add initial delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const jobs: JobData[] = [];

    try {
      // Use more robust LinkedIn selectors
      const jobNodes = document.querySelectorAll(
        'div.job-card-job-posting-card-wrapper, li.scaffold-layout__list-item[data-occludable-job-id]',
      );
      console.log('Found LinkedIn job nodes:', jobNodes.length);

      // Check if already on job detail page
      const alreadyOnJobDetail =
        document.querySelector('.jobs-search__job-details--container') ||
        document.querySelector('.jobs-details__main-content');

      if (alreadyOnJobDetail && jobNodes.length === 0) {
        console.log('On standalone LinkedIn job details page, scraping current job');
        // Scrape current job detail page
        const mainContainer = document.querySelector('.job-view-layout') || document.body;
        const titleElement = mainContainer.querySelector('h1.t-24, .job-details-jobs-unified-top-card__job-title h1');
        const companyElement = mainContainer.querySelector(
          'a.topcard__org-name-link, .job-details-jobs-unified-top-card__company-name a',
        );
        const locationElement = mainContainer.querySelector(
          '.jobs-unified-top-card__subtitle-primary-grouping, .job-details-jobs-unified-top-card__primary-description-container',
        );

        if (titleElement && companyElement) {
          const job = (window as any).Job.createFromLinkedIn({
            title: titleElement.textContent?.trim() || '',
            company: companyElement.textContent?.trim() || '',
            location: locationElement?.textContent?.trim() || '',
            jobUrl: window.location.href,
            description: '',
            salary: '',
            postedDate: '',
          });

          jobs.push({
            id: `linkedin_${Date.now()}_0`,
            title: job.title,
            company: job.company,
            location: job.location,
            jobUrl: job.jobUrl,
            description: job.description,
            salary: job.salary,
            postedDate: job.postedDate,
            isRPRequired: job.isRPRequired,
          });
        }
        return jobs;
      }

      // Wait for job details panel to load
      const waitForJobDetailsPanel = async () => {
        let attempts = 0;
        const maxAttempts = 10;
        let waitTime = 300;

        while (attempts < maxAttempts) {
          const detailsPanel = document.querySelector('.jobs-search__job-details--container');
          const loadingSpinner = document.querySelector('.jobs-search__job-details--loading');
          const detailContent = document.querySelector('.jobs-details__main-content');

          if (detailsPanel && detailContent && !loadingSpinner) {
            await new Promise(r => setTimeout(r, 500));
            console.log('LinkedIn details panel detected.');
            return detailsPanel;
          }

          waitTime = Math.min(waitTime * 1.2, 1500);
          console.log(`Waiting ${waitTime}ms for LinkedIn job details panel (attempt ${attempts + 1}/${maxAttempts})`);
          await new Promise(r => setTimeout(r, waitTime));
          attempts++;
        }
        console.log('LinkedIn details panel did not load in time.');
        return null;
      };

      // Process job cards
      for (let i = 0; i < Math.min(jobNodes.length, 20); i++) {
        const node = jobNodes[i] as Element;

        try {
          console.log(`\\nProcessing LinkedIn job card ${i + 1}/${Math.min(jobNodes.length, 20)}`);

          // Extract basic info from card
          const titleNode = node.querySelector('.artdeco-entity-lockup__title');
          const companyNode = node.querySelector('.artdeco-entity-lockup__subtitle div[dir=\"ltr\"]');

          const basicInfo = {
            title: titleNode?.textContent?.trim() || '',
            company: companyNode?.textContent?.trim() || '',
            jobUrl: '',
          };

          if (!basicInfo.title) {
            console.warn(`Skipping LinkedIn card ${i + 1} due to missing title.`);
            continue;
          }

          console.log(`Basic info for LinkedIn card ${i + 1}: ${basicInfo.title} at ${basicInfo.company}`);

          // Find clickable element
          const clickableAnchor = node.querySelector('a.job-card-list__title--link');

          if (clickableAnchor && (clickableAnchor as HTMLAnchorElement).href) {
            try {
              basicInfo.jobUrl = new URL((clickableAnchor as HTMLAnchorElement).href, window.location.origin).href;
            } catch (e) {
              console.warn(`Failed to parse LinkedIn anchor href: ${(clickableAnchor as HTMLAnchorElement).href}`, e);
            }
          }

          if (!clickableAnchor) {
            console.warn(`Could not find clickable element for LinkedIn card ${i + 1}. Using basic info.`);
            const job = (window as any).Job.createFromLinkedIn(basicInfo);
            jobs.push({
              id: `linkedin_${Date.now()}_${i}`,
              title: job.title,
              company: job.company,
              location: job.location,
              jobUrl: job.jobUrl,
              description: job.description,
              salary: job.salary,
              postedDate: job.postedDate,
              isRPRequired: job.isRPRequired,
            });
            continue;
          }

          console.log(`Clicking LinkedIn job link for \"${basicInfo.title}\"`);
          (clickableAnchor as HTMLElement).click();

          // Wait for details panel
          const panelElement = await waitForJobDetailsPanel();

          let jobDetail;
          if (panelElement) {
            console.log(`LinkedIn panel loaded for job ${i + 1}. Scraping details...`);

            // Scrape from panel
            const titleElement = panelElement.querySelector(
              '.job-details-jobs-unified-top-card__job-title h1, .t-24.job-details-jobs-unified-top-card__job-title',
            );
            const companyElement = panelElement.querySelector(
              '.job-details-jobs-unified-top-card__company-name a, .jobs-details-top-card__company-url',
            );
            const locationElement = panelElement.querySelector(
              '.job-details-jobs-unified-top-card__primary-description-container, .jobs-details-top-card__job-info',
            );
            const descriptionElement = panelElement.querySelector(
              '.jobs-description__content .jobs-box__html-content, .jobs-description-content__text, div#job-details',
            );

            jobDetail = {
              title: titleElement?.textContent?.trim() || basicInfo.title,
              company: companyElement?.textContent?.trim() || basicInfo.company,
              location: locationElement?.textContent?.trim() || '',
              description: descriptionElement?.textContent?.trim() || '',
              jobUrl: basicInfo.jobUrl,
              salary: '',
              postedDate: '',
            };
          } else {
            jobDetail = basicInfo;
          }

          const job = (window as any).Job.createFromLinkedIn(jobDetail);
          jobs.push({
            id: `linkedin_${Date.now()}_${i}`,
            title: job.title,
            company: job.company,
            location: job.location,
            jobUrl: job.jobUrl,
            description: job.description,
            salary: job.salary,
            postedDate: job.postedDate,
            isRPRequired: job.isRPRequired,
          });

          console.log(`Successfully scraped LinkedIn job: ${job.title}`);

          // Delay between jobs
          const baseDelay = 800;
          console.log(`Waiting ${baseDelay}ms before next LinkedIn job click...`);
          await new Promise(r => setTimeout(r, baseDelay));
        } catch (error) {
          console.error(`Error processing LinkedIn job ${i + 1}:`, error);
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    } catch (error) {
      console.error('Error scraping LinkedIn jobs:', error);
    }

    console.log(`=== LinkedIn Scraping Complete: ${jobs.length} jobs found ===`);
    return jobs;
  },

  seek: async (): Promise<JobData[]> => {
    const jobs: JobData[] = [];
    console.log('=== SEEK Scraping Started ===');
    console.log('Current URL:', window.location.href);

    // Try multiple possible selectors for job cards
    const selectors = [
      '[data-testid="job-card"]',
      'article[data-card-type="JobCard"]',
      'article[role="article"]',
      'a[data-testid="job-card-title"]',
      '[data-automation="job-card"]',
    ];

    let jobNodes: NodeListOf<Element> = document.querySelectorAll('');
    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector);
      if (nodes.length > 0) {
        jobNodes = nodes;
        console.log('Using selector:', selector);
        break;
      }
    }

    console.log('Found SEEK job nodes:', jobNodes.length);

    // Check if we're already on a job details page
    const alreadyOnJobDetail = document.querySelector('[data-automation="jobDetailsPage"]');

    // Helper function to scrape SEEK job detail panel
    const scrapeSeekJobDetailPanel = async (basicInfo: any = {}) => {
      try {
        // Job details panel
        let panel = document.querySelector('[data-automation="jobDetailsPage"]');

        if (!panel) {
          console.log('SEEK job details panel not found on first attempt. Retrying after 0.5s...');
          await new Promise(resolve => setTimeout(resolve, 500));
          panel = document.querySelector('[data-automation="jobDetailsPage"]');
        }

        if (!panel) {
          return null;
        }

        // Title
        const titleElement = panel.querySelector('[data-automation="job-detail-title"], h1');
        const title = titleElement ? titleElement.textContent?.trim() : basicInfo.title || '';

        // Company name
        const companyElement = panel.querySelector('[data-automation="advertiser-name"]');
        const company = companyElement ? companyElement.textContent?.trim() : basicInfo.company || '';

        // Location
        const locationElement = panel.querySelector('[data-automation="job-detail-location"]');
        const location = locationElement ? locationElement.textContent?.trim() : basicInfo.location || '';

        // Job URL - use the current URL or the one from the basic info
        const jobUrl = basicInfo.jobUrl || window.location.href.split('?')[0] || '';

        // Work type (Full-time/Part-time)
        const workTypeElement = panel.querySelector('[data-automation="job-detail-work-type"]');
        const jobType = workTypeElement ? workTypeElement.textContent?.trim() : '';

        // Workplace type (Remote/Hybrid/On-site) - from basic info or try to extract from detail
        let workplaceType = basicInfo.workplaceType || '';
        if (!workplaceType) {
          // Try to find it in the location section, which sometimes contains (Remote) or (Hybrid)
          const locationText = locationElement?.textContent || '';
          if (locationText.includes('Remote')) workplaceType = 'Remote';
          else if (locationText.includes('Hybrid')) workplaceType = 'Hybrid';
          else if (locationText.includes('On-site')) workplaceType = 'On-site';
        }

        // Salary info
        const salaryElement = panel.querySelector('[data-automation="job-detail-salary"]');
        const salary = salaryElement ? salaryElement.textContent?.trim() : '';

        // Posted date - find elements that might contain the posted date
        let postedDate = '';
        const dateElements = Array.from(panel.querySelectorAll('span.gg45di0'));
        for (const el of dateElements) {
          if (el.textContent?.includes('Posted')) {
            postedDate = el.textContent.replace('Posted', '').trim();
            break;
          }
        }

        // Job description
        const descriptionElement = panel.querySelector('[data-automation="jobAdDetails"]');
        // Clean SEEK description - remove excessive newlines and trim
        const description = descriptionElement
          ? (descriptionElement as HTMLElement).innerText.replace(/\n{3,}/g, '\n\n').trim()
          : '';

        // Company logo
        const logoElement = panel.querySelector(
          '[data-testid="bx-logo-image"] img, [data-automation="advertiser-logo"] img',
        );
        const companyLogoUrl = logoElement ? (logoElement as HTMLImageElement).src : null;

        // Create the job object
        const job = (window as any).Job.createFromSEEK({
          title,
          company,
          location,
          jobUrl,
          description,
          salary,
          postedDate,
          companyLogoUrl,
          jobType,
          workplaceType,
          applicantCount: '',
        });

        console.log('Scraped SEEK job detail from panel:', job);
        return job;
      } catch (error) {
        console.error('Error scraping SEEK job details panel:', error);
        return null;
      }
    };

    // If we're on a standalone job detail page with no job cards
    if (alreadyOnJobDetail && jobNodes.length === 0) {
      console.log('On standalone job details page, scraping current job');
      const jobDetail = await scrapeSeekJobDetailPanel();
      if (jobDetail) {
        jobs.push({
          id: `seek_${Date.now()}_0`,
          title: jobDetail.title,
          company: jobDetail.company,
          location: jobDetail.location,
          jobUrl: jobDetail.jobUrl,
          description: jobDetail.description,
          salary: jobDetail.salary,
          postedDate: jobDetail.postedDate,
          isRPRequired: jobDetail.isRPRequired,
        });
      }
      return jobs;
    }

    // Function to wait for job details panel to load
    const waitForJobDetailsPanel = async () => {
      let attempts = 0;
      const maxAttempts = 20;
      let waitTime = 200;

      while (attempts < maxAttempts) {
        const detailsPanel = document.querySelector('[data-automation="jobDetailsPage"]');
        const loadingIndicator = document.querySelector('[data-automation="loading-spinner"]');

        if (detailsPanel && !loadingIndicator) {
          // Wait a bit more to ensure content is fully rendered
          await new Promise(r => setTimeout(r, 500));
          return true;
        }

        // Exponential backoff - double the wait time after each attempt
        waitTime = Math.min(waitTime * 1.5, 1500);
        console.log(`Waiting ${waitTime}ms for job details panel (attempt ${attempts + 1}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, waitTime));
        attempts++;
      }

      return false;
    };

    // Process each job card one by one
    for (let i = 0; i < Math.min(jobNodes.length, 30); i++) {
      try {
        const node = jobNodes[i];

        // Extract basic info from the card before clicking
        const titleNode = node.querySelector('[data-testid="job-card-title"], a[data-automation="jobTitle"]');
        const companyNode = node.querySelector('[data-automation="jobCompany"], span[class*="companyName"]');
        const locationNode = node.querySelector('[data-testid="jobCardLocation"], [data-automation="jobCardLocation"]');
        const jobUrlNode = titleNode?.closest('a');
        const jobUrl = (jobUrlNode as HTMLAnchorElement)?.href || window.location.href;

        // Extract the work arrangement (Remote/Hybrid/etc) from the job card if available
        const workArrangementNode = node.querySelector('[data-testid="work-arrangement"]');
        let workplaceType = '';
        if (workArrangementNode) {
          const text = workArrangementNode.textContent?.replace(/[()]/g, '').trim() || '';
          if (text.includes('Remote') || text.includes('Hybrid') || text.includes('On-site')) {
            workplaceType = text;
          }
        }

        // Basic info for fallback
        const basicInfo = {
          title: titleNode?.textContent?.trim() || '',
          company: companyNode?.textContent?.trim() || '',
          location: locationNode?.textContent?.trim() || '',
          jobUrl: jobUrl,
          workplaceType: workplaceType,
        };

        console.log(`Clicking job ${i + 1}/${Math.min(jobNodes.length, 30)}: ${basicInfo.title}`);

        // Find a suitable clickable element
        const clickableElement =
          titleNode ||
          node.querySelector('a[data-automation="job-list-item-link-overlay"]') ||
          node.querySelector('a[href*="job"]') ||
          node;

        console.log('Clicking element: ', (clickableElement as Element).tagName);

        // Click on the job card to show details
        (clickableElement as HTMLElement).click();

        // Wait for job details panel to load
        const detailsLoaded = await waitForJobDetailsPanel();

        if (detailsLoaded) {
          // Scrape the detailed job information from the panel
          const jobDetail = await scrapeSeekJobDetailPanel(basicInfo);

          if (jobDetail && Object.keys(jobDetail).length > 0) {
            // Create job with detailed info
            jobs.push({
              id: `seek_${Date.now()}_${i}`,
              title: jobDetail.title,
              company: jobDetail.company,
              location: jobDetail.location,
              jobUrl: jobDetail.jobUrl,
              description: jobDetail.description,
              salary: jobDetail.salary,
              postedDate: jobDetail.postedDate,
              isRPRequired: jobDetail.isRPRequired,
            });
            console.log(`Successfully scraped detailed job: ${jobDetail.title}`);
          } else {
            // Fallback to basic info if detailed scraping failed
            console.log(`Failed to get details, using basic info for job ${i + 1}`);
            const job = (window as any).Job.createFromSEEK(basicInfo);
            jobs.push({
              id: `seek_${Date.now()}_${i}`,
              title: job.title,
              company: job.company,
              location: job.location,
              jobUrl: job.jobUrl,
              description: job.description,
              salary: job.salary,
              postedDate: job.postedDate,
              isRPRequired: job.isRPRequired,
            });
          }
        } else {
          // Fallback to basic info if panel didn't load
          console.log(`Job details panel didn't load for job ${i + 1}, using basic info`);
          const job = (window as any).Job.createFromSEEK(basicInfo);
          jobs.push({
            id: `seek_${Date.now()}_${i}`,
            title: job.title,
            company: job.company,
            location: job.location,
            jobUrl: job.jobUrl,
            description: job.description,
            salary: job.salary,
            postedDate: job.postedDate,
            isRPRequired: job.isRPRequired,
          });
        }

        // Add a delay between job clicks to avoid rate limiting
        const baseDelay = 300;
        const totalDelay = baseDelay;
        console.log(`Waiting ${totalDelay}ms before next job click...`);
        await new Promise(r => setTimeout(r, totalDelay));
      } catch (error) {
        console.error(`Error processing job ${i + 1}:`, error);
        // Add error recovery delay
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    console.log(`=== SEEK Scraping Complete: ${jobs.length} jobs found ===`);
    return jobs;
  },

  indeed: async (): Promise<JobData[]> => {
    console.group('Indeed - Job Scraping - Click & Scrape');

    // Add initial delay
    const initialDelay = 5000;
    console.log(`Indeed: Waiting ${initialDelay}ms before starting scrape...`);
    await new Promise(resolve => setTimeout(resolve, initialDelay));

    const jobs: JobData[] = [];

    // Job card selector
    const jobCardSelector = 'div.result:not(.mosaic-zone) div.job_seen_beacon';
    let jobNodes = document.querySelectorAll(jobCardSelector);

    // Fallback selector if primary fails
    if (jobNodes.length === 0) {
      const fallbackSelector =
        'div.jobsearch-SerpJobCard, div.result, div.job_seen_beacon, li > div[class*="cardOutline"]';
      jobNodes = document.querySelectorAll(fallbackSelector);
      console.log('Fallback selector found nodes:', jobNodes.length);
    }

    console.log('Found Indeed job nodes:', jobNodes.length);

    // Check if already on job detail page
    const alreadyOnJobDetail =
      document.querySelector('div.fastviewjob') || document.querySelector('div.jobsearch-ViewJobLayout--embedded');

    // Wait for job details panel to load
    const waitForJobDetailsPanel = async () => {
      let attempts = 0;
      const maxAttempts = 10;
      let waitTime = 250;

      while (attempts < maxAttempts) {
        const detailsPanel =
          document.querySelector('div.fastviewjob') || document.querySelector('div.jobsearch-ViewJobLayout--embedded');
        const descriptionLoaded = detailsPanel && detailsPanel.querySelector('#jobDescriptionText');

        if (detailsPanel && descriptionLoaded && (descriptionLoaded.textContent?.trim().length || 0) > 10) {
          await new Promise(r => setTimeout(r, 500));
          console.log('Indeed details panel detected.');
          return detailsPanel;
        }

        waitTime = Math.min(waitTime * 1.5, 1800);
        console.log(`Waiting ${waitTime}ms for Indeed job details panel (attempt ${attempts + 1}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, waitTime));
        attempts++;
      }
      console.log('Indeed details panel did not load in time.');
      return null;
    };

    // Handle standalone job detail page
    if (alreadyOnJobDetail && jobNodes.length === 0) {
      console.log('On standalone Indeed job details page, scraping current job');
      const panelElement = await waitForJobDetailsPanel();
      if (panelElement) {
        const jobDetail = scrapeIndeedJobDetailPanel(panelElement);
        if (jobDetail) {
          jobs.push({
            id: `indeed_${Date.now()}_0`,
            title: jobDetail.title,
            company: jobDetail.company,
            location: jobDetail.location,
            jobUrl: jobDetail.jobUrl,
            description: jobDetail.description,
            salary: jobDetail.salary,
            postedDate: jobDetail.postedDate,
            isRPRequired: jobDetail.isRPRequired,
          });
          console.log(`Scraped standalone job: ${jobDetail.title}`);
        }
      }
      console.groupEnd();
      return jobs;
    }

    // Process job cards using click and scrape method
    for (let i = 0; i < Math.min(jobNodes.length, 25); i++) {
      const node = jobNodes[i] as Element;
      let basicInfo: any = {};

      try {
        console.log(`\nProcessing Indeed job card ${i + 1}/${Math.min(jobNodes.length, 25)}`);

        // Extract basic info from card
        const titleNode = node.querySelector(
          [
            'h2.jobTitle a',
            'h2 a[data-jk]',
            'h2.jobTitle span[title]',
            'a[data-jk] span[title]',
            '[class*="jobTitle"]',
            'a[id^="job_"]',
          ].join(','),
        );
        const companyNode = node.querySelector(
          [
            'span[data-testid="company-name"]',
            'span.css-1h7lukg[data-testid="company-name"]',
            'span.companyName',
            '[data-testid="company-name"]',
            'div[class*="company"] span',
            'span[class*="companyName"]',
          ].join(','),
        );
        const locationNode = node.querySelector(
          [
            'div[data-testid="text-location"]',
            'div.css-1restlb[data-testid="text-location"]',
            'div.companyLocation',
            'div[class*="location"]',
            'div[class*="workplace"]',
          ].join(','),
        );

        const metadataItems = Array.from(
          node.querySelectorAll(
            [
              '.metadataContainer li .metadata div[data-testid="attribute_snippet_testid"]',
              '.metadataContainer li div[data-testid="attribute_snippet_testid"]',
              '.metadataContainer li div[data-testid^="attribute_snippet"]',
              '.heading6.tapItem-gutter.metadataContainer .metadata',
            ].join(','),
          ),
        )
          .map(el => el?.textContent?.trim())
          .filter(text => text);

        const salaryText = metadataItems.find(text => text && (text.includes('$') || text.match(/salary|pay/i))) || '';
        const jobTypeText =
          metadataItems.find(
            text => text && /\b(Full-time|Part-time|Contract|Temporary|Internship|Casual|Contractor)\b/i.test(text),
          ) || '';
        const jobType =
          jobTypeText.match(/\b(Full-time|Part-time|Contract|Temporary|Internship|Casual|Contractor)\b/i)?.[0] || '';

        // Find job URL
        let jobUrl = '';
        const titleLink = node.querySelector('h2.jobTitle a[data-jk], a.jcs-JobTitle[data-jk]') as HTMLAnchorElement;
        if (titleLink?.href) {
          jobUrl = titleLink.href;
        } else {
          const cardLink = node.closest('a') || node.querySelector('a');
          if (cardLink && (cardLink as HTMLAnchorElement).href) {
            jobUrl = (cardLink as HTMLAnchorElement).href;
          }
        }

        if (jobUrl && !jobUrl.startsWith('http')) {
          jobUrl = new URL(jobUrl, window.location.href).href;
        }

        basicInfo = {
          title: titleNode?.textContent?.trim() || '',
          company: companyNode?.textContent?.trim() || '',
          location: locationNode?.textContent?.trim() || '',
          jobUrl: jobUrl,
          salary: salaryText,
          jobType: jobType,
        };

        if (!basicInfo.title) {
          console.warn(`Skipping card ${i + 1} due to missing title.`);
          continue;
        }

        console.log(`Basic info for card ${i + 1}: ${basicInfo.title} at ${basicInfo.company}`);

        // Click card to load details
        const clickableElement =
          node.querySelector('h2 a[data-jk], a.jcs-JobTitle[data-jk]') ||
          node.querySelector('a[id^="sj_"]') ||
          node.closest('a') ||
          titleNode ||
          node;

        if (!clickableElement) {
          console.warn(`Could not find clickable element for card ${i + 1}. Using basic info.`);
          const job = (window as any).Job.createFromIndeed(basicInfo);
          jobs.push({
            id: `indeed_${Date.now()}_${i}`,
            title: job.title,
            company: job.company,
            location: job.location,
            jobUrl: job.jobUrl,
            description: job.description,
            salary: job.salary,
            postedDate: job.postedDate,
            isRPRequired: job.isRPRequired,
          });
          continue;
        }

        console.log(
          `Clicking element for job ${i + 1}:`,
          (clickableElement as Element).tagName,
          (clickableElement as Element).className,
        );
        (clickableElement as HTMLElement).click();

        // Wait for and scrape details panel
        const panelElement = await waitForJobDetailsPanel();

        let job;
        if (panelElement) {
          console.log(`Panel loaded for job ${i + 1}. Scraping details...`);
          const jobDetail = scrapeIndeedJobDetailPanel(panelElement, basicInfo);

          if (jobDetail && jobDetail.title) {
            job = jobDetail;
            console.log(`Successfully scraped detailed Indeed job: ${job.title}`);
          } else {
            console.warn(`Detailed scraping failed for job ${i + 1}. Using basic info.`);
            job = (window as any).Job.createFromIndeed(basicInfo);
          }
        } else {
          job = (window as any).Job.createFromIndeed(basicInfo);
        }

        jobs.push({
          id: `indeed_${Date.now()}_${i}`,
          title: job.title,
          company: job.company,
          location: job.location,
          jobUrl: job.jobUrl,
          description: job.description,
          salary: job.salary,
          postedDate: job.postedDate,
          isRPRequired: job.isRPRequired,
        });

        // Delay between jobs
        const baseDelay = 300;
        console.log(`Waiting ${baseDelay}ms before next Indeed job click...`);
        await new Promise(r => setTimeout(r, baseDelay));
      } catch (error) {
        console.error(`Error processing Indeed job ${i + 1}:`, error);
        if (basicInfo.title) {
          console.log('Adding job with basic info due to error during processing.');
          const job = (window as any).Job.createFromIndeed(basicInfo);
          jobs.push({
            id: `indeed_${Date.now()}_${i}`,
            title: job.title,
            company: job.company,
            location: job.location,
            jobUrl: job.jobUrl,
            description: job.description,
            salary: job.salary,
            postedDate: job.postedDate,
            isRPRequired: job.isRPRequired,
          });
        }
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    console.log(`Scraped ${jobs.length} jobs from Indeed page`);
    console.groupEnd();
    return jobs;
  },

  reed: (): JobData[] => {
    const jobs: JobData[] = [];

    try {
      const jobElements = document.querySelectorAll('.job-result, .gtmJobListingPosting');

      jobElements.forEach((element, index) => {
        try {
          const titleElement = element.querySelector('.gtmJobListingPosting a, h3 a');
          const companyElement = element.querySelector('.gtmJobListingPosting .companyName, .company');
          const locationElement = element.querySelector('.location, .jobLocation');
          const salaryElement = element.querySelector('.salary, .jobSalary');

          const title = titleElement?.textContent?.trim() || '';
          const company = companyElement?.textContent?.trim() || '';
          const location = locationElement?.textContent?.trim() || '';
          const salary = salaryElement?.textContent?.trim() || '';
          const url = (titleElement as HTMLAnchorElement)?.href || window.location.href;

          if (title && company) {
            jobs.push({
              id: `reed_${Date.now()}_${index}`,
              title,
              company,
              location,
              url,
              salary,
              description: '',
              postedDate: '',
              isRPRequired: detectPRRequirement(''),
            });
          }
        } catch (error) {
          console.error('Error scraping Reed job:', error);
        }
      });
    } catch (error) {
      console.error('Error scraping Reed jobs:', error);
    }

    return jobs;
  },
};

// Authentication monitoring for JobJourney domains
const initializeAuthMonitoring = () => {
  if (window.location.hostname.includes('jobjourney.me') || window.location.hostname.includes('localhost')) {
    console.log('🔐 JobJourney domain detected - setting up event-driven auth monitoring');

    // Store monitoring state and last known auth state for change detection
    (window as any).authMonitoringActive = true;
    (window as any).lastAuthState = null;
    (window as any).lastAuthData = null; // Track full auth data for comparison

    // Check current auth status immediately (but not on auth/sign-in pages)
    const isAuthPage =
      window.location.pathname.includes('extension-auth') ||
      window.location.pathname.includes('sign-in') ||
      window.location.pathname.includes('login') ||
      window.location.search.includes('source=extension');

    // Always perform initial auth check, but with special handling for auth pages
    setTimeout(() => {
      if ((window as any).authMonitoringActive) {
        if (isAuthPage) {
          console.log('🔐 Auth page detected - performing silent initial auth sync');
          (window as any).isAuthPageInitialCheck = true; // Flag for silent sync
        }
        checkAndSyncAuthStatus();
      }
    }, 500); // Initial detection after page load

    // No periodic polling - purely event-driven for better performance
    // Auth changes will be detected instantly via localStorage monitoring

    // Set up localStorage event listener for immediate detection
    window.addEventListener('storage', e => {
      if (e.key === 'auth' && (window as any).authMonitoringActive) {
        console.log('🔍 localStorage auth change detected via storage event');
        setTimeout(() => checkAndSyncAuthStatus(), 50); // Small delay to ensure DOM updates
      }
    });

    // Override localStorage methods for instant detection (KEY IMPROVEMENT!)
    monitorLocalStorageChanges();

    // Set up lightweight URL change detection (no heavy DOM watching)
    let lastUrl = window.location.href;
    const checkUrlChange = () => {
      if (!(window as any).authMonitoringActive) return;

      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('🔍 URL change detected, checking auth status');
        setTimeout(() => checkAndSyncAuthStatus(), 300);
      }
    };

    // Check URL changes only on user interaction (much more efficient)
    window.addEventListener('popstate', checkUrlChange);
    window.addEventListener('pushstate', checkUrlChange); // For SPA navigation

    // Lightweight observer for auth-specific changes only
    const observer = new MutationObserver(mutations => {
      if (!(window as any).authMonitoringActive) return;

      // Only check if auth-related elements might have changed
      let shouldCheck = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const addedNodes = Array.from(mutation.addedNodes);
          const removedNodes = Array.from(mutation.removedNodes);
          for (const node of [...addedNodes, ...removedNodes]) {
            if (node.nodeType === 1) {
              const element = node as Element;
              const text = element.textContent?.toLowerCase() || '';
              const className = element.className?.toString().toLowerCase() || '';

              if (
                text.includes('sign') ||
                text.includes('login') ||
                text.includes('auth') ||
                className.includes('auth') ||
                className.includes('login') ||
                className.includes('user')
              ) {
                shouldCheck = true;
                break;
              }
            }
          }
        }
        if (shouldCheck) break;
      }

      if (shouldCheck) {
        console.log('🔍 Auth-related DOM change detected');
        setTimeout(() => checkAndSyncAuthStatus(), 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
    });

    // Listen for extension context invalidation
    window.addEventListener('beforeunload', () => {
      (window as any).authMonitoringActive = false;
    });

    // Listen for extension storage bridge messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('🔵 JobJourney page received message:', message.type);

      if (message.type === 'EXTENSION_SIGN_OUT_COMMAND') {
        handleExtensionSignOutCommand(sendResponse);
        return true; // Keep message channel open for async response
      }

      if (message.type === 'EXTENSION_JOBS_PROCESSED') {
        try {
          const { jobs, config, timestamp, source } = message.data;
          console.log(`📋 Received ${jobs.length} jobs directly from extension`);

          // Dispatch custom event to the page
          const customEvent = new CustomEvent('extension-jobs-processed', {
            detail: {
              jobs: jobs,
              config: config,
              timestamp: timestamp,
              source: source,
            },
          });

          window.dispatchEvent(customEvent);
          console.log('✅ Jobs data dispatched to page');

          sendResponse({ success: true, message: 'Jobs received and dispatched' });
        } catch (error) {
          console.error('❌ Error handling extension jobs:', error);
          sendResponse({ success: false, error: (error as Error).message });
        }
      }

      return true; // Keep message channel open for async response
    });

    console.log('✅ Authentication monitoring initialized');
  }
};

/**
 * Check current authentication status and sync with extension
 */
const checkAndSyncAuthStatus = () => {
  try {
    // Check if monitoring is still active and extension context is valid
    if (!(window as any).authMonitoringActive) {
      console.log('🔄 Auth monitoring disabled, skipping check');
      return;
    }

    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      console.log('🔄 Extension context invalidated, stopping auth monitoring');
      (window as any).authMonitoringActive = false;
      return;
    }

    const authData = detectAuthenticationData();
    const currentAuthState = authData ? 'authenticated' : 'unauthenticated';
    const lastAuthState = (window as any).lastAuthState;
    const lastAuthData = (window as any).lastAuthData;

    // Compare both state and data to detect meaningful changes
    const authDataChanged = JSON.stringify(authData) !== JSON.stringify(lastAuthData);
    const stateChanged = currentAuthState !== lastAuthState;

    // Special handling for auth pages - don't send "signed out" messages during sign-in process
    const isAuthPage =
      window.location.pathname.includes('extension-auth') ||
      window.location.pathname.includes('sign-in') ||
      window.location.pathname.includes('login') ||
      window.location.search.includes('source=extension');

    // Check if this is an initial auth page check
    const isAuthPageInitialCheck = (window as any).isAuthPageInitialCheck;
    if (isAuthPageInitialCheck) {
      (window as any).isAuthPageInitialCheck = false; // Clear flag after first use
    }

    const shouldSkipSignOutMessage =
      isAuthPage &&
      currentAuthState === 'unauthenticated' &&
      (lastAuthState === null || lastAuthState === 'pending') &&
      !isAuthPageInitialCheck; // Allow sync on initial check

    // Skip initial detection if this is the first check on a new tab
    // This prevents false "sign in" toasts when opening existing authenticated tabs
    // BUT we should still sync with extension if extension doesn't know about auth
    const isInitialCheck = lastAuthState === null;
    const shouldSkipInitialAuthMessage = isInitialCheck && currentAuthState === 'authenticated' && !isAuthPage;

    // Handle auth data messaging with smarter logic to prevent duplicate toasts
    if (authData && !shouldSkipSignOutMessage) {
      // We have auth data - decide whether to send message
      const shouldSendAuthMessage = (stateChanged || authDataChanged) && !shouldSkipInitialAuthMessage;

      if (shouldSendAuthMessage) {
        console.log(`🔄 Auth changed: ${lastAuthState} → ${currentAuthState}`, { dataChanged: authDataChanged });

        // Send auth data with a flag indicating if this should trigger a toast
        // Don't show toast on auth pages even for real changes
        const shouldShowToast = !isAuthPage;

        try {
          chrome.runtime.sendMessage(
            {
              type: 'AUTH_DETECTED',
              data: authData,
              shouldShowToast: shouldShowToast,
            },
            response => {
              if (chrome.runtime?.lastError) {
                const errorMessage = chrome.runtime.lastError.message || '';
                if (errorMessage.includes('Extension context invalidated')) {
                  console.log('🔄 Extension context invalidated during auth sync');
                  return;
                }
                console.warn('Failed to send auth data:', errorMessage);
              } else if (response) {
                console.log('✅ Auth data synced with extension:', response);
              }
            },
          );
        } catch (contextError) {
          console.log('🔄 Extension context invalidated during message send');
          return;
        }
      } else if (shouldSkipInitialAuthMessage || isAuthPageInitialCheck) {
        // Sync with extension but don't trigger toast (silent sync)
        const syncReason = isAuthPageInitialCheck ? 'auth page initial check' : 'existing tab';
        console.log(`🔐 Initial auth detected on ${syncReason} - syncing with extension without toast`);

        try {
          chrome.runtime.sendMessage(
            {
              type: 'AUTH_DETECTED',
              data: authData,
              shouldShowToast: false, // Silent sync, no toast
            },
            response => {
              if (chrome.runtime?.lastError) {
                const errorMessage = chrome.runtime.lastError.message || '';
                if (errorMessage.includes('Extension context invalidated')) {
                  console.log('🔄 Extension context invalidated during auth sync');
                  return;
                }
                console.warn('Failed to send auth data:', errorMessage);
              } else if (response) {
                console.log('✅ Auth data synced with extension (silent):', response);
              }
            },
          );
        } catch (contextError) {
          console.log('🔄 Extension context invalidated during message send');
          return;
        }
      } else {
        console.log('🔍 Auth status unchanged - still authenticated');
      }

      // Always update state tracking
      (window as any).lastAuthState = currentAuthState;
      (window as any).lastAuthData = authData;
    } else if (!authData && (stateChanged || authDataChanged || isInitialCheck) && !shouldSkipSignOutMessage) {
      // No authentication found - send to extension for consistency
      const wasAuthenticated = lastAuthState === 'authenticated';
      const isFirstCheck = lastAuthState === null;

      if (wasAuthenticated) {
        console.log(`🔄 Auth changed: ${lastAuthState} → ${currentAuthState}`, { dataChanged: authDataChanged });
        console.log('🔓 No authentication detected - user signed out');

        try {
          chrome.runtime.sendMessage(
            {
              type: 'AUTH_CLEARED',
              shouldShowToast: true, // Real sign-out, show toast
            },
            response => {
              if (chrome.runtime?.lastError) {
                const errorMessage = chrome.runtime.lastError.message || '';
                if (errorMessage.includes('Extension context invalidated')) {
                  console.log('🔄 Extension context invalidated during auth clear');
                  return;
                }
              } else if (response) {
                console.log('✅ Auth cleared in extension');
              }
            },
          );
        } catch (contextError) {
          console.log('🔄 Extension context invalidated during auth clear');
        }
      } else if (isFirstCheck || isAuthPageInitialCheck) {
        // Initial check found no auth - sync with extension to ensure consistency
        const syncReason = isAuthPageInitialCheck ? 'auth page initial check' : 'initial check';
        console.log(`🔍 ${syncReason}: No auth found - syncing with extension for consistency`);

        try {
          chrome.runtime.sendMessage(
            {
              type: 'AUTH_CLEARED',
              shouldShowToast: false, // Silent sync, no toast for initial check
            },
            response => {
              if (chrome.runtime?.lastError) {
                const errorMessage = chrome.runtime.lastError.message || '';
                if (errorMessage.includes('Extension context invalidated')) {
                  console.log('🔄 Extension context invalidated during initial auth sync');
                  return;
                }
              } else if (response) {
                console.log('✅ Initial auth state synced with extension (unauthenticated)');
              }
            },
          );
        } catch (contextError) {
          console.log('🔄 Extension context invalidated during initial auth sync');
        }
      } else {
        console.log('🔍 No auth detected but was already unauthenticated - no message needed');
      }

      // Update state tracking
      (window as any).lastAuthState = currentAuthState;
      (window as any).lastAuthData = authData;
    } else if (shouldSkipSignOutMessage) {
      console.log('🔐 Skipping sign-out message on auth page to prevent false toast');
      // Update state tracking without sending messages
      (window as any).lastAuthState = currentAuthState;
      (window as any).lastAuthData = authData;
    } else if (!authData) {
      // Still unauthenticated, no change
      console.log('🔍 Auth status unchanged - still unauthenticated');
    }
  } catch (error) {
    console.warn('Error in auth monitoring:', error);
  }
};

/**
 * Monitor localStorage changes for instant auth detection
 * This is our PRIMARY detection method - event-driven, zero CPU when idle
 * Only triggers when JobJourney actually changes auth data
 */
const monitorLocalStorageChanges = () => {
  console.log('🔧 Setting up event-driven localStorage monitoring');

  // Store original methods
  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;
  const originalClear = localStorage.clear;

  // Define all possible auth keys to monitor (matching original extension)
  const authKeys = ['auth', 'authToken', 'token', 'jwt', 'user', 'userData', 'jobjourney_token', 'jobjourney_user'];

  // Override setItem to detect auth changes instantly
  localStorage.setItem = function (key: string, value: string) {
    originalSetItem.apply(this, [key, value]);

    // Check if it's any auth-related key
    if (
      authKeys.some(authKey => key.toLowerCase().includes(authKey.toLowerCase())) &&
      (window as any).authMonitoringActive
    ) {
      console.log('🔐 Auth-related localStorage WRITE detected:', key);
      setTimeout(() => checkAndSyncAuthStatus(), 10); // Ultra-fast detection
    }
  };

  // Override removeItem to detect logout instantly
  localStorage.removeItem = function (key: string) {
    originalRemoveItem.apply(this, [key]);

    if (
      authKeys.some(authKey => key.toLowerCase().includes(authKey.toLowerCase())) &&
      (window as any).authMonitoringActive
    ) {
      console.log('🔓 Auth-related localStorage REMOVAL detected:', key);
      setTimeout(() => checkAndSyncAuthStatus(), 10); // Ultra-fast detection
    }
  };

  // Override clear to detect full logout
  localStorage.clear = function () {
    originalClear.apply(this);

    if ((window as any).authMonitoringActive) {
      console.log('🔓 localStorage CLEAR detected - checking auth status');
      setTimeout(() => checkAndSyncAuthStatus(), 10);
    }
  };

  console.log('✅ localStorage monitoring installed');
};

/**
 * Detect authentication data from the current page
 */
const detectAuthenticationData = () => {
  console.log('🔍 Checking for authentication data...');

  // First check for the main auth object used by JobJourney
  const authKey = 'auth';
  const authData = localStorage.getItem(authKey);
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      let token = null;
      let userData = null;

      if (parsed.token) {
        token = parsed.token;
        console.log(`🔑 Found token in localStorage[${authKey}]:`, token.substring(0, 20) + '...');
      }
      if (parsed.data || parsed.user) {
        userData = parsed.data || parsed.user;
        console.log(`👤 Found user data in localStorage[${authKey}]:`, userData);
        console.log('👤 User data structure:', {
          id: userData?.id,
          email: userData?.email,
          firstName: userData?.firstName,
          lastName: userData?.lastName,
          phoneNumber: userData?.phoneNumber,
          userName: userData?.userName,
          profilePictureUrl: userData?.profilePictureUrl,
          title: userData?.title,
          location: userData?.location,
          websiteUrl: userData?.websiteUrl,
          linkedinUrl: userData?.linkedinUrl,
          githubUrl: userData?.githubUrl,
          summary: userData?.summary,
          isPro: userData?.isPro,
          proEndDateUtc: userData?.proEndDateUtc,
          isProActive: userData?.isProActive,
          freeTrialCount: userData?.freeTrialCount,
          createdOnUtc: userData?.createdOnUtc,
          editedOnUtc: userData?.editedOnUtc,
          deletedOnUtc: userData?.deletedOnUtc,
        });
      }

      if (token && userData) {
        return { token, user: userData };
      }
    } catch (e) {
      console.warn('Error parsing auth data:', e);
    }
  }

  // Fallback: check other possible keys
  const tokenKeys = [
    'authToken',
    'token',
    'jwt',
    'accessToken',
    'access_token',
    'jobjourney_token',
    'jobjourney_auth_token',
    'auth_token',
    'bearer_token',
    'authorization',
    'Authorization',
  ];

  const userKeys = [
    'user',
    'userData',
    'userInfo',
    'currentUser',
    'profile',
    'jobjourney_user',
    'jobjourney_user_data',
    'auth_user',
  ];

  let token = null;
  let userData = null;

  // Check for token
  for (const key of tokenKeys) {
    const value = localStorage.getItem(key);
    if (value) {
      token = value;
      console.log(`🔑 Found token in localStorage[${key}]:`, value.substring(0, 20) + '...');
      break;
    }
  }

  // Check for user data
  for (const key of userKeys) {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        userData = JSON.parse(value);
        console.log(`👤 Found user data in localStorage[${key}]:`, userData);
        break;
      } catch (e) {
        // Not JSON, treat as string
        userData = { email: value };
        console.log(`👤 Found user string in localStorage[${key}]:`, value);
        break;
      }
    }
  }

  if (token) {
    return { token, user: userData };
  }

  console.log('🔍 No authentication data found');
  return null;
};

/**
 * Handle sign-out command from extension
 * This triggers the JobJourney frontend's logout function
 */
function handleExtensionSignOutCommand(sendResponse: (response: any) => void): void {
  try {
    console.log('🔓 Extension sign-out command received - triggering frontend logout');

    // Try to trigger sign-out via the JobJourney frontend
    // We'll dispatch a custom event that the frontend can listen for
    const signOutEvent = new CustomEvent('extension-sign-out-request', {
      detail: {
        source: 'extension',
        timestamp: Date.now(),
      },
    });

    window.dispatchEvent(signOutEvent);

    // Also try to access the logout function directly if available
    // This is a backup approach in case the event listener isn't set up
    try {
      // Check if the logout function is available in global scope or React context
      if ((window as any).jobJourneyLogout && typeof (window as any).jobJourneyLogout === 'function') {
        console.log('🔓 Calling global logout function');
        (window as any).jobJourneyLogout();
      } else {
        // Try to find and click the logout button as a last resort
        const logoutButton = document.querySelector(
          '[data-testid="logout-button"], button[class*="logout"], a[href*="logout"]',
        );
        if (logoutButton) {
          console.log('🔓 Clicking logout button');
          (logoutButton as HTMLElement).click();
        }
      }
    } catch (directLogoutError) {
      console.log('🔓 Direct logout failed, relying on event dispatch:', directLogoutError);
    }

    sendResponse({
      success: true,
      message: 'Sign-out command dispatched to JobJourney frontend',
    });
  } catch (error) {
    console.error('❌ Failed to handle extension sign-out command:', error);
    sendResponse({
      success: false,
      error: 'Failed to trigger sign-out in JobJourney frontend',
    });
  }
}

// Overlay functionality
function showScrapingOverlay(message: string, submessage?: string) {
  // Remove existing overlay if any
  hideScrapingOverlay();

  const overlay = document.createElement('div');
  overlay.id = 'jobjourney-scraping-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 999999;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 28px;
    text-align: center;
  `;

  const messageEl = document.createElement('div');
  messageEl.textContent = message;
  messageEl.style.cssText = `
    font-size: 36px;
    font-weight: bold;
    margin-bottom: 10px;
  `;

  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 60px;
    height: 60px;
    border: 6px solid rgba(255, 255, 255, 0.3);
    border-top: 6px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 30px 0;
  `;

  const submessageEl = document.createElement('div');
  if (submessage) {
    submessageEl.textContent = submessage;
    submessageEl.style.cssText = `
      font-size: 24px;
      opacity: 0.8;
      margin-top: 10px;
    `;
  }

  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  overlay.appendChild(messageEl);
  overlay.appendChild(spinner);
  if (submessage) overlay.appendChild(submessageEl);

  document.body.appendChild(overlay);
  console.log('🔄 Scraping overlay shown:', message);
}

function hideScrapingOverlay() {
  const overlay = document.getElementById('jobjourney-scraping-overlay');
  if (overlay) {
    overlay.remove();
    console.log('✅ Scraping overlay hidden');
  }
}

// Message listener for scraping commands and overlay
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_OVERLAY') {
    showScrapingOverlay(message.data.message, message.data.submessage);
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'HIDE_OVERLAY') {
    hideScrapingOverlay();
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'CLEAR_SCRAPED_JOBS') {
    console.log('🧹 Clearing scraped jobs from localStorage');
    try {
      // Clear only job-related data, preserve user preferences
      localStorage.removeItem('jobjourney_scraped_jobs');
      localStorage.removeItem('jobjourney_last_scrape');

      // Define keys to preserve (user preferences)
      const keysToPreserve = [
        'jobjourney_keywords',
        'jobjourney_country',
        'jobjourney_location',
        'jobjourney_platforms',
      ];

      // Clear other jobjourney_ keys except user preferences
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('jobjourney_') && !keysToPreserve.includes(key)) {
          localStorage.removeItem(key);
        }
      }
      console.log('✅ Cleared scraped job data from localStorage (preserved user preferences)');
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to clear scraped jobs:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }

  if (message.type === 'START_SCRAPING') {
    const platform = getCurrentPlatform();

    if (!platform || !scrapingFunctions[platform as keyof typeof scrapingFunctions]) {
      sendResponse({
        success: false,
        error: `Unsupported platform: ${platform}`,
      });
      return;
    }

    try {
      console.log(`🔧 Starting to scrape ${platform}...`);

      // Add a small delay to ensure page is loaded
      setTimeout(async () => {
        try {
          // Handle async scrapers (Indeed, LinkedIn, SEEK)
          let jobs: JobData[] = [];
          let nextUrl: string | null = null;

          if (platform === 'linkedin' && (window as any).linkedInScraper) {
            const result = await (window as any).linkedInScraper.scrapeJobList();
            const rawJobs = result.jobs || [];
            nextUrl = result.nextUrl || null;
            // Convert Job objects to JobData format
            jobs = rawJobs.map((job: any, index: number) => ({
              id: `linkedin_${Date.now()}_${index}`,
              title: job.title || '',
              company: job.company || '',
              location: job.location || '',
              jobUrl: job.jobUrl || '',
              description: job.description || '',
              salary: job.salary || '',
              postedDate: job.postedDate || '',
              isRPRequired: job.isRPRequired || false,
            }));
          } else if (platform === 'indeed' && (window as any).indeedScraper) {
            const result = await (window as any).indeedScraper.scrapeJobList();
            const rawJobs = result.jobs || [];
            nextUrl = result.nextUrl || null;
            // Convert Job objects to JobData format
            jobs = rawJobs.map((job: any, index: number) => ({
              id: `indeed_${Date.now()}_${index}`,
              title: job.title || '',
              company: job.company || '',
              location: job.location || '',
              jobUrl: job.jobUrl || '',
              description: job.description || '',
              salary: job.salary || '',
              postedDate: job.postedDate || '',
              isRPRequired: job.isRPRequired || false,
            }));
          } else if (platform === 'seek' && (window as any).seekScraper) {
            const result = await (window as any).seekScraper.scrapeJobList();
            const rawJobs = result.jobs || [];
            nextUrl = result.nextUrl || null;
            // Convert Job objects to JobData format
            jobs = rawJobs.map((job: any, index: number) => ({
              id: `seek_${Date.now()}_${index}`,
              title: job.title || '',
              company: job.company || '',
              location: job.location || '',
              jobUrl: job.jobUrl || '',
              description: job.description || '',
              salary: job.salary || '',
              postedDate: job.postedDate || '',
              isRPRequired: job.isRPRequired || false,
            }));
          } else {
            jobs = (scrapingFunctions[platform as keyof typeof scrapingFunctions] as () => JobData[])();
          }

          console.log(`✅ Scraped ${jobs.length} jobs from ${platform}`);

          chrome.runtime.sendMessage({
            type: 'SCRAPING_RESULT',
            data: { jobs, platform, nextUrl },
          });

          sendResponse({
            success: true,
            data: { jobs, platform, count: jobs.length },
          });
        } catch (error) {
          console.error(`❌ Error during ${platform} scraping:`, error);

          chrome.runtime.sendMessage({
            type: 'SCRAPING_RESULT',
            data: { jobs: [], error: (error as Error).message, platform },
          });

          sendResponse({
            success: false,
            error: (error as Error).message,
          });
        }
      }, 1000);

      return true; // Keep message channel open for async response
    } catch (error) {
      console.error('Error in scraping handler:', error);
      sendResponse({
        success: false,
        error: (error as Error).message,
      });
      return false;
    }
  }
  return false;
});

// Initialize based on platform
const platform = getCurrentPlatform();
if (platform === 'jobjourney') {
  initializeAuthMonitoring();
} else if (platform) {
  console.log(`📍 Detected platform: ${platform}`);
  console.log('🎯 Ready to scrape jobs when requested');
}

// Export for potential use by other scripts
(window as any).jobJourneyContentScript = {
  platform,
  scrapingFunctions,
  getCurrentPlatform,
};
