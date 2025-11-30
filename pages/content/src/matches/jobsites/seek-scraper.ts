// SEEK scraper from working version
export {};

// Helper function to scrape the SEEK job detail panel
async function scrapeSeekJobDetailPanel(basicInfo: any = {}): Promise<any> {
  try {
    // Job details panel
    let panel = document.querySelector('[data-automation="jobDetailsPage"]');

    if (!panel) {
      console.log('SEEK job details panel not found on first attempt. Retrying after 0.5s...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for 0.5 seconds
      panel = document.querySelector('[data-automation="jobDetailsPage"]'); // Try selecting again
    }

    if (!panel) {
      // console.warn('SEEK job details panel not found after retry')
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

    // Posted date - try multiple approaches to find the posted date
    let postedDate = '';

    // Try multiple selectors for posted date
    const dateSelectors = [
      'span.gg45di0', // Original selector
      'span[class*="PostedDate"]', // Generic posted date class
      'span[data-automation*="posted"]', // Automation attribute
      'span:has-text("Posted")', // Contains "Posted" text
      '*', // All elements as fallback
    ];

    for (const selector of dateSelectors) {
      try {
        const elements =
          selector === '*'
            ? Array.from(panel.querySelectorAll('*')).filter(
                el => el.textContent && el.textContent.includes('Posted') && el.children.length === 0, // Only leaf elements
              )
            : Array.from(panel.querySelectorAll(selector));

        for (const el of elements) {
          const text = el.textContent?.trim() || '';
          if (text.includes('Posted') && /Posted\s+\d+[dwhmy]\s+ago/i.test(text)) {
            postedDate = text.replace(/Posted\s+/i, '').trim();
            console.log(`Found posted date using selector "${selector}":`, postedDate);
            break;
          }
        }

        if (postedDate) break;
      } catch (selectorError) {
        console.warn(`Selector "${selector}" failed:`, selectorError);
        continue;
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
}

// SEEK scraper object
const seekScraper = {
  isMatch: (url: string) => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return (
        hostname === 'seek.com.au' ||
        hostname.endsWith('.seek.com.au') ||
        hostname === 'seek.co.nz' ||
        hostname.endsWith('.seek.co.nz')
      );
    } catch {
      return false;
    }
  },
  scrapeJobList: async () => {
    const jobs: any[] = [];
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

    let jobNodes: NodeListOf<Element> = document.querySelectorAll('div[data-not-found]'); // Start with empty result
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

    // If we're on a standalone job detail page with no job cards
    if (alreadyOnJobDetail && jobNodes.length === 0) {
      console.log('On standalone job details page, scraping current job');
      const jobDetail = await scrapeSeekJobDetailPanel();
      if (jobDetail) {
        jobs.push(jobDetail);
      }
      return { jobs, nextUrl: null };
    }

    // Function to wait for job details panel to load
    const waitForJobDetailsPanel = async () => {
      let attempts = 0;
      const maxAttempts = (window as any).TIMEOUT_CONFIG?.SEEK?.JOB_PANEL_MAX_ATTEMPTS || 25; // Use centralized config
      let waitTime = 200; // Start with 200ms

      while (attempts < maxAttempts) {
        const detailsPanel = document.querySelector('[data-automation="jobDetailsPage"]');
        const loadingIndicator = document.querySelector('[data-automation="loading-spinner"]');

        if (detailsPanel && !loadingIndicator) {
          // Wait a bit more to ensure content is fully rendered
          await new Promise(r => setTimeout(r, 500));
          return true;
        }

        // Exponential backoff - double the wait time after each attempt
        const maxWait = (window as any).TIMEOUT_CONFIG?.SEEK?.JOB_PANEL_MAX_WAIT || 3000;
        waitTime = Math.min(waitTime * 1.5, maxWait); // Use centralized max wait time
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

        // Send progress update
        try {
          chrome.runtime.sendMessage({
            type: 'SCRAPING_PROGRESS',
            data: {
              platform: 'seek',
              current: i + 1,
              total: Math.min(jobNodes.length, 30),
              jobsFound: jobs.length,
            },
          });
        } catch (progressError) {
          // Check if extension context is invalidated
          if (progressError.message?.includes('Extension context invalidated')) {
            console.log('🔄 Extension reloaded, stopping scraping gracefully');
            return jobs; // Return what we have so far
          }
          console.warn('Failed to send progress update:', progressError);
        }

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
            jobs.push(jobDetail);
            console.log(`Successfully scraped detailed job: ${jobDetail.title}`);
          } else {
            // Fallback to basic info if detailed scraping failed
            console.log(`Failed to get details, using basic info for job ${i + 1}`);
            const job = (window as any).Job.createFromSEEK(basicInfo);
            jobs.push(job);
          }
        } else {
          // Fallback to basic info if panel didn't load
          console.log(`Job details panel didn't load for job ${i + 1}, using basic info`);
          const job = (window as any).Job.createFromSEEK(basicInfo);
          jobs.push(job);
        }

        // Add a delay between job clicks to avoid rate limiting
        const baseDelay = 300;
        // const additionalDelay = 100
        const totalDelay = baseDelay;
        console.log(`Waiting ${totalDelay}ms before next job click...`);
        await new Promise(r => setTimeout(r, totalDelay));
      } catch (error) {
        console.error(`Error processing job ${i + 1}:`, error);
        // Add error recovery delay
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // Check for next page - using valid CSS selectors that target the last "Next" button
    const nextButton = document.querySelector(
      [
        'li:last-child a[rel*="next"][aria-hidden="false"]',
        'li:last-child a[data-automation^="page-"]:not([aria-current])',
      ].join(','),
    );

    const nextUrl =
      nextButton && nextButton.getAttribute('aria-hidden') !== 'true' ? (nextButton as HTMLAnchorElement).href : null;

    console.log(`=== SEEK Scraping Complete: ${jobs.length} jobs found ===`);
    console.log('Next URL:', nextUrl);

    // Store jobs in localStorage with quota management
    try {
      // First, try to clear old data if it exists
      const existingJobsStr = localStorage.getItem('jobjourney_scraped_jobs') || '[]';
      let existingJobs = [];

      try {
        existingJobs = JSON.parse(existingJobsStr);
      } catch (parseError) {
        console.warn('Failed to parse existing jobs, starting fresh:', parseError);
        existingJobs = [];
      }

      // Limit total jobs to prevent quota issues (keep only last 1000 jobs)
      const maxJobs = 1000;
      const allJobs = [...existingJobs, ...jobs];
      const trimmedJobs = allJobs.slice(-maxJobs); // Keep only the most recent jobs

      localStorage.setItem('jobjourney_scraped_jobs', JSON.stringify(trimmedJobs));
      localStorage.setItem('jobjourney_last_scrape', new Date().toISOString());
      console.log(
        `💾 Stored ${jobs.length} SEEK jobs in localStorage (total: ${trimmedJobs.length}, trimmed from ${allJobs.length})`,
      );
    } catch (error) {
      console.error('Failed to store jobs in localStorage:', error);
      // Try to clear only job data and store current page jobs (preserve user preferences)
      try {
        localStorage.removeItem('jobjourney_scraped_jobs');
        localStorage.removeItem('jobjourney_last_scrape');
        localStorage.setItem('jobjourney_scraped_jobs', JSON.stringify(jobs));
        localStorage.setItem('jobjourney_last_scrape', new Date().toISOString());
        console.log(`💾 Stored ${jobs.length} SEEK jobs in localStorage (quota recovery, preferences preserved)`);
      } catch (secondError) {
        console.error('Failed to store jobs even after clearing:', secondError);
      }
    }

    return {
      jobs,
      nextUrl,
    };
  },
  scrapeJobDetail: async () => {
    try {
      return await scrapeSeekJobDetailPanel();
    } catch (error) {
      console.error('Error scraping SEEK job detail:', error);
      return null;
    }
  },
};

// Assign to window object for global access
window.seekScraper = seekScraper;

console.log('🔵 SEEK scraper loaded');
