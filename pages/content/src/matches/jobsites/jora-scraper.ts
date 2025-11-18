// Jora job scraper
export {};

interface JoraJobPayload {
  jobId: string;
  tk: string;
  sp: string;
  applySp?: string | null;
  sponsored: boolean;
  sr?: number;
  abstractType?: string;
  searchParams?: Record<string, string | null>;
  currentPage?: number;
  solKey?: string;
}

interface ParsedJobDetail {
  title?: string;
  company?: string;
  location?: string;
  postedDate?: string;
  jobType?: string;
  workplaceType?: string;
  salary?: string;
  description?: string;
  companyLogoUrl?: string | null;
}

const MAX_JOBS = 30;

const textContent = (element: Element | null | undefined): string =>
  element?.textContent?.replace(/\s+/g, ' ').trim() || '';

const normalizeDescription = (text: string): string =>
  text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const queryText = (doc: Document, selectors: string[]): string => {
  for (const selector of selectors) {
    const node = doc.querySelector(selector);
    if (node?.textContent?.trim()) {
      return textContent(node);
    }
  }
  return '';
};

const parseJobDescriptionHtml = (html: string): ParsedJobDetail => {
  if (!html) return {};

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const descriptionElement =
    doc.querySelector('.job-description-container') ||
    doc.querySelector('.job-description') ||
    doc.querySelector('.job-ad-text') ||
    doc.querySelector('[data-testid="job-description"]') ||
    doc.querySelector('.job-view-body') ||
    doc.body;

  const badgeTexts = Array.from(doc.querySelectorAll('.badge .content'))
    .map(el => el.textContent?.trim() || '')
    .filter(Boolean);

  const jobTypeBadge = badgeTexts.find(text => /full time|part time|contract|permanent|casual/i.test(text));
  const workArrangementBadge = badgeTexts.find(text => /hybrid|remote|on[- ]?site/i.test(text));
  const salaryBadge = badgeTexts.find(text => /\$|per year|per hour|salary/i.test(text));

  const jobMeta = doc.querySelector('#job-meta');
  const postedDate = jobMeta?.querySelector('.listed-date')?.textContent?.trim() || '';

  return {
    title: queryText(doc, ['.job-view-title', '.job-title', 'header h1', 'h1']),
    company: queryText(doc, [
      '#company-location-container .company',
      '.job-view-company',
      '.company',
      '.job-company a',
      '.job-company',
      '.job-view-subheader a',
      '.job-view-subheader span',
    ]),
    location: queryText(doc, [
      '#company-location-container .location',
      '.job-view-location',
      '.job-location',
      '.job-view-subheader li',
      '.job-meta li',
    ]),
    datePosted: postedDate,
    jobType: jobTypeBadge || queryText(doc, ['.job-view-employment-type', '.job-meta li[data-icon="briefcase"]']),
    workplaceType:
      workArrangementBadge ||
      queryText(doc, ['.job-view-work-arrangement', '.job-meta li[data-icon="location"] span:nth-child(2)']),
    salary: salaryBadge || queryText(doc, ['.job-view-salary', '.job-salary']),
    description: descriptionElement ? normalizeDescription(descriptionElement.textContent || '') : '',
    companyLogoUrl:
      (doc.querySelector('.job-view-company-logo img, .job-view-header img') as HTMLImageElement)?.src || null,
  };
};

const buildDescriptionUrl = (payload: JoraJobPayload): string => {
  const params: Record<string, string> = {
    tk: payload.tk,
    sp: payload.sp,
    sponsored: String(payload.sponsored),
  };

  if (payload.currentPage) params.cp = String(payload.currentPage);
  if (payload.sr !== undefined) params.sr = String(payload.sr);
  if (payload.applySp) params.apply_sp = payload.applySp;
  if (payload.abstractType) params.abstract_type = payload.abstractType;
  if (payload.solKey) params.sol_key = payload.solKey;

  if (payload.searchParams) {
    Object.entries(payload.searchParams).forEach(([key, value]) => {
      if (value) params[key] = value;
    });
  }

  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `/job/description/${encodeURIComponent(payload.jobId)}${query ? `?${query}` : ''}`;
};

const fetchJobDescription = async (payload: JoraJobPayload): Promise<ParsedJobDetail> => {
  try {
    const url = buildDescriptionUrl(payload);
    const response = await fetch(url, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Jora job description: ${response.status}`);
    }

    const html = await response.text();
    return parseJobDescriptionHtml(html);
  } catch (error) {
    console.warn('Jora description fetch failed', error);
    return {};
  }
};

const buildJobUrl = (anchor: HTMLAnchorElement | null): string => {
  if (!anchor) return window.location.href;
  try {
    return new URL(anchor.href, window.location.origin).href;
  } catch (error) {
    console.warn('Failed to resolve Jora job URL', error);
    return anchor.href;
  }
};

const joraScraper = {
  isMatch: (url: string) => url.includes('jora.com'),
  scrapeJobList: async () => {
    const jobs: any[] = [];
    const jobCards = Array.from(document.querySelectorAll('.job-card[data-jd-payload]'));

    console.log(`🔵 Jora scraper detected ${jobCards.length} cards`);

    for (let index = 0; index < Math.min(jobCards.length, MAX_JOBS); index += 1) {
      const card = jobCards[index] as HTMLElement;

      try {
        const payloadRaw = card.getAttribute('data-jd-payload');
        if (!payloadRaw) {
          console.warn('Skipping job without payload');
          continue;
        }

        let payload: JoraJobPayload | null = null;
        try {
          payload = JSON.parse(payloadRaw);
        } catch (error) {
          console.warn('Failed to parse Jora payload', error);
        }

        if (!payload?.jobId) {
          console.warn('Invalid Jora payload', payloadRaw);
          continue;
        }

        const titleNode = card.querySelector<HTMLAnchorElement>('.job-title a.job-link, .job-title a');
        const companyNode = card.querySelector('.job-company');
        const locationNode = card.querySelector('.job-location');
        const postedDateNode = card.querySelector('.job-listed-date');
        const jobUrl = buildJobUrl(titleNode);

        const abstractItems = Array.from(card.querySelectorAll('.job-abstract li'))
          .map(li => li.textContent?.trim())
          .filter(Boolean)
          .join('\n');

        const badges = Array.from(card.querySelectorAll('.badges .badge .content'))
          .map(badge => badge.textContent?.trim())
          .filter(Boolean)
          .join(', ');

        const basicJobData = {
          title: textContent(titleNode),
          company: textContent(companyNode),
          location: textContent(locationNode),
          jobUrl,
          postedDate: textContent(postedDateNode),
          description: abstractItems,
          jobType: badges,
        };

        const detail = await fetchJobDescription(payload);
        const mergedJob: any = {
          ...basicJobData,
          ...detail,
        };

        ['title', 'company', 'location', 'description', 'salary', 'jobType', 'workplaceType', 'datePosted'].forEach(
          key => {
            if (!detail?.[key] && basicJobData[key as keyof typeof basicJobData]) {
              mergedJob[key] = basicJobData[key as keyof typeof basicJobData];
            }
          },
        );

        const job = (window as any).Job.createJoraJob(mergedJob);

        jobs.push(job);

        try {
          chrome.runtime.sendMessage({
            type: 'SCRAPING_PROGRESS',
            data: {
              platform: 'jora',
              current: index + 1,
              total: Math.min(jobCards.length, MAX_JOBS),
              jobsFound: jobs.length,
            },
          });
        } catch (progressError) {
          if (progressError.message?.includes('Extension context invalidated')) {
            console.log('Extension context invalidated while sending progress');
            break;
          }
          console.warn('Failed to send Jora scraping progress', progressError);
        }

        await new Promise(resolve => setTimeout(resolve, 400));
      } catch (error) {
        console.error(`Error scraping Jora job card ${index + 1}`, error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const nextPageLink =
      document.querySelector<HTMLAnchorElement>(
        '.multi-pages-pagination .next-page-button[href], .mobile-pagination a[href*="p="]',
      )?.href || null;

    try {
      const existingJobsStr = localStorage.getItem('jobjourney_scraped_jobs') || '[]';
      let existingJobs = [];

      try {
        existingJobs = JSON.parse(existingJobsStr);
      } catch (parseError) {
        console.warn('Failed to parse stored Jora jobs, resetting list', parseError);
        existingJobs = [];
      }

      const allJobs = [...existingJobs, ...jobs];
      const trimmedJobs = allJobs.slice(-1000);

      localStorage.setItem('jobjourney_scraped_jobs', JSON.stringify(trimmedJobs));
      localStorage.setItem('jobjourney_last_scrape', new Date().toISOString());
    } catch (storageError) {
      console.error('Failed to persist Jora jobs in localStorage', storageError);
    }

    return {
      jobs,
      nextUrl: nextPageLink,
    };
  },
};

(window as any).joraScraper = joraScraper;

console.log('🔵 Jora scraper loaded');
