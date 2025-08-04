// API service for saving jobs
import type { JobData, Platform } from './types';
import { RPRequirementDetector } from './rp-requirement-detector';

export class ApiService {
  static async saveJob(jobData: JobData, platform: Platform): Promise<{ success: boolean; error?: string }> {
    try {
      // Determine IsRPRequired based on platform type
      const isRPRequired = RPRequirementDetector.determineRPRequirement(jobData, platform);

      // Prepare job data for API
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
        Status: 1, // Default to "Saved" status
        IsStarred: false,
        IsRPRequired: isRPRequired,
      };

      // Send request to background script
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_JOB_MANUALLY',
        data: apiJobData,
      });

      return response;
    } catch (error) {
      console.error('Error saving job:', error);
      return { success: false, error: 'Failed to save job. Please try again.' };
    }
  }
}