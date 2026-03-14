// Job description analysis types

export interface PrRequirementResult {
  isRPRequired: boolean;
  isCitizenRequired: boolean;
  securityClearance: string | null;
  confidence: 'high' | 'medium' | 'low';
  matchedPatterns: string[];
  reasoning: string;
}

export interface PrDetectionResult {
  isRPRequired: boolean;
  confidence: 'high' | 'medium' | 'low';
  matchedPatterns: string[];
  reasoning: string;
}

export interface AppliedStatusResult {
  isApplied: boolean;
  appliedDateUtc?: string;
  detectionSource: 'explicit' | 'inferred';
  rawText?: string;
}

export interface WorkArrangementResult {
  type: 'remote' | 'hybrid' | 'on-site' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface EmploymentTypeResult {
  type: 'full-time' | 'contract' | 'part-time' | 'casual' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface TechStackResult {
  technologies: string[];
  count: number;
}

export interface ExperienceLevelResult {
  level: 'senior' | 'mid' | 'junior' | 'lead' | 'graduate' | 'intern' | 'unknown';
  years: number | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface JobAnalysisResult {
  workArrangement: WorkArrangementResult;
  employmentType: EmploymentTypeResult;
  experienceLevel: ExperienceLevelResult;
  techStack: TechStackResult;
  prDetection: PrRequirementResult;
}
