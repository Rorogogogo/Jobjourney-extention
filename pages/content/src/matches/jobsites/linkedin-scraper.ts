// LinkedIn scraper from working version
export {};

// Helper function to clean up empty tags and those that only contain comments
function cleanupEmptyTags(node: any) {
  if (!node) return;

  const children = Array.from(node.childNodes);
  children.forEach((child: any) => {
    if (child.nodeType === 8) {
      // Comment node
      child.remove();
    } else if (child.nodeType === 3 && !child.textContent.trim()) {
      child.remove();
    } else if (child.nodeType === 1) {
      cleanupEmptyTags(child);
    }
  });
}

// Helper function to clean and format content, preserving important formatting
function cleanAndFormatContent(node: any): string {
  if (!node) return '';

  // Clone the node to avoid modifying the original
  const clone = node.cloneNode(true);

  // Remove all <!-- --> comments in text nodes
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);

  const textNodes = [];
  let currentNode;
  while ((currentNode = walker.nextNode())) {
    textNodes.push(currentNode);
  }

  textNodes.forEach((textNode: any) => {
    textNode.textContent = textNode.textContent
      .replace(/<!--.*?-->/g, '')
      .replace(/^[ \t]*<!---->/g, '')
      .replace(/<!---->/g, '');
  });

  // Before removing tags, convert <strong> elements to actual bold markup
  // that our application can process properly
  const strongElements = clone.querySelectorAll('strong');
  strongElements.forEach((strong: any) => {
    const boldText = strong.textContent.trim();
    if (boldText) {
      // Create a text node with the bold wrapper
      const textNode = document.createTextNode(`[BOLD]${boldText}[/BOLD]`);
      strong.parentNode.replaceChild(textNode, strong);
    }
  });

  // Properly handle lists by preserving their structure
  const listItems = clone.querySelectorAll('li');
  listItems.forEach((li: any) => {
    // Add a special marker at the beginning of each list item
    li.innerHTML = '[LIST_ITEM]' + li.innerHTML;
  });

  // Handle paragraphs and breaks by ensuring they create new lines
  const paragraphs = clone.querySelectorAll('p');
  paragraphs.forEach((p: any, index: number) => {
    if (index > 0) {
      // Add paragraph separator for all paragraphs except the first one
      p.innerHTML = '[PARAGRAPH]' + p.innerHTML;
    }
  });

  // Mark all <br> elements
  const breaks = clone.querySelectorAll('br');
  breaks.forEach((br: any) => {
    const marker = document.createTextNode('[BREAK]');
    br.parentNode.insertBefore(marker, br);
  });

  // Clean up LinkedIn's specific patterns
  let content = clone.innerHTML
    // Remove empty comments
    .replace(/<!---->/g, '')
    // Remove comments with content
    .replace(/<!--.*?-->/g, '')
    // Remove span tags but keep their content
    .replace(/<\/?span(?:\s+[^>]*)?>|<\/?div(?:\s+[^>]*)?>/g, '')
    // Remove paragraph tags (we've already marked them)
    .replace(/<p[^>]*>|<\/p>/g, '')
    // Remove list item tags (we've already marked them)
    .replace(/<li[^>]*>|<\/li>/g, '')
    // Remove ul/ol tags
    .replace(/<\/?ul[^>]*>|<\/?ol[^>]*>/g, '')
    // Remove all remaining HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove white-space-pre markers
    .replace(/\s*class="white-space-pre"\s*/g, ' ')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  // Now convert our markers to proper formatting
  content = content
    // Convert our bold markers to plain text bold indicators
    .replace(/\[BOLD\](.*?)\[\/BOLD\]/g, '**$1**')
    // Convert list items to bullet points with line breaks
    .replace(/\[LIST_ITEM\]/g, '\n• ')
    // Convert paragraph markers to double line breaks
    .replace(/\[PARAGRAPH\]/g, '\n\n')
    // Convert break markers to single line breaks
    .replace(/\[BREAK\]/g, '\n')
    // Fix spacing around bullet points
    .replace(/\n• /g, '\n• ')
    // Clean up excessive newlines
    .replace(/\n{3,}/g, '\n\n');

  return content;
}

// Helper function to scrape the current job detail page (when not on search results)
function scrapeCurrentJobDetail(): any {
  try {
    const mainContainer = document.querySelector('.job-view-layout') || document.body;

    const title = mainContainer
      .querySelector('h1.t-24, .job-details-jobs-unified-top-card__job-title h1')
      ?.textContent?.trim();
    const companyLink = mainContainer.querySelector(
      'a.topcard__org-name-link, .job-details-jobs-unified-top-card__company-name a',
    );
    const company = companyLink?.textContent?.trim();

    // --- Location, Posted Date, Applicant Count ---
    const metaContainer = mainContainer.querySelector(
      '.jobs-unified-top-card__subtitle-primary-grouping, .job-details-jobs-unified-top-card__primary-description-container',
    );
    let location = '';
    let postedDate = '';
    let applicantCount = '';

    if (metaContainer) {
      // First try to get separated spans
      const metaTexts = Array.from(metaContainer.querySelectorAll('span[class*="tvm__text"]'))
        .map((span: any) => span.textContent.trim())
        .filter((text: string) => text && text !== '·');

      console.log('LinkedIn standalone metaTexts found:', metaTexts);

      // Check if we found properly separated elements (should be multiple with different content)
      const hasProperSeparation = metaTexts.length > 1 && metaTexts.some(text => !text.includes('·'));

      if (hasProperSeparation) {
        // Skip the first element (index 0) as it's usually the combined text
        // Look for the clean location in the separated elements
        location =
          metaTexts.find(
            (text: string, index: number) =>
              index > 0 &&
              !text.includes('ago') &&
              !text.includes('applicant') &&
              !text.includes('people clicked') &&
              !text.includes('Promoted') &&
              !text.includes('Responses managed'),
          ) ||
          metaTexts[1] ||
          '';

        postedDate =
          metaTexts.find(
            (text: string, index: number) => index > 0 && /\d+\s+(day|week|month|year)s?\s+ago/i.test(text),
          ) || '';
        applicantCount =
          metaTexts.find((text: string, index: number) => index > 0 && /applicant|people clicked apply/i.test(text)) ||
          '';
        console.log(
          'LinkedIn standalone parsed from spans - location:',
          location,
          'postedDate:',
          postedDate,
          'applicantCount:',
          applicantCount,
        );
      } else {
        // Fallback to parsing the full text
        console.log('LinkedIn standalone fallback parsing from full text:', metaContainer.textContent);
        const fullText = metaContainer.textContent.trim();
        const parts = fullText.split('·').map((part: string) => part.trim());
        console.log('LinkedIn standalone split parts:', parts);

        if (parts.length >= 1) location = parts[0];

        // Look for time-based patterns for posted date
        const timePattern = /\d+\s+(day|week|month|year)s?\s+ago/i;
        postedDate = parts.find((part: string) => timePattern.test(part)) || '';

        // Look for applicant count in remaining parts
        applicantCount = parts.find((part: string) => /applicant|people clicked apply/i.test(part)) || '';

        console.log(
          'LinkedIn standalone parsed from full text - location:',
          location,
          'postedDate:',
          postedDate,
          'applicantCount:',
          applicantCount,
        );
      }
    }

    // --- Description ---
    let description = '';
    const descriptionContainer = mainContainer.querySelector(
      'div.description__text, .jobs-description-content__text, div#job-details, div[class*="jobs-box__html-content"]',
    );
    if (descriptionContainer) {
      const contentDiv = descriptionContainer.querySelector('.mt4') || descriptionContainer; // Try to exclude "About the job" header
      description = cleanAndFormatContent(contentDiv); // Use the improved cleaning function
    }

    // --- Company Logo ---
    // Try multiple selectors to find company logo, matching single job scraper
    const logoSelectors = [
      '.artdeco-entity-lockup__image img.evi-image',
      '.jobs-company img.evi-image',
      '.job-details-jobs-unified-top-card__container--two-pane .evi-image',
      '.jobs-unified-top-card__company-logo img',
      '.artdeco-entity-lockup__image img',
      'img.evi-image',
    ];

    let companyLogoUrl = '';
    for (const selector of logoSelectors) {
      const logoElement = mainContainer.querySelector(selector) as HTMLImageElement;
      if (logoElement?.src) {
        companyLogoUrl = logoElement.src;
        break;
      }
    }

    // --- Job Type, Workplace Type, Salary from Pills/Specific Elements ---
    let workplaceType = '';
    let jobType = '';
    let salary = '';

    const pillElements = mainContainer.querySelectorAll(
      '.job-details-preferences-and-skills__pill, .job-details-jobs-unified-top-card__job-insight, .job-details-jobs-unified-top-card__workplace-type',
    );

    pillElements.forEach((pill: any) => {
      const pillText = pill.textContent.trim();
      // Check for workplace type (prioritize specific element if exists)
      if (!workplaceType && pill.matches('.job-details-jobs-unified-top-card__workplace-type')) {
        workplaceType = pillText;
      } else if (
        !workplaceType &&
        (pillText.includes('Remote') || pillText.includes('Hybrid') || pillText.includes('On-site'))
      ) {
        if (pillText.includes('Remote')) workplaceType = 'Remote';
        else if (pillText.includes('Hybrid')) workplaceType = 'Hybrid';
        else if (pillText.includes('On-site')) workplaceType = 'On-site';
      }

      // Check for job type
      if (
        !jobType &&
        (pillText.includes('Full-time') ||
          pillText.includes('Part-time') ||
          pillText.includes('Contract') ||
          pillText.includes('Temporary') ||
          pillText.includes('Internship') ||
          pillText.includes('Volunteer'))
      ) {
        const jobTypeMatch = pillText.match(
          /\b(Full-time|Part-time|Contract|Temporary|Internship|Volunteer|Casual|Contractor)\b/i,
        );
        if (jobTypeMatch) jobType = jobTypeMatch[0];
      }

      // Check for salary
      if (
        !salary &&
        (pillText.match(/\$|€|£|¥|₹|Salary|salary|\/yr|\/hour|\/month|\/week|Bonus|bonus/i) || pillText.match(/\d+K/i))
      ) {
        salary = pillText.replace(/See how you compare.*/i, '').trim(); // Remove trailing text
      }
    });

    // Specific check for salary range element if not found in pills
    if (!salary) {
      const salaryContainer = mainContainer.querySelector(
        '.compensation__salary-range, [class*="salary-"], .jobs-unified-top-card__salary-info',
      ); // Added one more selector
      if (salaryContainer) salary = salaryContainer.textContent?.trim() || '';
    }

    // --- Job URL (Prioritize title link, fallback to window.location) ---
    const titleLink = mainContainer.querySelector('h1.t-24 a, .job-details-jobs-unified-top-card__job-title h1 a');
    let jobUrl = window.location.href; // Default to current window URL
    if (titleLink?.getAttribute('href')) {
      try {
        jobUrl = new URL(titleLink.getAttribute('href') || '', window.location.href).href; // Make absolute
      } catch (e) {
        console.warn('Could not create absolute URL from title link:', titleLink.getAttribute('href'), e);
        // Keep window.location.href as fallback
      }
    }

    // Validate essential fields before creating Job object
    if (!title || !company) {
      return null; // Return null if we couldn't get basic info
    }

    // Use the Job class static factory method
    const job = (window as any).Job.createFromLinkedIn({
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

    console.log('Scraped LinkedIn job detail (standalone page):', job);
    return job;
  } catch (error) {
    console.error('Error in scrapeCurrentJobDetail:', error);
    return null;
  }
}

// Scrape detailed job information from the open panel (after clicking a job card)
const scrapeJobDetailFromPanel = (): any => {
  try {
    const panel = document.querySelector('.jobs-search__job-details--container, .scaffold-layout__detail');
    if (!panel) {
      console.warn('Job details panel not found for scraping.');
      return null;
    }

    // --- Title ---
    const titleElement = panel.querySelector(
      '.job-details-jobs-unified-top-card__job-title h1, .t-24.job-details-jobs-unified-top-card__job-title',
    );
    const title =
      titleElement?.textContent?.trim() ||
      panel
        .querySelector('.jobs-details-top-card__job-title, .job-details-jobs-unified-top-card__job-title')
        ?.textContent?.trim() ||
      '';

    // --- Company ---
    const companyLink = panel.querySelector(
      '.job-details-jobs-unified-top-card__company-name a, .jobs-details-top-card__company-url',
    );
    const company =
      companyLink?.textContent?.trim() ||
      panel
        .querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-details-top-card__company-info')
        ?.textContent?.trim() ||
      '';

    // --- Location, Posted Date, Applicant Count ---
    const metaContainer = panel.querySelector(
      '.job-details-jobs-unified-top-card__primary-description-container, .jobs-details-top-card__job-info',
    );
    let location = '';
    let postedDate = '';
    let applicantCount = '';

    if (metaContainer) {
      // First try to get separated spans
      const metaTexts = Array.from(
        metaContainer.querySelectorAll(
          'span[class*="tvm__text"], .job-details-jobs-unified-top-card__primary-description-container > div > span',
        ),
      )
        .map((span: any) => span.textContent.trim())
        .filter((text: string) => text && text !== '·');

      console.log('LinkedIn metaTexts found:', metaTexts);

      // Check if we found properly separated elements (should be multiple with different content)
      const hasProperSeparation = metaTexts.length > 1 && metaTexts.some(text => !text.includes('·'));

      if (hasProperSeparation) {
        // Skip the first element (index 0) as it's usually the combined text
        // Look for the clean location in the separated elements
        location =
          metaTexts.find(
            (text: string, index: number) =>
              index > 0 &&
              !text.includes('ago') &&
              !text.includes('applicant') &&
              !text.includes('people clicked') &&
              !text.includes('Promoted') &&
              !text.includes('Responses managed'),
          ) ||
          metaTexts[1] ||
          '';

        postedDate =
          metaTexts.find(
            (text: string, index: number) => index > 0 && /\d+\s+(day|week|month|year)s?\s+ago/i.test(text),
          ) || '';
        applicantCount =
          metaTexts.find((text: string, index: number) => index > 0 && /applicant|people clicked apply/i.test(text)) ||
          '';
        console.log(
          'LinkedIn parsed from spans - location:',
          location,
          'postedDate:',
          postedDate,
          'applicantCount:',
          applicantCount,
        );
      } else {
        // Fallback to parsing the full text
        console.log('LinkedIn fallback parsing from full text:', metaContainer.textContent);
        const fullText = metaContainer.textContent.trim();
        const parts = fullText.split('·').map((part: string) => part.trim());
        console.log('LinkedIn split parts:', parts);

        if (parts.length >= 1) location = parts[0];

        // Look for time-based patterns for posted date
        const timePattern = /\d+\s+(day|week|month|year)s?\s+ago/i;
        postedDate = parts.find((part: string) => timePattern.test(part)) || '';

        // Look for applicant count in remaining parts
        applicantCount = parts.find((part: string) => /applicant|people clicked apply/i.test(part)) || '';

        console.log(
          'LinkedIn parsed from full text - location:',
          location,
          'postedDate:',
          postedDate,
          'applicantCount:',
          applicantCount,
        );
      }
    }

    // --- Description ---
    let description = '';
    const descriptionContainer = panel.querySelector(
      '.jobs-description__content .jobs-box__html-content, .jobs-description-content__text, div#job-details',
    );
    if (descriptionContainer) {
      const contentDiv = descriptionContainer.querySelector('.mt4') || descriptionContainer;
      description = cleanAndFormatContent(contentDiv);
    } else {
      console.warn('Could not find description container in panel.');
    }

    // --- Company Logo ---
    // Try multiple selectors to find company logo, matching single job scraper
    const logoSelectors = [
      '.artdeco-entity-lockup__image img.evi-image',
      '.jobs-company img.evi-image',
      '.job-details-jobs-unified-top-card__container--two-pane .evi-image',
      '.jobs-unified-top-card__company-logo img',
      '.artdeco-entity-lockup__image img',
      'img.evi-image',
    ];

    let companyLogoUrl = '';
    for (const selector of logoSelectors) {
      const logoElement = panel.querySelector(selector) as HTMLImageElement;
      if (logoElement?.src) {
        companyLogoUrl = logoElement.src;
        break;
      }
    }

    // --- Job Type, Workplace Type, Salary from Pills/Specific Elements ---
    let workplaceType = '';
    let jobType = '';
    let salary = '';

    const pillElements = panel.querySelectorAll(
      '.job-details-preferences-and-skills__pill, .job-details-jobs-unified-top-card__job-insight, .job-details-jobs-unified-top-card__workplace-type',
    );

    pillElements.forEach((pill: any) => {
      const pillText = pill.textContent.trim();
      if (!workplaceType && pill.matches('.job-details-jobs-unified-top-card__workplace-type')) {
        workplaceType = pillText;
      } else if (
        !workplaceType &&
        (pillText.includes('Remote') || pillText.includes('Hybrid') || pillText.includes('On-site'))
      ) {
        if (pillText.includes('Remote')) workplaceType = 'Remote';
        else if (pillText.includes('Hybrid')) workplaceType = 'Hybrid';
        else if (pillText.includes('On-site')) workplaceType = 'On-site';
      }

      if (
        !jobType &&
        (pillText.includes('Full-time') ||
          pillText.includes('Part-time') ||
          pillText.includes('Contract') ||
          pillText.includes('Temporary') ||
          pillText.includes('Internship') ||
          pillText.includes('Volunteer'))
      ) {
        const jobTypeMatch = pillText.match(
          /\b(Full-time|Part-time|Contract|Temporary|Internship|Volunteer|Casual|Contractor)\b/i,
        );
        if (jobTypeMatch) jobType = jobTypeMatch[0];
      }

      if (
        !salary &&
        (pillText.match(/\$|€|£|¥|₹|Salary|salary|\/yr|\/hour|\/month|\/week|Bonus|bonus/i) || pillText.match(/\d+K/i))
      ) {
        salary = pillText.replace(/See how you compare.*/i, '').trim();
      }
    });

    if (!salary) {
      const salaryContainer = panel.querySelector(
        '.compensation__salary-range, [class*="salary-"], .jobs-unified-top-card__salary-info',
      );
      if (salaryContainer) salary = salaryContainer.textContent?.trim() || '';
    }

    // --- Job URL (Extract from title link within the panel if possible) ---
    let detailUrl = '';
    const titleLink = panel.querySelector(
      '.job-details-jobs-unified-top-card__job-title h1 a, .t-24.job-details-jobs-unified-top-card__job-title a',
    );
    if (titleLink?.getAttribute('href')) {
      try {
        detailUrl = new URL(titleLink.getAttribute('href') || '', window.location.href).href;
      } catch (e) {
        console.warn('Could not create absolute URL from panel title link:', titleLink.getAttribute('href'), e);
      }
    }

    // Validate essential fields before creating Job object
    if (!title || !company) {
      return null;
    }

    // Use the Job class static factory method
    const job = (window as any).Job.createFromLinkedIn({
      title,
      company,
      location,
      jobUrl: detailUrl,
      description,
      salary,
      postedDate,
      companyLogoUrl,
      jobType,
      workplaceType,
      applicantCount,
    });

    console.log('Scraped LinkedIn job detail from panel:', job);
    return job;
  } catch (error) {
    console.error('Error scraping LinkedIn job details panel:', error);
    return null;
  }
};

// LinkedIn scraper object - exact copy from working version
const linkedInScraper = {
  isMatch: (url: string) => url.includes('linkedin.com'),
  scrapeJobList: async () => {
    // Add a 1-second delay at the beginning of scraping each page
    console.log('Waiting 1 second after page load before starting LinkedIn scrape...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const jobs: any[] = [];
    console.log('=== LinkedIn Scraping Started ===');
    console.log('Current URL:', window.location.href);

    // Only use the new job card selector for better performance
    const jobNodes = document.querySelectorAll(
      'div.job-card-job-posting-card-wrapper, li.scaffold-layout__list-item[data-occludable-job-id]',
    );
    console.log('Found LinkedIn job nodes:', jobNodes.length);

    // Check if we're already on a job details page with no job cards
    const alreadyOnJobDetail =
      document.querySelector('.jobs-search__job-details--container') ||
      document.querySelector('.jobs-details__main-content');
    const detailsAlreadyOpen = !!alreadyOnJobDetail;

    // If we're on a standalone job detail page with no job cards
    if (detailsAlreadyOpen && jobNodes.length === 0) {
      console.log('On standalone job details page, scraping current job');
      const jobDetail = await scrapeCurrentJobDetail();
      if (jobDetail) {
        jobs.push(jobDetail);
      }
      return { jobs, nextUrl: null };
    }

    // Process jobs using the enhanced method - click on each job card to view details
    if (jobNodes.length > 0) {
      console.log('Processing jobs using click and scrape method');
      // Attempt to identify the correct scrollable container for the job list
      let scrollContainer: Element | null = null;
      if (jobNodes.length > 0) {
        const firstJobNode = jobNodes[0];
        const parentLi =
          firstJobNode.tagName === 'LI' ? firstJobNode : firstJobNode.closest('li.scaffold-layout__list-item');

        if (parentLi && parentLi.parentElement && parentLi.parentElement.tagName === 'UL') {
          const jobListUL = parentLi.parentElement;
          if (jobListUL.parentElement && jobListUL.parentElement.tagName === 'DIV') {
            scrollContainer = jobListUL.parentElement;
            console.log('Determined scroll container to be:', scrollContainer.className);
            const style = window.getComputedStyle(scrollContainer);
            if (
              !(
                style.overflowY === 'auto' ||
                style.overflowY === 'scroll' ||
                style.overflow === 'auto' ||
                style.overflow === 'scroll'
              )
            ) {
              console.warn(
                'Warning: Identified scroll container may not be configured for vertical scrolling. Its overflow-y is:',
                style.overflowY,
                'and overflow is:',
                style.overflow,
              );
            }
          }
        }
      }

      // Fallback if the specific container isn't found by the new logic
      if (!scrollContainer) {
        scrollContainer = document.querySelector('.scaffold-layout__list');
        if (scrollContainer) {
          console.log('Using fallback scroll container selector: .scaffold-layout__list');
        } else {
          console.warn(
            'Scroll container not identified. Will rely on node.scrollIntoView() which might scroll the main window.',
          );
        }
      }

      // Function to check if job details panel is fully loaded with exponential backoff
      const waitForJobDetailsPanel = async () => {
        let attempts = 0;
        const maxAttempts = (window as any).TIMEOUT_CONFIG?.LINKEDIN?.JOB_PANEL_MAX_ATTEMPTS || 30; // Use centralized config
        let waitTime = 200; // Start with 200ms

        console.log('🔍 Waiting for LinkedIn job details panel to load...');

        while (attempts < maxAttempts) {
          const detailsPanel = document.querySelector('.jobs-search__job-details--container');
          const loadingSpinner = document.querySelector('.jobs-search__job-details--loading');
          const detailContent = document.querySelector('.jobs-details__main-content');

          // Also check alternative selectors
          const alternativePanel = document.querySelector('.scaffold-layout__detail');
          const jobTitle = document.querySelector('.job-details-jobs-unified-top-card__job-title h1');

          // Check for error messages that might indicate rate limiting
          const errorMsg = document.querySelector('.artdeco-inline-feedback--error');

          if (errorMsg && errorMsg.textContent?.includes('429')) {
            console.warn('Detected rate limiting (429 error). Waiting longer before retry...');
            // Wait for 5 seconds before continuing if we detect a 429 error
            await new Promise(r => setTimeout(r, 5000));
            return false;
          }

          // Check if panel is loaded with content
          const isPanelLoaded = (detailsPanel && detailContent && !loadingSpinner) || (alternativePanel && jobTitle);

          if (isPanelLoaded) {
            // Additional check to ensure the content is actually populated
            const titleText = jobTitle?.textContent?.trim();

            if (titleText && titleText.length > 0) {
              console.log(`✅ LinkedIn panel loaded with job: "${titleText}"`);
              // Wait a bit more to ensure content is fully rendered
              await new Promise(r => setTimeout(r, 500)); // Increased from 300ms
              return true;
            }
          }

          // Exponential backoff - double the wait time after each attempt, with a max of 1.5 seconds
          const maxWait = (window as any).TIMEOUT_CONFIG?.LINKEDIN?.JOB_PANEL_MAX_WAIT || 3000;
          waitTime = Math.min(waitTime * 1.5, maxWait); // Use centralized max wait time
          console.log(
            `⏳ Waiting ${waitTime}ms for LinkedIn job details panel (attempt ${attempts + 1}/${maxAttempts})`,
          );
          await new Promise(r => setTimeout(r, waitTime));
          attempts++;
        }

        console.warn('❌ LinkedIn job details panel did not load in time');
        return false;
      };

      // If a job detail is already open, scrape it first before moving to other jobs
      if (detailsAlreadyOpen) {
        console.log('Job details panel already open, scraping it first');
        const currentJobDetail = scrapeJobDetailFromPanel();
        if (currentJobDetail && Object.keys(currentJobDetail).length > 0) {
          const job = (window as any).Job.createFromLinkedIn({
            title: currentJobDetail.title || '',
            company: currentJobDetail.company || '',
            location: currentJobDetail.location || '',
            salary: currentJobDetail.salary || '',
            description: currentJobDetail.description || '',
            postedDate: currentJobDetail.postedDate || '',
            jobUrl: currentJobDetail.jobUrl || window.location.href,
            companyLogoUrl: currentJobDetail.companyLogoUrl || null,
            jobType: currentJobDetail.jobType || '',
            workplaceType: currentJobDetail.workplaceType || '',
            applicantCount: currentJobDetail.applicantCount || '',
          });
          jobs.push(job);
          console.log(`Successfully scraped initially open job detail: ${job.title}`);
        }
      }

      // Get the currently selected job card if any
      const selectedJobCard = document.querySelector(
        'div.job-card-job-posting-card-wrapper.artdeco-entity-lockup--selected',
      );

      // Process each job node one by one, skipping the already selected one
      for (let i = 0; i < Math.min(jobNodes.length, 30); i++) {
        try {
          const node = jobNodes[i];

          // Skip the node if it's already selected (we scraped it above)
          if (selectedJobCard && node === selectedJobCard && i === 0 && detailsAlreadyOpen) {
            console.log('Skipping already selected job card');
            continue;
          }

          // Send progress update
          try {
            chrome.runtime.sendMessage({
              type: 'SCRAPING_PROGRESS',
              data: {
                platform: 'linkedin',
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
          const titleNode = node.querySelector('.artdeco-entity-lockup__title');
          const companyNode = node.querySelector('.artdeco-entity-lockup__subtitle div[dir="ltr"]');

          // Basic info for fallback
          const basicInfo = {
            title: titleNode?.textContent?.trim() || '',
            company: companyNode?.textContent?.trim() || '',
            jobUrl: '',
          };

          // Simple scroll to bring the job card into view
          if (scrollContainer) {
            console.log(
              `Scrolling specific container for job ${i + 1} (${basicInfo.title}). Container class: ${scrollContainer.className}`,
            );
            const nodeRect = node.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();

            const scrollOffset = nodeRect.top - containerRect.top;
            const desiredNodePositionInContainer = Math.min(scrollContainer.clientHeight / 3, 150);

            const newScrollTop = scrollContainer.scrollTop + scrollOffset - desiredNodePositionInContainer;

            console.log(
              `Node top: ${nodeRect.top.toFixed(0)}, Container top: ${containerRect.top.toFixed(0)}, Current scrollTop: ${scrollContainer.scrollTop.toFixed(0)}, Calculated new scrollTop: ${newScrollTop.toFixed(0)}`,
            );
            if ('scrollTo' in scrollContainer && typeof scrollContainer.scrollTo === 'function') {
              scrollContainer.scrollTo({ top: Math.max(0, newScrollTop), behavior: 'smooth' });
            } else {
              scrollContainer.scrollTop = Math.max(0, newScrollTop);
            }
          } else {
            console.log(`Scrolling window for job ${i + 1} (${basicInfo.title}) into view (fallback)...`);
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          await new Promise(resolve => setTimeout(resolve, 100));

          console.log(
            `Processing job ${i + 1}/${Math.min(jobNodes.length, 30)}: "${basicInfo.title || '(title missing)'}"`,
          );

          // Find the INTENDED clickable element - try multiple selectors
          let clickableAnchor =
            node.querySelector('a.job-card-list__title--link') ||
            node.querySelector('a[data-job-id]') ||
            node.querySelector('.artdeco-entity-lockup__title a') ||
            node.querySelector('h3 a') ||
            node.querySelector('a[href*="/jobs/view/"]');

          // Populate jobUrl from the anchor if found, and update basicInfo
          if (clickableAnchor && (clickableAnchor as HTMLAnchorElement).href) {
            try {
              basicInfo.jobUrl = new URL((clickableAnchor as HTMLAnchorElement).href, window.location.origin).href;
            } catch (e) {
              console.warn(`[Job ${i + 1}] Failed to parse anchor href:`, e);
              const jobCardDiv = node.querySelector('div[data-job-id]');
              const dataJobId = jobCardDiv ? (jobCardDiv as any).dataset.jobId : (node as any).dataset.jobId;
              if (dataJobId) {
                basicInfo.jobUrl = `https://www.linkedin.com/jobs/view/${dataJobId}`;
              }
            }
          } else {
            const jobCardDiv = node.querySelector('div[data-job-id]');
            const dataJobId = jobCardDiv ? (jobCardDiv as any).dataset.jobId : (node as any).dataset.jobId;
            if (dataJobId) {
              basicInfo.jobUrl = `https://www.linkedin.com/jobs/view/${dataJobId}`;
            }
          }

          // If no clickable anchor found, try to make the job card itself clickable
          if (!clickableAnchor) {
            console.log(`No direct anchor found for job ${i + 1}, trying to click the job card directly`);
            clickableAnchor = node as Element;
          }

          // Validate node and clickable element before proceeding
          if (!basicInfo.title) {
            console.warn(`Skipping job ${i + 1} ("${basicInfo.title || 'EMPTY'}") due to missing title.`);
            continue;
          }

          console.log(
            `Clicking job element for "${basicInfo.title}" (${clickableAnchor ? clickableAnchor.tagName : 'N/A'})`,
          );

          // Try multiple click methods to ensure the click works
          try {
            // Method 1: Direct click
            if (clickableAnchor) {
              (clickableAnchor as HTMLElement).click();
              console.log(`✓ Clicked using direct click on ${clickableAnchor.tagName}`);
            }

            // Method 2: If that didn't work, try clicking the job card container
            if (!document.querySelector('.jobs-search__job-details--container .jobs-details__main-content')) {
              console.log('Trying alternative click on job card container...');
              const jobCard = node.querySelector('.job-card-container') || node;
              (jobCard as HTMLElement).click();
            }

            // Method 3: Dispatch click event as fallback
            if (!document.querySelector('.jobs-search__job-details--container .jobs-details__main-content')) {
              console.log('Trying synthetic click event...');
              const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true,
              });
              if (clickableAnchor) {
                clickableAnchor.dispatchEvent(clickEvent);
              }
            }
          } catch (clickError) {
            console.warn(`Click failed for job ${i + 1}:`, clickError);
          }

          // Wait for job details panel to load or update with exponential backoff
          const detailsLoaded = await waitForJobDetailsPanel();

          if (detailsLoaded) {
            // Scrape the detailed job information
            const jobDetail = scrapeJobDetailFromPanel();

            if (jobDetail && Object.keys(jobDetail).length > 0) {
              // Create job with detailed info
              const job = (window as any).Job.createFromLinkedIn({
                title: jobDetail.title || basicInfo.title,
                company: jobDetail.company || basicInfo.company,
                location: jobDetail.location || '',
                salary: jobDetail.salary || '',
                description: jobDetail.description || '',
                postedDate: jobDetail.postedDate || '',
                jobUrl: jobDetail.jobUrl || basicInfo.jobUrl,
                companyLogoUrl: jobDetail.companyLogoUrl || null,
                jobType: jobDetail.jobType || '',
                workplaceType: jobDetail.workplaceType || '',
                applicantCount: jobDetail.applicantCount || '',
              });

              jobs.push(job);
              console.log(`Successfully scraped detailed job: ${job.title}`);
            } else {
              // Fallback to basic info if detailed scraping failed
              console.log(`Failed to get details, using basic info for job ${i + 1}`);
              const job = (window as any).Job.createFromLinkedIn(basicInfo);
              jobs.push(job);
            }
          } else {
            // Fallback to basic info if panel didn't load
            console.log(`Job details panel didn't load for job ${i + 1}, using basic info`);
            const job = (window as any).Job.createFromLinkedIn(basicInfo);
            jobs.push(job);
          }

          // Add delay between job clicks - increased for better tab activation
          const baseDelay = 800; // Increased from 500ms
          const randomDelay = Math.random() * 400; // Random component up to 400ms
          const totalDelay = baseDelay + randomDelay;
          console.log(`Waiting ${totalDelay.toFixed(0)}ms before next job click...`);
          await new Promise(r => setTimeout(r, totalDelay));
        } catch (error) {
          console.error(`Error processing job ${i + 1}:`, error);
          // Add error recovery delay
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    // Try to find the next button first
    const nextButton = document.querySelector(
      [
        'button.jobs-search-pagination__button--next',
        'button.artdeco-button--icon-right[aria-label="View next page"]',
        'button.artdeco-button[data-test-pagination-page-btn]',
      ].join(','),
    );

    // If next button exists, use it
    if (nextButton) {
      (nextButton as HTMLElement).click();
    } else {
      // Check if we're on the last page
      const currentPageElement = document.querySelector('.jobs-search-pagination__indicator-button--active');
      if (currentPageElement) {
        // Try to get the page state text (e.g., "Page 11 of 14")
        const pageStateText = document.querySelector('.jobs-search-pagination__page-state')?.textContent || '';
        const match = pageStateText.match(/Page (\d+) of (\d+)/);

        if (match && match[1] !== match[2]) {
          // We're not on the last page, find the next page button
          const currentPage = parseInt(match[1], 10);

          // Try to find a button with the next page number
          const nextPageButton = document.querySelector(
            `.jobs-search-pagination__indicator-button[aria-label="Page ${currentPage + 1}"]`,
          );

          if (nextPageButton) {
            (nextPageButton as HTMLElement).click();
          } else {
            // If we can't find a specific next page button, try to find any page after current
            const allPageButtons = Array.from(document.querySelectorAll('.jobs-search-pagination__indicator-button'));
            const currentPageIndex = allPageButtons.findIndex(btn => btn.hasAttribute('aria-current'));

            if (currentPageIndex !== -1 && currentPageIndex < allPageButtons.length - 1) {
              (allPageButtons[currentPageIndex + 1] as HTMLElement).click();
            }
          }
        }
      }
    }

    // Check for next page with specific LinkedIn next button selector
    let nextUrl = null;

    // Get page state information
    const pageStateText = document.querySelector('.jobs-search-pagination__page-state')?.textContent || '';
    const match = pageStateText.match(/Page (\d+) of (\d+)/);

    if (match && match[1] !== match[2]) {
      // We're not on the last page, create URL for next page
      const currentUrl = new URL(window.location.href);
      const currentStart = parseInt(currentUrl.searchParams.get('start') || '0');
      const pageSize = 25; // LinkedIn's default page size

      // Create next page URL
      currentUrl.searchParams.set('start', (currentStart + pageSize).toString());
      nextUrl = currentUrl.toString();
    }

    console.log(`=== LinkedIn Scraping Complete: ${jobs.length} jobs found ===`);
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
        `💾 Stored ${jobs.length} LinkedIn jobs in localStorage (total: ${trimmedJobs.length}, trimmed from ${allJobs.length})`,
      );
    } catch (error) {
      console.error('Failed to store jobs in localStorage:', error);
      // Try to clear only job data and store current page jobs (preserve user preferences)
      try {
        localStorage.removeItem('jobjourney_scraped_jobs');
        localStorage.removeItem('jobjourney_last_scrape');
        localStorage.setItem('jobjourney_scraped_jobs', JSON.stringify(jobs));
        localStorage.setItem('jobjourney_last_scrape', new Date().toISOString());
        console.log(`💾 Stored ${jobs.length} LinkedIn jobs in localStorage (quota recovery, preferences preserved)`);
      } catch (secondError) {
        console.error('Failed to store jobs even after clearing:', secondError);
      }
    }

    return {
      jobs,
      nextUrl,
    };
  },
};

// Assign to window object for global access
window.linkedInScraper = linkedInScraper;

console.log('🔵 LinkedIn scraper loaded');
