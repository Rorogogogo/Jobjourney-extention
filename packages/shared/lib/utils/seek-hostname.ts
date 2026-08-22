/**
 * SEEK hostnames.
 *
 * SEEK migrated its country sites onto the seek.com domain: www.seek.com.au now
 * redirects to au.seek.com, and www.seek.co.nz to nz.seek.com. The legacy
 * hostnames still resolve (and redirect), so both forms are matched here.
 *
 * Keep this the single source of truth — the previous per-file copies of this
 * check are why au.seek.com was missed when nz.seek.com was added.
 */
const SEEK_EXACT_HOSTNAMES = ['seek.com.au', 'seek.co.nz', 'au.seek.com', 'nz.seek.com'];

const SEEK_SUFFIXES = ['.seek.com.au', '.seek.co.nz'];

/** True when `hostname` is a SEEK job-site host (legacy or current domain). */
export const isSeekHostname = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  return SEEK_EXACT_HOSTNAMES.includes(host) || SEEK_SUFFIXES.some(suffix => host.endsWith(suffix));
};

/** Match-pattern list for manifest host permissions and content script matches. */
export const SEEK_MATCH_PATTERNS = [
  '*://*.seek.com.au/*',
  '*://*.seek.co.nz/*',
  '*://au.seek.com/*',
  '*://nz.seek.com/*',
];
