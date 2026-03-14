// Storage types and keys
import type { AuthStatus } from './auth.js';

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'jobjourney_auth_token',
  USER_DATA: 'jobjourney_user_data',
  SEARCH_PREFERENCES: 'search_preferences',
  LAST_SCRAPE: 'last_scrape_data',
} as const;

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
