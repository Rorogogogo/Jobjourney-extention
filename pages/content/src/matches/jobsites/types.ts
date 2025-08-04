// Common types for job site scrapers
export interface JobData {
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  description?: string;
  requiredSkills?: string;
  employmentTypes?: string;
  workArrangement?: string;
  platform: string;
  companyLogoUrl?: string;
}

export interface JobScraper {
  extractJobData(): JobData | null;
  findInsertionPoint(): HTMLElement | null;
}