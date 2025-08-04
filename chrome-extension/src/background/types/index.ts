// TypeScript type definitions for JobJourney Extension

export interface ScrapingSession {
  id: string;
  startTime: Date;
  status: 'active' | 'completed' | 'error' | 'stopped';
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

export interface ChromeMessage {
  type: string;
  data?: unknown;
  timestamp?: number;
}

export interface JobData {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  platform: string;
  description?: string;
  salary?: string;
  postedDate?: string;
  extracted_at: string;
  isRPRequired?: boolean;
}

export interface SearchConfig {
  keywords: string;
  location?: string;
  country?: string;
  platforms: string[];
  maxJobs?: number;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    isPro?: boolean;
  };
  token?: string;
  expiresAt?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Platform {
  id: string;
  name: string;
  domains: string[];
  color: string;
  icon: string;
  enabled: boolean;
}

export interface JobExtractorResult {
  jobs: JobData[];
  nextPage?: string;
  hasMore: boolean;
  errors?: string[];
}

// Event types
export type EventType =
  | 'AUTH_STATUS'
  | 'TOKEN_UPDATE'
  | 'START_SCRAPING'
  | 'SCRAPING_PROGRESS'
  | 'SCRAPING_COMPLETE'
  | 'SCRAPING_ERROR'
  | 'API_REQUEST'
  | 'AUTH_CHECK_REQUIRED'
  | 'AUTH_STATUS_REFRESH';

export interface EventData {
  [key: string]: unknown;
}

// Message types for Chrome extension communication
export type MessageType =
  | 'GET_AUTH_STATUS'
  | 'START_JOB_SEARCH'
  | 'STOP_SCRAPING'
  | 'GET_SEARCH_PROGRESS'
  | 'AUTH_STATUS_CHANGED'
  | 'SCRAPING_PROGRESS'
  | 'SCRAPING_COMPLETE'
  | 'SCRAPING_ERROR'
  | 'EXTENSION_JOBS_PROCESSED';

// Configuration types
export interface ConfigData {
  environment: 'development' | 'production';
  baseUrl: string;
  apiUrl: string;
  initialized: boolean;
}

export interface StorageData {
  auth?: AuthStatus;
  settings?: UserSettings;
  cache?: CacheData;
}

export interface UserSettings {
  defaultPlatforms: string[];
  maxJobsPerPlatform: number;
  autoRefreshInterval: number;
  notifications: boolean;
  theme: 'light' | 'dark' | 'auto';
}

export interface CacheData {
  [key: string]: {
    data: unknown;
    timestamp: number;
    expiresAt: number;
  };
}
