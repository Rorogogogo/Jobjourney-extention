// LinkedIn's job pages from late 2026 (/jobs/search-results/ and the new /jobs/view/<id>/).
// Class names there are generated per build ("ekfjq5 ekfjww …"), so nothing here uses them.
// It relies on what LinkedIn keeps stable for its own code and for screen readers:
//   - job cards:      [componentkey="job-card-component-ref-<jobId>"][role="button"]
//   - the open job:   [componentkey="JobDetails_AboutTheJob_<jobId>"] holds the description
//   - the company:    <a aria-label="Company, <name>.">, followed by the job title and a
//                     "location · posted · applicants" line, then pills and Apply/Save buttons
//   - pagination:     [data-testid="pagination-controls-next-button-visible"]
// The older layout's selectors stay where they were; callers try those first.

const CARD_SELECTOR = '[componentkey^="job-card-component-ref-"][role="button"]';
const ABOUT_SELECTOR = '[componentkey^="JobDetails_AboutTheJob_"]';
const COMPANY_LINK_SELECTOR = 'a[aria-label^="Company, "]';

export interface LinkedInCard {
  element: HTMLElement;
  jobId: string;
  title: string;
  company: string;
  location: string;
}

export interface LinkedInDetail {
  jobId: string;
  jobUrl: string;
  title: string;
  company: string;
  location: string;
  postedDate: string;
  applicantCount: string;
  workplaceType: string;
  jobType: string;
  salary: string;
  companyLogoUrl: string;
  /** The description's element, for callers that keep its formatting. */
  descriptionElement: HTMLElement | null;
  description: string;
  /** "Applied 2 days ago" when the page says so. */
  appliedText: string;
  /** The title's element, to place the save button under. */
  titleElement: HTMLElement | null;
}

const WORKPLACE_TYPES = ['Remote', 'Hybrid', 'On-site'];
const JOB_TYPE = /\b(Full-time|Part-time|Contract|Temporary|Internship|Volunteer|Casual|Contractor)\b/i;
const SALARY = /[$€£¥₹]\s?\d|\d+(\.\d+)?K\b|\/yr|\/hr|per (hour|year|annum)/i;
const POSTED = /\bago\b|^(Re)?posted\b/i;
const APPLICANTS = /applicant|clicked apply/i;
const APPLIED = /^Applied\b/i;
// Lines in the top card that aren't facts about the job.
const NOISE = /^(·|Promoted|Responses managed|Apply|Easy Apply|Save|Saved|Show match details|Actively reviewing)/i;

export const jobUrlFor = (jobId: string) => `https://www.linkedin.com/jobs/view/${jobId}/`;

/** True when the page uses the new layout. */
export function isNewLinkedInLayout(): boolean {
  return !!(document.querySelector(CARD_SELECTOR) || document.querySelector(ABOUT_SELECTOR));
}

/** The job cards in the search results, one per job, in page order. */
export function findLinkedInCards(): LinkedInCard[] {
  const seen = new Set<string>();
  const cards: LinkedInCard[] = [];
  document.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach(element => {
    const jobId = idFromKey(element.getAttribute('componentkey'));
    if (!jobId || seen.has(jobId)) return;
    seen.add(jobId);
    // The first aria-hidden span is the visible title; next to it is a screen-reader label
    // ("Selected, <title> (Verified job)"). Company and location are the next <p>s; on
    // some cards the title is in a <p> too, so that one is skipped.
    const titleElement = element.querySelector('span[aria-hidden="true"]');
    const title = text(titleElement);
    const lines = Array.from(element.querySelectorAll('p'))
      .filter(p => !(titleElement && p.contains(titleElement)))
      .map(p => text(p))
      .filter(line => line && !(title && line.includes(title)));
    cards.push({ element, jobId, title, company: lines[0] || '', location: lines[1] || '' });
  });
  return cards;
}

/** The job whose details are showing, from the description's key. */
export function openLinkedInJobId(): string {
  return idFromKey(document.querySelector(ABOUT_SELECTOR)?.getAttribute('componentkey'));
}

/** The next-page button, when there is a next page. */
export function linkedInNextPageButton(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="pagination-controls-next-button-visible"]');
}

/** The open job's details (the panel on a search page, or a /jobs/view/ page). */
export function readLinkedInDetail(): LinkedInDetail | null {
  const companyLink = document.querySelector<HTMLAnchorElement>(COMPANY_LINK_SELECTOR);
  if (!companyLink) return null;
  const topCard = topCardFor(companyLink);
  if (!topCard) return null;

  const company =
    (companyLink.getAttribute('aria-label') || '')
      .replace(/^Company,\s*/, '')
      .replace(/\.$/, '')
      .trim() || text(companyLink);

  // Text lines of the top card in reading order, after the company link.
  const lines: { text: string; element: HTMLElement }[] = [];
  const walker = document.createTreeWalker(topCard, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    const value = node.textContent?.replace(/\s+/g, ' ').trim();
    if (!parent || !value || companyLink.contains(parent)) continue;
    if (parent.closest('[aria-hidden="true"]')) continue;
    if (companyLink.compareDocumentPosition(parent) & Node.DOCUMENT_POSITION_PRECEDING) continue;
    lines.push({ text: value.replace(/\s*·$/, ''), element: parent });
  }
  if (lines.length === 0) return null;

  const [titleLine, ...rest] = lines;
  const facts = rest.map(line => line.text).filter(value => value && !NOISE.test(value));

  const postedDate = facts.find(value => POSTED.test(value) && !APPLIED.test(value)) || '';
  const applicantCount = facts.find(value => APPLICANTS.test(value)) || '';
  const appliedText = rest.map(line => line.text).find(value => APPLIED.test(value)) || '';
  const workplaceType = facts.find(value => WORKPLACE_TYPES.includes(value)) || '';
  const jobType = facts.map(value => value.match(JOB_TYPE)?.[0]).find(Boolean) || '';
  const salary = facts.find(value => SALARY.test(value)) || '';
  const location =
    facts.find(
      value =>
        value !== postedDate &&
        value !== applicantCount &&
        value !== appliedText &&
        value !== workplaceType &&
        value !== salary &&
        !JOB_TYPE.test(value),
    ) || '';

  const about = document.querySelector<HTMLElement>(ABOUT_SELECTOR);
  const descriptionElement = about?.querySelector<HTMLElement>('[data-testid="expandable-text-box"]') || about || null;
  const description = (descriptionElement?.innerText || descriptionElement?.textContent || '')
    .replace(/^\s*About the job\s*/i, '')
    .trim();

  const logo =
    topCard.querySelector<HTMLImageElement>('img[alt^="Company logo"]') ||
    topCard.parentElement?.querySelector<HTMLImageElement>('img[alt^="Company logo"]') ||
    null;

  const jobId = openLinkedInJobId() || idFromUrl(window.location.href);

  return {
    jobId,
    jobUrl: jobId ? jobUrlFor(jobId) : window.location.href.split('?')[0],
    title: titleLine.text,
    company,
    location,
    postedDate,
    applicantCount,
    workplaceType,
    jobType,
    salary,
    companyLogoUrl: logo?.src || '',
    descriptionElement,
    description,
    appliedText,
    titleElement: titleLine.element,
  };
}

/** The block holding the company, title, facts and the Apply/Save buttons. */
function topCardFor(companyLink: HTMLElement): HTMLElement | null {
  // The pills (Hybrid, Full-time) sit next to the Apply and Save buttons, outside the
  // smaller block that already has a "More options" button and the "·" line.
  const hasApplyOrSave = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('button')).some(button =>
      /^(Save|Apply|Easy Apply)\b/i.test(button.getAttribute('aria-label') || button.textContent?.trim() || ''),
    );
  const hasFacts = (element: HTMLElement) =>
    !!element.querySelector('button') && (element.textContent || '').includes('·');
  for (const isTopCard of [hasApplyOrSave, hasFacts]) {
    let element: HTMLElement | null = companyLink;
    for (let depth = 0; element && depth < 12; depth++) {
      if (isTopCard(element)) return element;
      element = element.parentElement;
    }
  }
  return null;
}

function idFromKey(key: string | null | undefined): string {
  return key?.match(/(\d{6,})$/)?.[1] || '';
}

function idFromUrl(url: string): string {
  return url.match(/\/jobs\/view\/(\d+)/)?.[1] || url.match(/currentJobId=(\d+)/)?.[1] || '';
}

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() || '';
}
