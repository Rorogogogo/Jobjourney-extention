// Indeed scraper from working version
export {};

// Note: Overlay management removed to match LinkedIn/SEEK architecture
// Only ScrapingService.ts should handle overlays to prevent duplication

// **** NEW HELPER FUNCTION for Indeed Details Panel ****
function scrapeIndeedJobDetailPanel(panelElement: Element, basicInfo: any = {}): any {
  console.log('Attempting to scrape Indeed detail panel...');
  if (!panelElement) {
    console.error('scrapeIndeedJobDetailPanel called with null panelElement.');
    return null;
  }

  try {
    // --- Extractors based on provided detail HTML ---
    const titleElement = panelElement.querySelector(
      'h2[data-testid="jobsearch-JobInfoHeader-title"], h2[data-testid="simpler-jobTitle"]',
    );
    const companyElement = panelElement.querySelector(
      '[data-testid="inlineHeader-companyName"] a, span.jobsearch-JobInfoHeader-companyNameSimple',
    );
    const locationElement = panelElement.querySelector(
      '[data-testid="inlineHeader-companyLocation"] div, div[data-testid="jobsearch-JobInfoHeader-companyLocation"] div:first-child',
    ); // Get the div containing location and maybe work type
    const descriptionElement = panelElement.querySelector('#jobDescriptionText');
    const jobDetailsContainer = panelElement.querySelector('#jobDetailsSection, #salaryInfoAndJobType'); // Container for salary, job type etc.

    // --- Basic Info ---
    const title = titleElement?.textContent?.trim() || basicInfo.title || '';
    const company = companyElement?.textContent?.trim() || basicInfo.company || '';
    const jobUrl = basicInfo.jobUrl || window.location.href.split('?')[0] || '';

    // --- Location & Workplace Type ---
    let location = '';
    let workplaceType = '';
    if (locationElement) {
      const locationText = locationElement.textContent?.trim() || '';
      // Example: "Sydney NSW 2000 • Hybrid work" or just "Sydney NSW 2000" or "Remote"
      if (locationText.includes('Hybrid work')) {
        workplaceType = 'Hybrid';
        location = locationText.replace('• Hybrid work', '').trim();
      } else if (locationText.includes('Remote')) {
        workplaceType = 'Remote';
        location = locationText.replace('• Remote', '').trim(); // Or just set location to 'Remote' if that's all there is
        if (location.toLowerCase() === 'remote') location = ''; // Clear location if it was just 'Remote'
      } else {
        location = locationText; // Assume it's just the location
        workplaceType = 'On-site'; // Default assumption if not specified
      }
    }
    // Fallback from basic info if needed
    location = location || basicInfo.location || '';
    workplaceType = workplaceType || basicInfo.workplaceType || ''; // Prioritize panel, then card

    // --- Salary & Job Type from Details Panel ---
    let salary = '';
    let jobType = '';
    if (jobDetailsContainer) {
      const payElement = jobDetailsContainer.querySelector(
        '[aria-label="Pay"] [data-testid*="-tile"] span, .css-18poi35',
      );
      const jobTypeElement = jobDetailsContainer.querySelector(
        '[aria-label="Job type"] [data-testid*="-tile"] span, .css-18poi35',
      );

      salary = payElement?.textContent?.trim() || '';
      jobType = jobTypeElement?.textContent?.trim() || '';

      // Refine job type extraction if it contains extra text
      const jobTypeMatch = jobType.match(/\b(Full-time|Part-time|Contract|Temporary|Internship|Casual|Contractor)\b/i);
      jobType = jobTypeMatch ? jobTypeMatch[0] : '';
    }

    // If we didn't find job type in details container, try broader selectors
    if (!jobType) {
      const jobTypeSpan = panelElement.querySelector('span.css-18poi35');
      if (jobTypeSpan) {
        const spanText = jobTypeSpan.textContent?.trim() || '';
        const jobTypeMatch = spanText.match(
          /\b(Full-time|Part-time|Contract|Temporary|Internship|Casual|Contractor)\b/i,
        );
        jobType = jobTypeMatch ? jobTypeMatch[0] : '';
      }
    }

    // Fallback from basic info
    salary = salary || basicInfo.salary || '';
    jobType = jobType || basicInfo.jobType || '';

    // --- Description ---
    let description = '';
    if (descriptionElement) {
      // Use a similar cleaning approach as LinkedIn/SEEK
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
          strong.remove(); // Remove empty bold tags
        }
      });

      // Remove remaining HTML tags (Simplified removal - might need refinement)
      // Replace remaining tags with their text content to avoid data loss
      Array.from(tempDiv.querySelectorAll('*:not(p):not(br):not(li):not(b):not(strong)')).forEach(el => {
        if (el.parentNode) {
          // Ensure element is still in the DOM
          el.replaceWith(...Array.from(el.childNodes)); // Replace tag with its content
        }
      });

      description = tempDiv.textContent || '';
      description = description.replace(/\n{3,}/g, '\n\n').trim(); // Clean up excessive newlines
    }
    description = description || basicInfo.description || ''; // Fallback to snippet

    // --- Other fields (less likely in panel, use basicInfo) ---
    const postedDate = basicInfo.postedDate || ''; // Usually not in the detail panel view

    // Try to extract company logo from panel, fallback to basicInfo
    const logoSelectors = [
      'img[data-testid="jobsearch-JobInfoHeader-logo-overlay-lower"]',
      'img.jobsearch-JobInfoHeader-logo',
      'img.jobsearch-JobInfoHeader-logo-overlay-lower',
      'img.companyAvatar',
      '[data-testid="companyAvatar"] img',
    ];

    let companyLogoUrl = basicInfo.companyLogoUrl || null;
    for (const selector of logoSelectors) {
      const logoElement = panelElement.querySelector(selector) as HTMLImageElement;
      if (logoElement?.src) {
        companyLogoUrl = logoElement.src;
        break;
      }
    }

    const applicantCount = basicInfo.applicantCount || ''; // N/A for Indeed typically

    if (!title || !company) {
      console.warn('Failed to extract essential details (title or company) from Indeed panel. Returning null.', {
        title,
        company,
      });
      return null; // Return null if essential details are missing
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
    // Attempt to return basic info as a last resort if available
    if (basicInfo && basicInfo.title) {
      console.warn('Returning basic info due to error during panel scraping.');
      return (window as any).Job.createFromIndeed(basicInfo);
    }
    return null;
  }
}

// Indeed scraper object
// Helper function to detect robot check
function detectRobotCheck(): boolean {
  // Common Indeed robot check indicators
  const robotCheckSelectors = [
    '[data-testid="robot-challenge"]',
    '.captcha-container',
    '#captcha-container',
    '.captcha',
    '[data-testid="captcha"]',
    'iframe[src*="captcha"]',
    'iframe[src*="recaptcha"]',
    '.g-recaptcha',
    '[data-sitekey]', // reCAPTCHA
    '.robot-check',
    // Indeed-specific selectors
    '[data-testid="blockedSearchPage"]',
    '.blocked-search-page',
    '[data-testid="verify-page"]',
    '.verification-page',
    '[aria-label*="verification"]',
    '[aria-label*="captcha"]',
    '.challenge-page',
    '#challenge-page',
  ];

  // Check for robot check elements
  for (const selector of robotCheckSelectors) {
    if (document.querySelector(selector)) {
      console.log(`🤖 Robot check detected with selector: ${selector}`);
      return true;
    }
  }

  // Check for robot check keywords in page content
  const pageText = document.body?.textContent?.toLowerCase() || '';
  const robotKeywords = [
    'verify you are human',
    'robot check',
    'captcha',
    "verify that you're human",
    'suspicious activity',
    'automated queries',
    'please verify',
    'security check',
    "prove you're not a robot",
    // Indeed-specific phrases
    'we detected unusual activity',
    'help us verify',
    'your activity looks suspicious',
    'please complete the security check',
    'verify your browser',
    'access blocked',
    'we need to verify',
    'temporarily blocked',
  ];

  for (const keyword of robotKeywords) {
    if (pageText.includes(keyword)) {
      console.log(`🤖 Robot check detected with keyword: "${keyword}"`);
      return true;
    }
  }

  // Check URL for robot check indicators
  const url = window.location.href.toLowerCase();
  if (url.includes('blocked') || url.includes('captcha') || url.includes('verify')) {
    console.log(`🤖 Robot check detected in URL: ${url}`);
    return true;
  }

  return false;
}

// Lightly scroll the detail panel to mimic user reading and reduce bot detection
async function mimicPanelScroll(panel: Element): Promise<void> {
  try {
    const root = panel as HTMLElement;
    const selectors = [
      '.jobsearch-JobComponent-description',
      '#jobsearch-ViewJobButtons-container',
      '#jobDescriptionText',
      '#mosaic-vjJobDetails',
      '.jobsearch-embeddedBody',
      '.jobsearch-JobComponent',
      '.jobsearch-RightPane',
      '.jobsearch-ViewJobLayout--embedded',
    ];

    const candidates: HTMLElement[] = [];
    const pushIf = (el: Element | null | undefined) => {
      if (el && el instanceof HTMLElement && !candidates.includes(el)) {
        candidates.push(el);
      }
    };

    selectors.forEach(sel => {
      pushIf(root.querySelector(sel));
      pushIf(document.querySelector(sel));
    });
    pushIf(root);
    pushIf(document.documentElement);

    const scrollable =
      candidates
        .map(el => ({ el, gap: el.scrollHeight - el.clientHeight }))
        .filter(x => x.gap > 40)
        .sort((a, b) => b.gap - a.gap)[0]?.el || root;

    const maxScroll = scrollable.scrollHeight - scrollable.clientHeight;
    if (maxScroll <= 0) return;

    const steps = 3 + Math.floor(Math.random() * 3); // 3-5 scroll steps
    for (let i = 0; i < steps; i++) {
      const target = Math.min(maxScroll, Math.random() * maxScroll);
      scrollable.scrollTo({ top: target, behavior: 'smooth' });
      await new Promise(r => setTimeout(r, 700 + Math.floor(Math.random() * 700)));
    }

    // Return near top for consistency
    scrollable.scrollTo({ top: 0, behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 400));
  } catch (error) {
    console.warn('mimicPanelScroll failed:', error);
  }
}

// Persist scraped jobs in localStorage with quota management
function storeScrapedJobs(jobs: any[]): void {
  try {
    const existingJobsStr = localStorage.getItem('jobjourney_scraped_jobs') || '[]';
    let existingJobs = [];

    try {
      existingJobs = JSON.parse(existingJobsStr);
    } catch (parseError) {
      console.warn('Failed to parse existing jobs, starting fresh:', parseError);
      existingJobs = [];
    }

    const maxJobs = 1000;
    const allJobs = [...existingJobs, ...jobs];
    const trimmedJobs = allJobs.slice(-maxJobs);

    localStorage.setItem('jobjourney_scraped_jobs', JSON.stringify(trimmedJobs));
    localStorage.setItem('jobjourney_last_scrape', new Date().toISOString());
    console.log(
      `💾 Stored ${jobs.length} Indeed jobs in localStorage (total: ${trimmedJobs.length}, trimmed from ${allJobs.length})`,
    );
  } catch (error) {
    console.error('Failed to store jobs in localStorage:', error);
    try {
      localStorage.removeItem('jobjourney_scraped_jobs');
      localStorage.removeItem('jobjourney_last_scrape');
      localStorage.setItem('jobjourney_scraped_jobs', JSON.stringify(jobs));
      localStorage.setItem('jobjourney_last_scrape', new Date().toISOString());
      console.log(`💾 Stored ${jobs.length} Indeed jobs in localStorage (quota recovery, preferences preserved)`);
    } catch (secondError) {
      console.error('Failed to store jobs even after clearing:', secondError);
    }
  }
}

// Helper function to wait for robot check completion
async function waitForRobotCheckCompletion(): Promise<boolean> {
  console.log('⏳ Waiting for user to complete robot check...');

  // Hide the scraping overlay to allow user interaction
  // Overlay is managed by ScrapingService.ts

  // Also send message to background to hide overlay
  try {
    chrome.runtime.sendMessage({
      type: 'HIDE_OVERLAY',
    });
  } catch (error) {
    console.warn('Failed to send hide overlay message:', error);
  }

  // Show user notification
  const notification = document.createElement('div');
  notification.id = 'jobjourney-robot-check-notification';
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #ff6b35, #f7931e);
      color: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(255, 107, 53, 0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      max-width: 320px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      animation: slideIn 0.3s ease-out;
    ">
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .pulse {
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .jj-close-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          line-height: 1;
          transition: background 0.2s;
        }
        .jj-close-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      </style>
      <button class="jj-close-btn" onclick="this.parentElement.parentElement.remove();" title="Close for this page only">×</button>
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 24px; margin-right: 12px;" class="pulse">🤖</span>
        <strong style="font-size: 16px;">Robot Check Detected</strong>
      </div>
      <div style="margin-bottom: 12px; line-height: 1.4;">
        Please complete the verification on this page to continue job discovery.
      </div>
      <div style="font-size: 12px; opacity: 0.9; background: rgba(255,255,255,0.1); padding: 8px; border-radius: 6px;">
        💡 JobJourney will automatically resume once completed
      </div>
      <div style="font-size: 11px; opacity: 0.7; margin-top: 8px; text-align: center;">
        Click × to dismiss for this page only
      </div>
    </div>
  `;
  document.body.appendChild(notification);

  // Poll for robot check completion
  return new Promise(resolve => {
    // Wait longer before starting to check - give user time to see the notification
    setTimeout(() => {
      const checkInterval = setInterval(() => {
        const hasVerificationElements = detectRobotCheck();

        // Only resolve if we're sure the verification is really gone AND we can see job content
        const hasJobContent =
          document.querySelector('.jobsearch-SerpJobCard') ||
          document.querySelector('div.result') ||
          document.querySelector('div.job_seen_beacon') ||
          document.querySelector('[data-testid="job-card"]');

        if (!hasVerificationElements && hasJobContent) {
          console.log('✅ Robot check completed and job content visible, resuming discovery...');
          clearInterval(checkInterval);

          // Remove notification with animation
          if (notification.parentNode) {
            notification.style.transform = 'translateX(100%)';
            notification.style.opacity = '0';
            setTimeout(() => {
              if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
              }
            }, 300);
          }

          // Show success notification briefly
          const successNotification = document.createElement('div');
          successNotification.innerHTML = `
          <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 15px 20px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(16, 185, 129, 0.3);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            animation: slideIn 0.3s ease-out;
          ">
            <div style="display: flex; align-items: center;">
              <span style="font-size: 20px; margin-right: 10px;">✅</span>
              <strong>Robot check completed!</strong>
            </div>
            <div style="font-size: 12px; margin-top: 5px; opacity: 0.9;">
              Resuming job discovery...
            </div>
          </div>
        `;
          document.body.appendChild(successNotification);

          // Remove success notification after 3 seconds
          setTimeout(() => {
            if (successNotification.parentNode) {
              successNotification.style.transform = 'translateX(100%)';
              successNotification.style.opacity = '0';
              setTimeout(() => {
                if (successNotification.parentNode) {
                  successNotification.parentNode.removeChild(successNotification);
                }
              }, 300);
            }
          }, 3000);

          // Show overlay again using helper function
          console.log('🔄 Resuming job discovery after robot check...');

          // Also try to send message to background
          try {
            chrome.runtime.sendMessage({
              type: 'SHOW_OVERLAY',
              data: {
                message: 'Resuming job discovery...',
                submessage: 'Robot check completed',
              },
            });
          } catch (error) {
            console.warn('Failed to send show overlay message:', error);
          }

          resolve(true);
        } else if (!hasVerificationElements && !hasJobContent) {
          // Page might be loading, wait a bit more
          console.log('⏳ Verification cleared but waiting for job content to load...');
        } else {
          console.log('⏳ Still waiting for user to complete verification...');
        }
      }, 3000); // Check every 3 seconds to be less aggressive

      // Timeout after 10 minutes
      setTimeout(() => {
        console.warn('⚠️ Robot check timeout after 10 minutes');
        clearInterval(checkInterval);
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        resolve(false);
      }, 600000); // 10 minutes
    }, 5000); // Wait 5 seconds before starting to check - give user time to see notification
  });
}

const indeedScraper = {
  // Temporarily disabled to avoid UI/verification issues; always return false
  isMatch: (_url: string) => false,
  scrapeJobList: async () => {
    console.group('Indeed - Job Scraping - Click & Scrape');

    // Check if we're on the first page (no 'start' parameter or start=0)
    const urlParams = new URLSearchParams(window.location.search);
    const startParam = urlParams.get('start');
    const isFirstPage = !startParam || startParam === '0';

    // Only check for robot verification on the first page
    // Important: Verification only appears on first page, not on subsequent pages
    if (isFirstPage && detectRobotCheck()) {
      console.log('🤖 Robot check detected on first page, waiting for completion...');
      const completed = await waitForRobotCheckCompletion();
      if (!completed) {
        console.error('❌ Robot check not completed within timeout');
        return { jobs: [], nextUrl: null };
      }
    }

    // Show overlay after verification complete and before scraping starts
    console.log('🔄 Starting Indeed job discovery...');

    // Add a delay to handle bot checking issues
    const initialDelay = 4000; // 4 seconds to handle bot detection
    console.log(`Indeed: Waiting ${initialDelay}ms before starting scrape to avoid bot detection...`);
    await new Promise(resolve => setTimeout(resolve, initialDelay));

    const jobs: any[] = [];
    let nextUrl = null;

    // More specific selector targeting the main job card container
    // Using `div.result` which often contains the job_seen_beacon andtextContent
    const jobCardSelector = 'div.result:not(.mosaic-zone) div.job_seen_beacon'; // Try targeting beacon within result
    // Fallback if the above doesn't work well
    // const jobCardSelector = 'li div.cardOutline'
    // const jobCardSelector = 'div.jobsearch-SerpJobCard, div.result' // Alternative general selectors

    let jobNodes = Array.from(document.querySelectorAll(jobCardSelector));

    // If the primary selector fails, try a broader one as fallback
    if (jobNodes.length === 0) {
      // console.warn("Primary selector '" + jobCardSelector + "' found 0 nodes. Trying fallback...")
      const fallbackSelector =
        'div.jobsearch-SerpJobCard, div.result, div.job_seen_beacon, li > div[class*="cardOutline"]';
      jobNodes = Array.from(document.querySelectorAll(fallbackSelector));
      console.log('Fallback selector found nodes:', jobNodes.length);
    }

    console.log('Found Indeed job nodes:', jobNodes.length);
    const jobNodesToProcess = jobNodes.slice(0, Math.min(jobNodes.length, 25)); // sequential order

    // Check if we're already on a job details page
    const alreadyOnJobDetail =
      document.querySelector('div.fastviewjob') || document.querySelector('div.jobsearch-ViewJobLayout--embedded');

    // Function to wait for job details panel to load/update
    const waitForJobDetailsPanel = async (expectedJobTitle?: string) => {
      let attempts = 0;
      const maxAttempts = (window as any).TIMEOUT_CONFIG?.JOB_PANEL_MAX_ATTEMPTS || 15; // Use centralized config
      let waitTime = 200; // Initial wait 200ms
      let lastSeenTitle = '';

      while (attempts < maxAttempts) {
        // Only check for robot check during panel loading on the first page
        // Verification doesn't appear on subsequent pages per user observation
        if (isFirstPage && detectRobotCheck()) {
          console.log('🤖 Robot check detected while waiting for job panel...');
          const completed = await waitForRobotCheckCompletion();
          if (!completed) {
            console.error('❌ Robot check not completed during panel wait');
            return null;
          }
          // Reset attempts after robot check completion
          attempts = 0;
          waitTime = 200;
          continue;
        }

        // Look for the main container and the description text
        const detailsPanel =
          document.querySelector('.jobsearch-JobComponent') ||
          document.querySelector('div.fastviewjob') ||
          document.querySelector('div.jobsearch-ViewJobLayout--embedded') ||
          document.querySelector('.jobsearch-InfoHeaderContainer');

        if (detailsPanel) {
          // Check if content has actually updated by looking at the title
          const titleElement = detailsPanel.querySelector(
            'h2[data-testid="jobsearch-JobInfoHeader-title"], h2[data-testid="simpler-jobTitle"]',
          );
          const currentTitle = titleElement?.textContent?.trim() || '';

          // Ensure the panel has the expected job title or has changed from last seen
          const titleMatches =
            !expectedJobTitle ||
            currentTitle.includes(expectedJobTitle) ||
            (currentTitle && currentTitle !== lastSeenTitle);
          const descriptionLoaded = detailsPanel.querySelector('#jobDescriptionText');
          const hasContent = descriptionLoaded && (descriptionLoaded.textContent?.trim().length || 0) > 10;

          if (titleMatches && hasContent) {
            // Wait a bit more to ensure content is fully rendered
            await new Promise(r => setTimeout(r, 500)); // 500ms wait after panel loads
            console.log(`Indeed details panel detected for: ${currentTitle}`);
            return detailsPanel; // Return the panel element
          }

          // Update last seen title
          if (currentTitle) {
            lastSeenTitle = currentTitle;
          }
        }

        // Exponential backoff with higher maximum wait time
        const maxWait = (window as any).TIMEOUT_CONFIG?.JOB_PANEL_MAX_WAIT || 3000;
        waitTime = Math.min(waitTime * 1.5, maxWait); // Use centralized max wait time
        console.log(`Waiting ${waitTime}ms for Indeed job details panel (attempt ${attempts + 1}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, waitTime));
        attempts++;
      }
      console.log('Indeed details panel did not load in time.');
      return null; // Return null if not found
    };

    // If we're on a standalone job detail page with no job cards
    if (alreadyOnJobDetail && jobNodes.length === 0) {
      console.log('On standalone Indeed job details page, scraping current job');
      const panelElement = await waitForJobDetailsPanel(); // Ensure it's loaded
      if (panelElement) {
        const jobDetail = scrapeIndeedJobDetailPanel(panelElement);
        if (jobDetail) {
          jobs.push(jobDetail);
          console.log(`Scraped standalone job: ${jobDetail.title}`);
        }
      } else {
        console.warn('Could not find/load the details panel on standalone page.');
      }
      // Still check for next page even on detail view
      const nextPageLink = document.querySelector('a[data-testid="pagination-page-next"]');
      nextUrl = nextPageLink ? (nextPageLink as HTMLAnchorElement).href : null;
      if (jobs.length) {
        storeScrapedJobs(jobs);
      }
      console.groupEnd();
      return { jobs, nextUrl };
    }

    // Process job cards using the click and scrape method
    for (let i = 0; i < jobNodesToProcess.length; i++) {
      // Limit to 25 to avoid issues
      const node = jobNodesToProcess[i];
      let basicInfo: any = {};
      let job = null;

      try {
        // Only check for robot check during scraping on the first page
        // Verification doesn't appear on subsequent pages per user observation
        if (isFirstPage && detectRobotCheck()) {
          console.log('🤖 Robot check detected during scraping, pausing...');
          const completed = await waitForRobotCheckCompletion();
          if (!completed) {
            console.error('❌ Robot check not completed, stopping scraping');
            break;
          }
          // Wait a bit after robot check completion before continuing
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        console.log(`\nProcessing Indeed job card ${i + 1}/${Math.min(jobNodes.length, 25)}`);

        // Send progress update
        try {
          chrome.runtime.sendMessage({
            type: 'SCRAPING_PROGRESS',
            data: {
              platform: 'indeed',
              current: i + 1,
              total: jobNodesToProcess.length,
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

        // --- 1. Extract Basic Info from Card (Fallback) ---
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
        const descriptionSnippetNode = node.querySelector(
          [
            'div[data-testid="jobsnippet_footer"] ul li',
            '.job-snippet ul li',
            '.underShelfFooter .heading6 ul li',
          ].join(','),
        );
        // Try multiple selectors for posted date with better debugging
        let postedDateNode = null;
        const dateSelectors = [
          'span.date',
          'span[class*="date"]',
          '.jobMetaDataGroup span',
          '[data-testid="myJobsStateDate"]',
          'span[class*="visually-hidden"]',
        ];

        for (const selector of dateSelectors) {
          const elements = node.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.textContent?.trim() || '';
            // Look for date patterns like "Posted 3 days ago", "Active 1 day ago", etc.
            if (text && /\d+\s+(day|week|month|year|hour)s?\s+ago|Posted|Active|New/i.test(text)) {
              postedDateNode = el;
              console.log(`Found posted date with selector "${selector}": "${text}"`);
              break;
            }
          }
          if (postedDateNode) break;
        }

        const metadataItems = Array.from(
          node.querySelectorAll(
            [
              '.metadataContainer li .metadata div[data-testid="attribute_snippet_testid"]',
              '.metadataContainer li div[data-testid="attribute_snippet_testid"]',
              '.metadataContainer li div[data-testid^="attribute_snippet"]',
              '.heading6.tapItem-gutter.metadataContainer .metadata', // Broader metadata selector
            ].join(','),
          ),
        )
          .map((el: any) => el?.textContent?.trim())
          .filter((text: string) => text);

        const salaryText =
          metadataItems.find((text: string) => text && (text.includes('$') || text.match(/salary|pay/i))) || '';
        const jobTypeText =
          metadataItems.find(
            (text: string) =>
              text && /\b(Full-time|Part-time|Contract|Temporary|Internship|Casual|Contractor)\b/i.test(text),
          ) || '';
        const jobType =
          jobTypeText.match(/\b(Full-time|Part-time|Contract|Temporary|Internship|Casual|Contractor)\b/i)?.[0] || '';

        // Extract workplace type (Hybrid, Remote) if available on card
        const workplaceTypeCardText =
          metadataItems.find((text: string) => /\b(Hybrid|Remote)\b/i.test(text)) ||
          locationNode?.textContent?.match(/\b(Hybrid|Remote)\b/i)?.[0] ||
          '';

        const descriptionSnippet =
          descriptionSnippetNode?.textContent?.trim().replace(/…$/, '').replace(/\s+/g, ' ').trim() || '';
        // Try multiple selectors for company logo, matching single job scraper approach
        const logoSelectors = [
          'img.companyAvatar',
          '[data-testid="companyAvatar"] img',
          'img[data-testid="jobsearch-JobInfoHeader-logo-overlay-lower"]',
          'img.jobsearch-JobInfoHeader-logo',
          'img.jobsearch-JobInfoHeader-logo-overlay-lower',
        ];

        let companyLogoUrl = null;
        for (const selector of logoSelectors) {
          const logoElement = node.querySelector(selector) as HTMLImageElement;
          if (logoElement?.src) {
            companyLogoUrl = logoElement.src;
            break;
          }
        }

        // Attempt to find job URL from various places
        let jobUrl = '';
        const titleLink = node.querySelector('h2.jobTitle a[data-jk], a.jcs-JobTitle[data-jk]');
        if (titleLink && (titleLink as HTMLAnchorElement).href) {
          jobUrl = (titleLink as HTMLAnchorElement).href;
        } else {
          const cardLink = node.closest('a') || node.querySelector('a');
          if (cardLink && (cardLink as HTMLAnchorElement).href) {
            jobUrl = (cardLink as HTMLAnchorElement).href;
          }
        }

        if (jobUrl && !jobUrl.startsWith('http')) {
          jobUrl = new URL(jobUrl, window.location.href).href; // Make URL absolute
        }

        basicInfo = {
          title: titleNode?.textContent?.trim() || '',
          company: companyNode?.textContent?.trim() || '',
          location: locationNode?.textContent?.trim() || '',
          jobUrl: jobUrl,
          description: descriptionSnippet,
          salary: salaryText,
          postedDate:
            postedDateNode?.textContent
              ?.trim()
              .replace(/Posted\s*/i, '')
              .replace(/^(Active|New)\s*/i, '')
              .trim() || '',
          companyLogoUrl: companyLogoUrl,
          jobType: jobType,
          workplaceType: workplaceTypeCardText,
          applicantCount: '', // Not usually on Indeed card
        };

        if (!basicInfo.title) {
          console.warn(`Skipping card ${i + 1} due to missing title.`);
          continue; // Skip if essential info missing
        }

        console.log(`Basic info for card ${i + 1}: ${basicInfo.title} at ${basicInfo.company}`);

        // --- 2. Scroll & Click Card to Load Details ---
        // Prefer internal card/title links that keep us on the SERP; avoid generic anchors that may navigate away
        const clickableElement =
          node.querySelector('h2 a[data-jk], a.jcs-JobTitle[data-jk]') || // Specific title links
          node.querySelector('a[id^="sj_"]') || // Specific ID links
          (node.closest('[data-jk]') as HTMLElement) || // Card container with data-jk
          (titleNode as HTMLElement) || // Fallback to title node itself
          (node as HTMLElement); // Absolute fallback to the node

        if (!clickableElement) {
          console.warn(`Could not find clickable element for card ${i + 1}. Using basic info.`);
          job = (window as any).Job.createFromIndeed(basicInfo);
          jobs.push(job);
          continue;
        }

        console.log(
          `Clicking element for job ${i + 1}:`,
          (clickableElement as Element).tagName,
          (clickableElement as Element).className,
        );

        if (clickableElement instanceof HTMLAnchorElement) {
          clickableElement.removeAttribute('target');
          clickableElement.rel = 'noopener';
        }

        // Scroll near the card before clicking to mimic real interaction
        const rect = (clickableElement as HTMLElement).getBoundingClientRect();
        const scrollTarget = Math.max(0, rect.top + window.scrollY - 200 + Math.random() * 120);
        window.scrollTo({ top: scrollTarget, behavior: 'smooth' });
        await new Promise(r => setTimeout(r, 400 + Math.floor(Math.random() * 400)));

        // Dispatch a synthetic click to load the side panel without opening a new page
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        (clickableElement as HTMLElement).dispatchEvent(clickEvent);

        // --- 3. Wait for and Scrape Details Panel ---
        const panelElement = await waitForJobDetailsPanel(basicInfo.title);

        if (panelElement) {
          console.log(`Panel loaded for job ${i + 1}. Scraping details...`);
          await mimicPanelScroll(panelElement);
          const jobDetail = scrapeIndeedJobDetailPanel(panelElement, basicInfo); // Pass basicInfo as fallback

          if (jobDetail && jobDetail.title) {
            // Ensure detail scraping was successful
            job = jobDetail;
            console.log(`Successfully scraped detailed Indeed job: ${job.title}`);
          } else {
            console.warn(`Detailed scraping failed for job ${i + 1}. Using basic info.`);
            job = (window as any).Job.createFromIndeed(basicInfo); // Fallback to basic
          }
        } else {
          // console.warn(`Details panel did not load for job ${i + 1}. Using basic info.`)
          job = (window as any).Job.createFromIndeed(basicInfo); // Fallback to basic
        }

        jobs.push(job);

        // --- 4. Delay with jitter to reduce request burstiness ---
        const baseDelay = 2000; // minimum delay between job clicks
        const randomJitter = Math.floor(Math.random() * 2000); // add up to 2000ms extra
        const totalDelay = baseDelay + randomJitter;
        console.log(`Waiting ${totalDelay}ms before next Indeed job click...`);
        await new Promise(r => setTimeout(r, totalDelay));
      } catch (error) {
        console.error(`Error processing Indeed job ${i + 1}:`, error);
        if (basicInfo.title) {
          // If we got basic info, add it as a fallback
          console.log('Adding job with basic info due to error during processing.');
          job = (window as any).Job.createFromIndeed(basicInfo);
          jobs.push(job);
        }
        // Add error recovery delay
        await new Promise(r => setTimeout(r, 1250)); // 1250ms error recovery delay
      }
    }

    // Get next page URL (check after loop) with fallbacks
    const getNextPageUrl = () => {
      // Primary selectors for next pagination link
      const nextPageLink =
        document.querySelector('a[data-testid="pagination-page-next"]') ||
        document.querySelector('nav[aria-label*="pagination"] a[aria-label*="Next" i]') ||
        document.querySelector('a[aria-label*="Next" i]');

      if (nextPageLink) {
        const isDisabled = (nextPageLink as HTMLElement).getAttribute('aria-disabled') === 'true';
        const href = (nextPageLink as HTMLAnchorElement).href;
        if (!isDisabled && href) {
          return href.startsWith('http') ? href : new URL(href, window.location.href).href;
        }
      }

      // Fallback: derive next page via start param when pagination UI is not link-based
      const paginationContainer = document.querySelector('nav[aria-label*="pagination"], nav[role="navigation"]');
      if (!paginationContainer || jobNodes.length === 0) {
        return null;
      }

      const currentUrl = new URL(window.location.href);
      const currentStart = parseInt(currentUrl.searchParams.get('start') || '0', 10);
      // Guess page size from cards on page (Indeed commonly serves 10-15 per page)
      const pageSizeGuess = Math.max(10, Math.min(25, jobNodes.length));
      currentUrl.searchParams.set('start', (currentStart + pageSizeGuess).toString());
      return currentUrl.toString();
    };

    nextUrl = getNextPageUrl();

    console.log(`Scraped ${jobs.length} jobs from Indeed page`);
    console.log('Next Indeed page URL:', nextUrl);

    if (jobs.length) {
      storeScrapedJobs(jobs);
    }

    console.groupEnd();

    return {
      jobs,
      nextUrl,
    };
  },
  scrapeJobDetail: () => {
    try {
      const panel =
        document.querySelector('div.fastviewjob') || document.querySelector('div.jobsearch-ViewJobLayout--embedded');
      if (panel) {
        return scrapeIndeedJobDetailPanel(panel);
      } else {
        console.warn('scrapeJobDetail called but no Indeed panel found.');
        return null;
      }
    } catch (error) {
      console.error('Error in Indeed scrapeJobDetail:', error);
      return null;
    }
  },
};

// Assign to window object for global access
window.indeedScraper = indeedScraper;

console.log('🔵 Indeed scraper loaded');
