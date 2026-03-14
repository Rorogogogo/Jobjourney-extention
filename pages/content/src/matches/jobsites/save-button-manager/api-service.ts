// API service for saving jobs
import { MessageType } from '@extension/types';
import type { JobData, PlatformId } from '@extension/types';
import { RPRequirementDetector } from './rp-requirement-detector';

export class ApiService {
  static async saveJob(jobData: JobData, platform: PlatformId): Promise<{ success: boolean; error?: string }> {
    try {
      // Determine IsRPRequired based on platform type
      const isRPRequired = RPRequirementDetector.determineRPRequirement(jobData, platform);

      // Prepare job data for API
      // Status: 1 = Saved, 2 = Applied
      const apiJobData = {
        Name: jobData.title,
        CompanyName: jobData.company,
        Location: jobData.location,
        JobUrl: jobData.jobUrl,
        Description: jobData.description || '',
        RequiredSkills: jobData.requiredSkills || '',
        EmploymentTypes: jobData.employmentTypes || '',
        WorkArrangement: jobData.workArrangement || '',
        CompanyLogoUrl: jobData.companyLogoUrl || null,
        PlatformName: jobData.platform || platform,
        Status: jobData.isAlreadyApplied ? 2 : 1, // 2 = Applied, 1 = Saved
        IsStarred: false,
        IsRPRequired: isRPRequired,
        // Already applied detection
        IsAlreadyApplied: jobData.isAlreadyApplied || false,
        AppliedDateUtc: jobData.appliedDateUtc || null,
      };

      // Send request to background script
      const response = await chrome.runtime.sendMessage({
        type: MessageType.SAVE_JOB_MANUALLY,
        data: apiJobData,
      });

      return response;
    } catch (error) {
      console.error('Error saving job:', error);
      return { success: false, error: 'Failed to save job. Please try again.' };
    }
  }
}
