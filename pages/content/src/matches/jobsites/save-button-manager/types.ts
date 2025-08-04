// Types for save button manager
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

export interface SaveButtonManager {
  init(): Promise<void>;
  detectAndCreateButton(): void;
  removeButton(): void;
}

export type Platform = 'linkedin' | 'indeed' | 'seek' | 'reed' | 'macquarie' | 'atlassian' | 'westpac' | 'canva';