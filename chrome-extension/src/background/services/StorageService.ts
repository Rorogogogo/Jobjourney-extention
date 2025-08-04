// Storage Service for JobJourney Extension
import { Logger } from '../utils/Logger';
import type { StorageData, AuthStatus, UserSettings, CacheData } from '../types';

// Storage keys
export const STORAGE_KEYS = {
  AUTH: 'jobjourney_auth',
  SETTINGS: 'jobjourney_settings',
  CACHE: 'jobjourney_cache',
  SEARCH_HISTORY: 'jobjourney_search_history',
  USER_PROFILE: 'jobjourney_user_profile',
  SCRAPED_JOBS: 'jobjourney_scraped_jobs',
  LAST_SCRAPE: 'jobjourney_last_scrape',
} as const;

export class StorageService {
  private initialized = false;
  private cache = new Map<string, any>();

  /**
   * Initialize the storage service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Preload critical data into cache
      await this.preloadCache();

      this.initialized = true;
      Logger.info('💾 Storage service initialized');
    } catch (error) {
      Logger.error('Failed to initialize storage service', error);
      throw error;
    }
  }

  /**
   * Preload frequently accessed data into memory cache
   */
  private async preloadCache(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      const data = await chrome.storage.local.get(keys);

      for (const [key, value] of Object.entries(data)) {
        this.cache.set(key, value);
      }

      Logger.info(`📦 Preloaded ${this.cache.size} items into cache`);
    } catch (error) {
      Logger.error('Failed to preload cache', error);
    }
  }

  /**
   * Get value from storage with cache fallback
   */
  async get<T = any>(key: string, defaultValue: T | null = null): Promise<T | null> {
    try {
      // Check cache first
      if (this.cache.has(key)) {
        const cached = this.cache.get(key);
        Logger.debug(`📦 Cache hit for key: ${key}`);
        return cached !== undefined ? cached : defaultValue;
      }

      // Fallback to Chrome storage
      const result = await chrome.storage.local.get([key]);
      const value = result[key];

      // Update cache
      this.cache.set(key, value);

      Logger.debug(`💾 Storage read for key: ${key}`, { found: value !== undefined });
      return value !== undefined ? value : defaultValue;
    } catch (error) {
      Logger.error(`Failed to get storage key: ${key}`, error);
      return defaultValue;
    }
  }

  /**
   * Set value in storage and update cache
   */
  async set(key: string, value: any): Promise<void> {
    try {
      // Update Chrome storage
      await chrome.storage.local.set({ [key]: value });

      // Update cache
      this.cache.set(key, value);

      Logger.debug(`💾 Storage write for key: ${key}`);
    } catch (error) {
      Logger.error(`Failed to set storage key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Remove value from storage and cache
   */
  async remove(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove([key]);
      this.cache.delete(key);
      Logger.debug(`🗑️ Storage remove for key: ${key}`);
    } catch (error) {
      Logger.error(`Failed to remove storage key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Clear all storage and cache
   */
  async clear(): Promise<void> {
    try {
      await chrome.storage.local.clear();
      this.cache.clear();
      Logger.info('🧹 Storage cleared');
    } catch (error) {
      Logger.error('Failed to clear storage', error);
      throw error;
    }
  }

  /**
   * Get multiple values at once
   */
  async getMultiple(keys: string[]): Promise<Record<string, any>> {
    try {
      const result: Record<string, any> = {};

      // Check cache first
      const uncachedKeys: string[] = [];
      for (const key of keys) {
        if (this.cache.has(key)) {
          result[key] = this.cache.get(key);
        } else {
          uncachedKeys.push(key);
        }
      }

      // Get uncached keys from storage
      if (uncachedKeys.length > 0) {
        const storageResult = await chrome.storage.local.get(uncachedKeys);

        // Update cache and result
        for (const [key, value] of Object.entries(storageResult)) {
          this.cache.set(key, value);
          result[key] = value;
        }
      }

      return result;
    } catch (error) {
      Logger.error('Failed to get multiple storage keys', error);
      return {};
    }
  }

  /**
   * Set multiple values at once
   */
  async setMultiple(data: Record<string, any>): Promise<void> {
    try {
      await chrome.storage.local.set(data);

      // Update cache
      for (const [key, value] of Object.entries(data)) {
        this.cache.set(key, value);
      }

      Logger.debug(`💾 Bulk storage write for ${Object.keys(data).length} keys`);
    } catch (error) {
      Logger.error('Failed to set multiple storage keys', error);
      throw error;
    }
  }

  // Specialized methods for common data types

  /**
   * Get authentication data
   */
  async getAuth(): Promise<AuthStatus | null> {
    return this.get<AuthStatus>(STORAGE_KEYS.AUTH);
  }

  /**
   * Set authentication data
   */
  async setAuth(auth: AuthStatus): Promise<void> {
    await this.set(STORAGE_KEYS.AUTH, auth);
  }

  /**
   * Get user settings
   */
  async getSettings(): Promise<UserSettings | null> {
    return this.get<UserSettings>(STORAGE_KEYS.SETTINGS);
  }

  /**
   * Set user settings
   */
  async setSettings(settings: UserSettings): Promise<void> {
    await this.set(STORAGE_KEYS.SETTINGS, settings);
  }

  /**
   * Get cache data
   */
  async getCache(): Promise<CacheData | null> {
    return this.get<CacheData>(STORAGE_KEYS.CACHE);
  }

  /**
   * Set cache data
   */
  async setCache(cache: CacheData): Promise<void> {
    await this.set(STORAGE_KEYS.CACHE, cache);
  }

  /**
   * Set default settings on first install
   */
  async setDefaults(): Promise<void> {
    const existingSettings = await this.getSettings();

    if (!existingSettings) {
      const defaultSettings: UserSettings = {
        defaultPlatforms: ['linkedin', 'seek', 'indeed'],
        maxJobsPerPlatform: 50,
        autoRefreshInterval: 3600000, // 1 hour
        notifications: true,
        theme: 'auto',
      };

      await this.setSettings(defaultSettings);
      Logger.info('✨ Default settings initialized');
    }
  }

  /**
   * Get storage usage info
   */
  async getStorageInfo(): Promise<{ bytesInUse: number; quota?: number }> {
    try {
      const bytesInUse = await chrome.storage.local.getBytesInUse();
      return { bytesInUse };
    } catch (error) {
      Logger.error('Failed to get storage info', error);
      return { bytesInUse: 0 };
    }
  }

  /**
   * Check if storage is nearly full
   */
  async isStorageNearlyFull(): Promise<boolean> {
    const info = await this.getStorageInfo();
    const quota = chrome.storage.local.QUOTA_BYTES;
    return info.bytesInUse / quota > 0.8; // 80% threshold
  }

  /**
   * Clean up old cache entries
   */
  async cleanupCache(): Promise<void> {
    try {
      const cache = await this.getCache();
      if (!cache) return;

      const now = Date.now();
      const cleanedCache: CacheData = {};
      let cleanedCount = 0;

      for (const [key, entry] of Object.entries(cache)) {
        if (entry.expiresAt > now) {
          cleanedCache[key] = entry;
        } else {
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        await this.setCache(cleanedCache);
        Logger.info(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
      }
    } catch (error) {
      Logger.error('Failed to cleanup cache', error);
    }
  }

  /**
   * Get scraped jobs
   */
  async getScrapedJobs(): Promise<any[]> {
    const jobs = await this.get<any[]>(STORAGE_KEYS.SCRAPED_JOBS, []);
    return jobs || [];
  }

  /**
   * Set scraped jobs
   */
  async setScrapedJobs(jobs: any[]): Promise<void> {
    await this.set(STORAGE_KEYS.SCRAPED_JOBS, jobs);
    await this.set(STORAGE_KEYS.LAST_SCRAPE, new Date().toISOString());
    Logger.info(`💾 Stored ${jobs.length} scraped jobs`);
  }

  /**
   * Add jobs to existing scraped jobs
   */
  async addScrapedJobs(newJobs: any[]): Promise<void> {
    const existingJobs = await this.getScrapedJobs();
    const updatedJobs = [...existingJobs, ...newJobs];
    await this.setScrapedJobs(updatedJobs);
  }

  /**
   * Clear scraped jobs
   */
  async clearScrapedJobs(): Promise<void> {
    await this.remove(STORAGE_KEYS.SCRAPED_JOBS);
    await this.remove(STORAGE_KEYS.LAST_SCRAPE);
    Logger.info('🧹 Cleared scraped jobs storage');
  }

  /**
   * Get last scrape timestamp
   */
  async getLastScrapeTime(): Promise<string | null> {
    return this.get<string>(STORAGE_KEYS.LAST_SCRAPE);
  }
}
