// RP requirement detection logic
import { detectPRRequirement } from '../prDetection';
import type { Platform, JobData } from './types';

export class RPRequirementDetector {
  static determineRPRequirement(jobData: JobData, platform: Platform): boolean {
    // Job aggregator websites - always run PR detection
    const jobAggregatorSites: Platform[] = ['linkedin', 'indeed', 'seek', 'reed'];
    if (jobAggregatorSites.includes(platform)) {
      return detectPRRequirement(jobData.description || '');
    }

    // Company-specific websites - use predefined company policies
    if (platform === 'atlassian' || platform === 'canva' || platform === 'westpac') {
      return true; // These companies require RP
    }

    if (platform === 'macquarie') {
      return false; // Macquarie doesn't require RP
    }

    // Default fallback for any other platforms
    return detectPRRequirement(jobData.description || '');
  }
}
