// Job data types — single source of truth
import type { PlatformId } from './platform.js';
import type { JobAnalysisResult } from './analysis.js';

export interface JobData {
  id?: string;
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  platform: PlatformId | string;
  description?: string;
  salary?: string;
  postedDate?: string;
  companyLogoUrl?: string | null;
  jobType?: string; // matches backend JobMarketDto.JobType
  workArrangement?: string; // matches backend ManualCreateJobDto.WorkArrangement
  requiredSkills?: string; // matches backend ManualCreateJobDto.RequiredSkills
  isPRRequired?: boolean;
  isAlreadyApplied?: boolean;
  appliedDateUtc?: string | null;
  applicantCount?: string;
  analysis?: JobAnalysisResult;
}

export interface JobConstructorParams {
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  platform: PlatformId | string;
  description?: string;
  salary?: string;
  postedDate?: string;
  companyLogoUrl?: string | null;
  jobType?: string;
  workArrangement?: string;
  applicantCount?: string;
  isAlreadyApplied?: boolean;
  appliedDateUtc?: string | null;
}

export interface JobExtractorResult {
  jobs: JobData[];
  nextPage?: string;
  hasMore: boolean;
  errors?: string[];
}

export interface JobScraper {
  extractJobData(): JobData | null;
  findInsertionPoint(): HTMLElement | null;
}
