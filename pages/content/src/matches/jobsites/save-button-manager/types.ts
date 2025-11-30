// Types for save button manager
import { JobAnalysisResult } from '../descriptionAnalysis';

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
  analysis?: JobAnalysisResult;
}

export interface PRDetectionResult {
  isRPRequired: boolean;
  confidence: 'high' | 'medium' | 'low';
  matchedPatterns: string[];
  reasoning: string;
}

export interface ISaveButtonManager {
  init(): Promise<void>;
  detectAndCreateButton(): void;
  removeButton(): void;
}

export type Platform =
  | 'linkedin'
  | 'indeed'
  | 'seek'
  | 'jora'
  | 'reed'
  | 'macquarie'
  | 'atlassian'
  | 'westpac'
  | 'canva';
