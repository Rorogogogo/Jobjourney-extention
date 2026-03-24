// PR requirement detection logic
import { detectPRRequirement } from '@extension/shared';
import type { PlatformId, JobData } from '@extension/types';

export class PRRequirementDetector {
  static determinePRRequirement(jobData: JobData, platform: PlatformId): boolean {
    // Job aggregator websites - always run PR detection
    const jobAggregatorSites: PlatformId[] = ['linkedin', 'indeed', 'seek', 'jora', 'reed'];
    if (jobAggregatorSites.includes(platform)) {
      return detectPRRequirement(jobData.description || '').isPRRequired;
    }

    // Company-specific websites - use predefined company policies
    if (platform === 'atlassian' || platform === 'canva' || platform === 'westpac') {
      return true; // These companies require PR
    }

    if (platform === 'macquarie') {
      return false; // Macquarie doesn't require PR
    }

    // Default fallback for any other platforms
    return detectPRRequirement(jobData.description || '').isPRRequired;
  }
}
