// Scraping session and progress types
import type { PlatformId } from './platform.js';
import type { JobData } from './job.js';

export interface ScrapingSession {
  id: string;
  startTime: Date | number;
  status: 'active' | 'running' | 'completed' | 'error' | 'stopped';
  platforms: string[];
  keywords: string;
  progress?: ScrapingProgress;
}

export interface ScrapingProgress {
  totalPlatforms: number;
  completedPlatforms: number;
  currentPlatform?: string;
  jobsFound: number;
  errors: string[];
}

export interface PlatformProgress {
  platform: PlatformId | string;
  status: 'pending' | 'active' | 'scraping' | 'completed' | 'error';
  current: number;
  total: number;
  jobsFound: number;
  currentPage?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  totalJobsFromPreviousPages?: number;
  error?: string;
}

export interface SearchConfig {
  keywords: string;
  location?: string;
  country?: string;
  platforms: string[];
  maxJobs?: number;
}

export interface SearchResults {
  sessionId: string;
  jobs: JobData[];
  totalJobs: number;
  duration?: number;
}
