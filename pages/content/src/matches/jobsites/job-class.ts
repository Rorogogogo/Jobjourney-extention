/**
 * Shared Job class - Single source of truth for job data structure
 * All scrapers should import from this file
 */

import { detectPRRequirement } from './prDetection';
import {
  analyzeJobDescription,
  JobAnalysisResult,
  WorkArrangementResult,
  EmploymentTypeResult,
  ExperienceLevelResult,
  TechStackResult,
} from './descriptionAnalysis';

// Interface for job data (legacy compatibility)
export interface JobData {
  id: string;
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  description?: string;
  salary?: string;
  postedDate?: string;
  isRPRequired?: boolean;
  companyLogoUrl?: string;
  // New fields (optional for legacy)
  detectedWorkArrangement?: WorkArrangementResult;
  detectedEmploymentType?: EmploymentTypeResult;
  detectedExperienceLevel?: ExperienceLevelResult;
  techStack?: TechStackResult;
  platform?: string;
  // Already applied detection
  isAlreadyApplied?: boolean;
  appliedDateUtc?: string | null;
}

// Job constructor parameters
export interface JobConstructorParams {
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  description?: string;
  salary?: string;
  postedDate?: string;
  companyLogoUrl?: string | null;
  platform: string;
  jobType?: string;
  workplaceType?: string;
  applicantCount?: string;
  isAlreadyApplied?: boolean;
  appliedDateUtc?: string | null;
}

/**
 * Job class - represents a scraped job listing
 * This is the single source of truth for job data structure
 */
export class Job {
  public title: string;
  public company: string;
  public location: string;
  public jobUrl: string;
  public description: string;
  public salary: string;
  public postedDate: string;
  public companyLogoUrl: string | null;
  public platform: string;
  public jobType: string;
  public workplaceType: string;
  public applicantCount: string;
  public isRPRequired: boolean;

  // Already applied detection
  public isAlreadyApplied: boolean;
  public appliedDateUtc: string | null;

  // Analysis fields
  public analysis: JobAnalysisResult;

  constructor({
    title,
    company,
    location,
    jobUrl,
    description = '',
    salary = '',
    postedDate = '',
    companyLogoUrl = null,
    platform,
    jobType = '',
    workplaceType = '',
    applicantCount = '',
    isAlreadyApplied = false,
    appliedDateUtc = null,
  }: JobConstructorParams) {
    this.title = title?.trim() || '';
    this.company = company?.trim() || '';
    this.location = location?.trim() || '';
    this.jobUrl = jobUrl || '';
    this.description = description?.trim() || '';
    this.salary = salary?.trim() || '';
    this.postedDate = postedDate?.trim() || '';
    this.companyLogoUrl = companyLogoUrl || null;
    this.platform = platform || '';
    this.jobType = jobType?.trim() || '';
    this.workplaceType = workplaceType?.trim() || '';
    this.applicantCount = applicantCount?.trim() || '';
    this.isAlreadyApplied = isAlreadyApplied || false;
    this.appliedDateUtc = appliedDateUtc || null;

    // Analyze description for PR requirement using utility function
    const prResult = detectPRRequirement(this.description);
    this.isRPRequired = prResult.isRPRequired;

    // Perform comprehensive analysis
    this.analysis = analyzeJobDescription(this.description);
  }

  // Custom JSON serialization to ensure proper field names
  toJSON() {
    return {
      title: this.title,
      company: this.company,
      location: this.location,
      jobUrl: this.jobUrl,
      description: this.description,
      salary: this.salary,
      postedDate: this.postedDate,
      companyLogoUrl: this.companyLogoUrl,
      platform: this.platform,
      jobType: this.jobType,
      workplaceType: this.workplaceType,
      applicantCount: this.applicantCount,
      isRPRequired: this.isRPRequired,

      // Already applied detection
      isAlreadyApplied: this.isAlreadyApplied,
      appliedDateUtc: this.appliedDateUtc,

      // Include analysis results
      detectedWorkArrangement: this.analysis.workArrangement,
      detectedEmploymentType: this.analysis.employmentType,
      detectedExperienceLevel: this.analysis.experienceLevel,
      techStack: this.analysis.techStack,

      extracted_at: this.postedDate || null,
      id: `${this.platform.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    };
  }

  static createFromLinkedIn(data: any) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'LinkedIn',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || '',
      isAlreadyApplied: data.isAlreadyApplied || false,
      appliedDateUtc: data.appliedDateUtc || null,
    });
  }

  static createFromSEEK(data: any) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'SEEK',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || '',
      isAlreadyApplied: data.isAlreadyApplied || false,
      appliedDateUtc: data.appliedDateUtc || null,
    });
  }

  static createFromIndeed(data: any) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'Indeed',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || '',
      isAlreadyApplied: data.isAlreadyApplied || false,
      appliedDateUtc: data.appliedDateUtc || null,
    });
  }

  static createFromJora(data: any) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.link || data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate || data.datePosted,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'Jora',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || '',
      isAlreadyApplied: data.isAlreadyApplied || false,
      appliedDateUtc: data.appliedDateUtc || null,
    });
  }

  static createFromReed(data: any) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.jobUrl,
      description: data.description || '',
      salary: data.salary,
      postedDate: data.postedDate || '',
      companyLogoUrl: data.companyLogoUrl,
      platform: 'Reed',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || '',
      isAlreadyApplied: data.isAlreadyApplied || false,
      appliedDateUtc: data.appliedDateUtc || null,
    });
  }
}

// Global window declaration for TypeScript
declare global {
  interface Window {
    Job: typeof Job;
  }
}

/**
 * Attach Job class to window for use by scrapers
 * Call this function once during initialization
 */
export function initializeJobClass(): void {
  window.Job = Job;
  console.log('[Job Class] Initialized and attached to window');
}
