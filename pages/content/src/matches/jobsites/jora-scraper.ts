// Jora job scraper
import { MessageType } from '@extension/types';

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
const POPUP_GUARD_INTERVAL_MS = 400;
const SCROLL_LOCK_VALUES = new Set(['hidden', 'clip']);
const JORA_DIALOG_SELECTORS = [
  '[role="dialog"]',
  '[aria-modal="true"]',
  '[data-testid*="modal"]',
  '[data-testid*="dialog"]',
  '[class*="modal"]',
  '[class*="dialog"]',
  '[class*="popup"]',
];
const JORA_CLOSE_CONTROL_SELECTORS = [
  '[aria-label*="close" i]',
  '[aria-label*="dismiss" i]',
  '[title*="close" i]',
  '[title*="dismiss" i]',
  '[data-testid*="close" i]',
  '[data-testid*="dismiss" i]',
  'button[type="button"]',
  'button',
  '[role="button"]',
];
const JORA_CLOSE_TEXT_PATTERNS = [
  /^close$/i,
  /^dismiss$/i,
  /^no thanks$/i,
  /^not now$/i,
  /^skip$/i,
  /^maybe later$/i,
  /^later$/i,
  /^continue$/i,
  /^continue without/i,
];

const textContent = (element: Element | null | undefined): string =>
  element?.textContent?.replace(/\s+/g, ' ').trim() || '';

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const isVisible = (element: Element | null | undefined): element is HTMLElement => {
  if (!(element instanceof HTMLElement)) return false;

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  return true;
};

const isScrollLocked = (): boolean => {
  const htmlStyle = window.getComputedStyle(document.documentElement);
  const bodyStyle = window.getComputedStyle(document.body);

  return (
    SCROLL_LOCK_VALUES.has(htmlStyle.overflowY) ||
    SCROLL_LOCK_VALUES.has(htmlStyle.overflow) ||
    SCROLL_LOCK_VALUES.has(bodyStyle.overflowY) ||
    SCROLL_LOCK_VALUES.has(bodyStyle.overflow)
  );
};

const unlockPageScroll = (): boolean => {
  let changed = false;

  const unlock = (element: HTMLElement) => {
    if (SCROLL_LOCK_VALUES.has(element.style.overflow) || SCROLL_LOCK_VALUES.has(element.style.overflowY)) {
      element.style.removeProperty('overflow');
      element.style.removeProperty('overflow-y');
      changed = true;
    }
  };

  unlock(document.documentElement);
  unlock(document.body);

  return changed;
};

const getVisibleDialogCandidates = (): HTMLElement[] => {
  const seen = new Set<HTMLElement>();
  const candidates: HTMLElement[] = [];

  for (const selector of JORA_DIALOG_SELECTORS) {
    for (const node of Array.from(document.querySelectorAll(selector))) {
      if (!isVisible(node)) continue;
      if (seen.has(node)) continue;
      seen.add(node);
      candidates.push(node);
    }
  }

  for (const node of Array.from(document.body.children)) {
    if (!isVisible(node)) continue;

    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const isLikelyOverlay =
      style.position === 'fixed' && rect.width >= window.innerWidth * 0.4 && rect.height >= window.innerHeight * 0.25;

    if (!isLikelyOverlay || seen.has(node)) continue;
    seen.add(node);
    candidates.push(node);
  }

  return candidates.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    return rightRect.width * rightRect.height - leftRect.width * leftRect.height;
  });
};

const clickDismissControl = (root: HTMLElement): boolean => {
  for (const selector of JORA_CLOSE_CONTROL_SELECTORS) {
    for (const node of Array.from(root.querySelectorAll(selector))) {
      if (!(node instanceof HTMLElement) || !isVisible(node)) continue;

      const label = textContent(node);
      const ariaLabel = node.getAttribute('aria-label')?.trim() || '';
      const title = node.getAttribute('title')?.trim() || '';
      const candidateText = [label, ariaLabel, title].find(Boolean) || '';

      if (!candidateText || !JORA_CLOSE_TEXT_PATTERNS.some(pattern => pattern.test(candidateText))) {
        continue;
      }

      node.click();
      return true;
    }
  }

  return false;
};

const dismissBlockingDialog = (): boolean => {
  const candidates = getVisibleDialogCandidates();

  for (const candidate of candidates) {
    const clicked = clickDismissControl(candidate);
    if (clicked) {
      console.log('🧹 Dismissed Jora blocking dialog');
      unlockPageScroll();
      return true;
    }

    if (isScrollLocked()) {
      candidate.remove();
      unlockPageScroll();
      console.log('🧹 Removed Jora blocking dialog without close control');
      return true;
    }
  }

  return unlockPageScroll();
};

const startPopupGuard = (): (() => void) => {
  dismissBlockingDialog();

  const intervalId = window.setInterval(() => {
    dismissBlockingDialog();
  }, POPUP_GUARD_INTERVAL_MS);

  const observer = new MutationObserver(() => {
    dismissBlockingDialog();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'aria-hidden', 'aria-modal'],
  });

  return () => {
    window.clearInterval(intervalId);
    observer.disconnect();
  };
};

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
    postedDate,
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
  isMatch: (url: string) => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname === 'jora.com' || hostname.endsWith('.jora.com');
    } catch {
      return false;
    }
  },
  scrapeJobList: async () => {
    const stopPopupGuard = startPopupGuard();
    const jobs: any[] = [];

    try {
      await wait(250);
      dismissBlockingDialog();

      const jobCards = Array.from(document.querySelectorAll('.job-card[data-jd-payload]'));

      console.log(`🔵 Jora scraper detected ${jobCards.length} cards`);

      for (let index = 0; index < Math.min(jobCards.length, MAX_JOBS); index += 1) {
        const card = jobCards[index] as HTMLElement;

        try {
          dismissBlockingDialog();

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
            salary: '',
            workplaceType: '',
          };

          const detail = await fetchJobDescription(payload);
          const mergedJob: any = {
            ...basicJobData,
            ...detail,
          };

          const mergeKeys = [
            'title',
            'company',
            'location',
            'description',
            'salary',
            'jobType',
            'workplaceType',
            'postedDate',
          ] as const;

          mergeKeys.forEach(key => {
            const basicValue = basicJobData[key];
            if (!detail?.[key] && basicValue) {
              mergedJob[key] = basicValue;
            }
          });

          const job = (window as any).Job.createFromJora(mergedJob);

          jobs.push(job);

          try {
            chrome.runtime.sendMessage({
              type: MessageType.SCRAPING_PROGRESS,
              data: {
                platform: 'jora',
                current: index + 1,
                total: Math.min(jobCards.length, MAX_JOBS),
                jobsFound: jobs.length,
              },
            });
          } catch (progressError) {
            if (progressError instanceof Error && progressError.message.includes('Extension context invalidated')) {
              console.log('Extension context invalidated while sending progress');
              break;
            }
            console.warn('Failed to send Jora scraping progress', progressError);
          }

          await wait(400);
        } catch (error) {
          console.error(`Error scraping Jora job card ${index + 1}`, error);
          await wait(1000);
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
    } finally {
      stopPopupGuard();
      dismissBlockingDialog();
    }
  },
};

(window as any).joraScraper = joraScraper;

console.log('🔵 Jora scraper loaded');
