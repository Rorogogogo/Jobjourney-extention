// Scraping functions for different job platforms
import { detectPRRequirement } from './prDetection';
import {
  analyzeJobDescription,
  JobAnalysisResult,
  WorkArrangementResult,
  EmploymentTypeResult,
  ExperienceLevelResult,
  TechStackResult,
} from './descriptionAnalysis';

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
  // New fields (optional for legacy)
  detectedWorkArrangement?: WorkArrangementResult;
  detectedEmploymentType?: EmploymentTypeResult;
  detectedExperienceLevel?: ExperienceLevelResult;
  techStack?: TechStackResult;
  platform?: string;
}

// Enhanced Job class from working version
export class Job {
  public title: string;
  public company: string;
  public location: string;
  public jobUrl: string;
  public description: string;
  public salary: string;
  public postedDate: string;
  public companyLogoUrl: string | null;
  public platform: string;
  public jobType: string;
  public workplaceType: string;
  public applicantCount: string;
  public isRPRequired: boolean;

  // New analysis fields
  public analysis: JobAnalysisResult;

  constructor({
    title,
    company,
    location,
    jobUrl,
    description = '',
    salary = '',
    postedDate = '',
    companyLogoUrl = null,
    platform,
    jobType = '',
    workplaceType = '',
    applicantCount = '',
  }: {
    title: string;
    company: string;
    location: string;
    jobUrl: string;
    description?: string;
    salary?: string;
    postedDate?: string;
    companyLogoUrl?: string | null;
    platform: string;
    jobType?: string;
    workplaceType?: string;
    applicantCount?: string;
  }) {
    this.title = title?.trim() || '';
    this.company = company?.trim() || '';
    this.location = location?.trim() || '';
    this.jobUrl = jobUrl || '';
    this.description = description?.trim() || '';
    this.salary = salary?.trim() || '';
    this.postedDate = postedDate?.trim() || '';
    this.companyLogoUrl = companyLogoUrl || null;
    this.platform = platform || '';
    this.jobType = jobType?.trim() || '';
    this.workplaceType = workplaceType?.trim() || '';
    this.applicantCount = applicantCount?.trim() || '';

    // Analyze description for PR requirement using utility function
    const prResult = detectPRRequirement(this.description);
    this.isRPRequired = prResult.isRPRequired;

    // Perform comprehensive analysis
    this.analysis = analyzeJobDescription(this.description);
  }

  // Custom JSON serialization to ensure proper field names
  toJSON() {
    return {
      title: this.title,
      company: this.company,
      location: this.location,
      jobUrl: this.jobUrl, // Ensure this is jobUrl not url
      description: this.description,
      salary: this.salary,
      postedDate: this.postedDate,
      companyLogoUrl: this.companyLogoUrl, // Ensure this is included
      platform: this.platform,
      jobType: this.jobType,
      workplaceType: this.workplaceType,
      applicantCount: this.applicantCount,
      isRPRequired: this.isRPRequired,

      // Include new analysis results
      detectedWorkArrangement: this.analysis.workArrangement,
      detectedEmploymentType: this.analysis.employmentType,
      detectedExperienceLevel: this.analysis.experienceLevel,
      techStack: this.analysis.techStack,

      extracted_at: this.postedDate || null,
      id: `${this.platform.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    };
  }

  static createFromLinkedIn(data: any) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'LinkedIn',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || '',
    });
  }

  static createFromSEEK(data: any) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'SEEK',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || '',
    });
  }

  static createFromIndeed(data: any) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'Indeed',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || '',
    });
  }

  static createJoraJob(data: any) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.link || data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate || data.datePosted,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'Jora',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || '',
    });
  }
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
    const descriptionElement =
      panelElement.querySelector('#jobDescriptionText') ||
      panelElement.querySelector('.jobsearch-JobComponent-description') ||
      panelElement.querySelector('.jobsearch-embeddedBody') ||
      panelElement.querySelector('.jobsearch-JobComponent-embeddedBody');
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

    const job = Job.createFromIndeed({
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
      return Job.createFromIndeed(basicInfo);
    }
    return null;
  }
}

// Advanced scraping functions from working version
export const scrapingFunctions = {
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
          const job = Job.createFromLinkedIn({
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
            companyLogoUrl: job.companyLogoUrl || undefined,
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
            const job = Job.createFromLinkedIn(basicInfo);
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
              companyLogoUrl: job.companyLogoUrl || undefined,
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

          const job = Job.createFromLinkedIn(jobDetail);
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
            companyLogoUrl: job.companyLogoUrl || undefined,
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
        const job = Job.createFromSEEK({
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
          companyLogoUrl: jobDetail.companyLogoUrl || undefined,
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
              companyLogoUrl: jobDetail.companyLogoUrl || undefined,
            });
            console.log(`Successfully scraped detailed job: ${jobDetail.title}`);
          } else {
            // Fallback to basic info if detailed scraping failed
            console.log(`Failed to get details, using basic info for job ${i + 1}`);
            const job = Job.createFromSEEK(basicInfo);
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
              companyLogoUrl: job.companyLogoUrl || undefined,
            });
          }
        } else {
          // Fallback to basic info if panel didn't load
          console.log(`Job details panel didn't load for job ${i + 1}, using basic info`);
          const job = Job.createFromSEEK(basicInfo);
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
            companyLogoUrl: job.companyLogoUrl || undefined,
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

  jora: (): JobData[] => {
    const jobs: JobData[] = [];
    const jobCards = document.querySelectorAll('.job-card[data-jd-payload]');

    jobCards.forEach((card, index) => {
      try {
        const titleElement = card.querySelector('.job-title a.job-link, .job-title a');
        const companyElement = card.querySelector('.job-company');
        const locationElement = card.querySelector('.job-location');
        const postedElement = card.querySelector('.job-listed-date');
        const badgeElement = card.querySelector('.badges .badge .content');

        const description = Array.from(card.querySelectorAll('.job-abstract li'))
          .map(li => li.textContent?.trim())
          .filter(Boolean)
          .join('\n');

        const jobUrl = titleElement?.getAttribute('href')
          ? new URL(titleElement.getAttribute('href') || '', window.location.origin).href
          : window.location.href;

        jobs.push({
          id: `jora_${Date.now()}_${index}`,
          title: titleElement?.textContent?.trim() || '',
          company: companyElement?.textContent?.trim() || '',
          location: locationElement?.textContent?.trim() || '',
          jobUrl,
          description,
          postedDate: postedElement?.textContent?.trim() || '',
          salary: badgeElement?.textContent?.trim() || '',
          isRPRequired: detectPRRequirement(description || '').isRPRequired,
          platform: 'Jora',
        });
      } catch (error) {
        console.warn('Failed to parse Jora job card', error);
      }
    });

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

        const descriptionLoaded =
          detailsPanel &&
          (detailsPanel.querySelector('#jobDescriptionText') ||
            detailsPanel.querySelector('.jobsearch-JobComponent-description') ||
            detailsPanel.querySelector('.jobsearch-embeddedBody') ||
            detailsPanel.querySelector('.jobsearch-JobComponent-embeddedBody'));

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
            companyLogoUrl: jobDetail.companyLogoUrl || undefined,
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
          const job = Job.createFromIndeed(basicInfo);
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
            companyLogoUrl: job.companyLogoUrl || undefined,
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
            job = Job.createFromIndeed(basicInfo);
          }
        } else {
          job = Job.createFromIndeed(basicInfo);
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
          const job = Job.createFromIndeed(basicInfo);
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
            companyLogoUrl: job.companyLogoUrl || undefined,
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
              jobUrl: url,
              salary,
              description: '',
              postedDate: '',
              isRPRequired: detectPRRequirement('').isRPRequired,
              companyLogoUrl: undefined,
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

// Platform detection
export const getCurrentPlatform = (): string | null => {
  const hostname = window.location.hostname.toLowerCase();

  if (hostname.includes('linkedin.com')) return 'linkedin';
  if (hostname.includes('seek.com')) return 'seek';
  if (hostname.includes('indeed.com')) return 'indeed';
  if (hostname.includes('jora.com')) return 'jora';
  if (hostname.includes('reed.co.uk')) return 'reed';
  if (hostname === 'recruitment.macquarie.com') return 'macquarie';
  if (hostname.includes('atlassian.com')) return 'atlassian';
  if (hostname.includes('ebuu.fa.ap1.oraclecloud.com')) return 'westpac';
  if (hostname.includes('lifeatcanva.com')) return 'canva';
  if (hostname.includes('jobjourney.me') || hostname.includes('localhost')) return 'jobjourney';

  return null;
};
