// Applied status detection for different platforms
import type { Platform, AppliedStatusResult } from './types';

export class AppliedStatusDetector {
  /**
   * Detect applied status based on platform
   */
  static detectAppliedStatus(platform: Platform): AppliedStatusResult {
    switch (platform) {
      case 'linkedin':
        return this.detectLinkedInAppliedStatus();
      case 'seek':
        return this.detectSeekAppliedStatus();
      case 'jora':
        return this.detectJoraAppliedStatus();
      default:
        return { isApplied: false, detectionSource: 'explicit' };
    }
  }

  /**
   * LinkedIn: Look for "Applied X time ago" in success feedback element
   * Example HTML: <span class="artdeco-inline-feedback__message">Applied 1 minute ago</span>
   */
  private static detectLinkedInAppliedStatus(): AppliedStatusResult {
    // Primary selector: success feedback message
    const selectors = [
      '.artdeco-inline-feedback--success .artdeco-inline-feedback__message',
      '.jobs-s-apply .artdeco-inline-feedback__message',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim() || '';
        if (text.toLowerCase().includes('applied')) {
          const dateUtc = this.parseRelativeTimeToUtc(text);
          console.log('LinkedIn: Detected applied status:', text, '-> Date:', dateUtc);
          return {
            isApplied: true,
            appliedDateUtc: dateUtc,
            detectionSource: 'explicit',
            rawText: text,
          };
        }
      }
    }

    // Secondary check: "See application" link as indicator
    const seeApplicationLink = document.querySelector('a[href*="/jobs/tracker/applied/"]');
    if (seeApplicationLink) {
      console.log('LinkedIn: Detected applied via "See application" link');
      return {
        isApplied: true,
        detectionSource: 'inferred',
      };
    }

    return { isApplied: false, detectionSource: 'explicit' };
  }

  /**
   * SEEK: If apply button/link is missing, assume applied
   * Also check for any explicit applied indicator
   */
  private static detectSeekAppliedStatus(): AppliedStatusResult {
    // Check for explicit applied indicator
    const appliedIndicators = [
      '[data-automation="job-applied-badge"]',
      '.applied-badge',
      '[data-automation*="applied"]',
    ];

    for (const selector of appliedIndicators) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim() || '';
        const dateUtc = this.parseRelativeTimeToUtc(text);
        console.log('SEEK: Detected applied status:', text);
        return {
          isApplied: true,
          appliedDateUtc: dateUtc,
          detectionSource: 'explicit',
          rawText: text,
        };
      }
    }

    // Check if apply button is missing (inferred applied)
    const applyButtonSelectors = [
      '[data-automation="job-detail-apply"]',
      'a[data-automation="job-detail-apply"]',
      'button[data-automation="job-detail-apply"]',
    ];

    let hasApplyButton = false;
    for (const selector of applyButtonSelectors) {
      if (document.querySelector(selector)) {
        hasApplyButton = true;
        break;
      }
    }

    // If no apply button found and we're on a valid job detail page, assume applied
    if (!hasApplyButton) {
      const hasJobTitle = document.querySelector('[data-automation="job-detail-title"]');
      if (hasJobTitle) {
        console.log('SEEK: No apply button found, inferring already applied');
        return {
          isApplied: true,
          detectionSource: 'inferred',
        };
      }
    }

    return { isApplied: false, detectionSource: 'explicit' };
  }

  /**
   * Jora: Check for applied status in badges or job card state
   */
  private static detectJoraAppliedStatus(): AppliedStatusResult {
    const panel = document.querySelector('.jdv-content:not([data-hidden="true"])');
    if (panel) {
      // Check badges within the panel for "Applied" text
      const badges = Array.from(panel.querySelectorAll('.badge .content, .badge'));
      for (const badge of badges) {
        const text = badge.textContent?.trim().toLowerCase() || '';
        if (text.includes('applied')) {
          const dateUtc = this.parseRelativeTimeToUtc(badge.textContent || '');
          console.log('Jora: Detected applied status in badge:', badge.textContent);
          return {
            isApplied: true,
            appliedDateUtc: dateUtc,
            detectionSource: 'explicit',
            rawText: badge.textContent?.trim(),
          };
        }
      }
    }

    // Check for disabled apply button
    const applyButton = panel?.querySelector('.apply-button, [class*="apply"]') as HTMLButtonElement;
    if (applyButton && applyButton.disabled) {
      console.log('Jora: Apply button is disabled, inferring already applied');
      return {
        isApplied: true,
        detectionSource: 'inferred',
      };
    }

    return { isApplied: false, detectionSource: 'explicit' };
  }

  /**
   * Parse relative time strings like "Applied 1 minute ago", "Applied 2 hours ago",
   * "Applied 3 days ago" into UTC date strings
   */
  static parseRelativeTimeToUtc(text: string): string | undefined {
    const lowerText = text.toLowerCase();
    const now = new Date();

    // Match patterns like "1 minute ago", "2 hours ago", "3 days ago", "1 week ago"
    const patterns = [
      { regex: /(\d+)\s*minute/i, unit: 'minutes' },
      { regex: /(\d+)\s*hour/i, unit: 'hours' },
      { regex: /(\d+)\s*day/i, unit: 'days' },
      { regex: /(\d+)\s*week/i, unit: 'weeks' },
      { regex: /(\d+)\s*month/i, unit: 'months' },
    ];

    for (const { regex, unit } of patterns) {
      const match = lowerText.match(regex);
      if (match) {
        const value = parseInt(match[1], 10);
        const date = new Date(now);

        switch (unit) {
          case 'minutes':
            date.setMinutes(date.getMinutes() - value);
            break;
          case 'hours':
            date.setHours(date.getHours() - value);
            break;
          case 'days':
            date.setDate(date.getDate() - value);
            break;
          case 'weeks':
            date.setDate(date.getDate() - value * 7);
            break;
          case 'months':
            date.setMonth(date.getMonth() - value);
            break;
        }

        return date.toISOString();
      }
    }

    // If we found "applied" but couldn't parse the time, return undefined
    // (the backend will use current time)
    return undefined;
  }
}
