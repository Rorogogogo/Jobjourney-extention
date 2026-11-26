// Fields a job board doesn't always show, filled the same way for scraped and saved jobs.
import type { JobAnalysisResult } from '@extension/types';

const LABELS: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  'on-site': 'On-site',
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
  casual: 'Casual',
};

const label = (type: string | undefined) => (type && type !== 'unknown' ? LABELS[type] || type : '');

/** Job type, work arrangement and skills read from the description, for when the page didn't say. */
export function analysisFallbacks(analysis: JobAnalysisResult | undefined) {
  return {
    jobType: label(analysis?.employmentType?.type),
    workArrangement: label(analysis?.workArrangement?.type),
    requiredSkills: analysis?.techStack?.technologies?.join(', ') || '',
  };
}

/** "Remote", "Hybrid" or "On-site" when the text names one ("Sydney NSW (Hybrid)", "Hybrid work"). */
export function workArrangementIn(text: string | null | undefined): string {
  if (!text) return '';
  if (/\bhybrid\b/i.test(text)) return 'Hybrid';
  if (/\bremote\b|work from home|\bwfh\b/i.test(text)) return 'Remote';
  if (/\bon[- ]?site\b|in[- ]office/i.test(text)) return 'On-site';
  return '';
}

/** A leaf element's text under `root` that matches `pattern`, e.g. SEEK's "Posted 3d ago". */
export function leafTextMatching(root: ParentNode, pattern: RegExp): string {
  for (const element of Array.from(root.querySelectorAll('span, div, p'))) {
    if (element.children.length > 0) continue;
    const text = element.textContent?.trim() || '';
    if (pattern.test(text)) return text;
  }
  return '';
}
