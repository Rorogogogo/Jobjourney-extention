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
  extractedAt?: string | null;
  isRPRequired?: boolean;
  companyLogoUrl?: string | null;
  requiredSkills?: string;
  employmentTypes?: string;
  workArrangement?: string;
  analysis?: JobAnalysisResult;
  isAlreadyApplied?: boolean;
  appliedDateUtc?: string | null;
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
  workplaceType?: string;
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
