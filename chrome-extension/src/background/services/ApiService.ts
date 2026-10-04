// API Service for JobJourney Extension
import { Logger } from '@extension/shared';
import { EventType } from '@extension/types';
import type { ApiResponse, JobData } from '@extension/types';
import type { AuthService } from './AuthService';
import type { ConfigService } from './ConfigService';
import type { EventManager } from './EventManager';

// API Endpoints
// Paths under the API's `/api/v2`.
export const API_ENDPOINTS = {
  PROCESS_JOBS: '/job-market/process',
  SAVE_JOB: '/job-market/save',
} as const;

export class ApiService {
  private initialized = false;
  private configService!: ConfigService;
  private authService!: AuthService;
  private eventManager!: EventManager;

  setDependencies(configService: ConfigService, authService: AuthService, eventManager: EventManager): void {
    this.configService = configService;
    this.authService = authService;
    this.eventManager = eventManager;
  }

  /**
   * Initialize the API service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.initialized = true;
      Logger.info('🌐 API service initialized');
    } catch (error) {
      Logger.error('Failed to initialize API service', error);
      throw error;
    }
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const url = `${this.configService.getApiUrl()}/v2${endpoint}`;

      // Default headers
      const defaultHeaders = {
        'X-Extension-Version': '3.0.0',
        'X-Extension-Source': 'chrome-extension',
        ...this.authService.getAuthHeaders(),
      };

      // Only add Content-Type for non-FormData requests
      const headers =
        options.body instanceof FormData
          ? { ...defaultHeaders, ...options.headers }
          : { 'Content-Type': 'application/json', ...defaultHeaders, ...options.headers };

      Logger.debug(`🌐 API Request: ${options.method || 'GET'} ${endpoint}`);

      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        Logger.debug(`✅ API Success: ${endpoint}`, { status: response.status });
        return { success: true, data };
      } else {
        if (response.status === 401) {
          Logger.warning('API Request - 401 response detected, emitting unauthorized event');
          this.eventManager.emit(EventType.UNAUTHORIZED, { reason: 'token_expired' });

          return {
            success: false,
            error: 'Unauthorized - logged out',
            data,
          };
        }

        Logger.warning(`⚠️ API Error: ${endpoint}`, {
          status: response.status,
          error: data.error || data.message,
        });
        return {
          success: false,
          error: data.error || data.message || `HTTP ${response.status}`,
          data,
        };
      }
    } catch (error) {
      Logger.error(`❌ API Request Failed: ${endpoint}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Submit scraped jobs to the API
   */
  async submitJobs(jobs: JobData[], searchConfig: any): Promise<ApiResponse> {
    if (!this.authService.isUserAuthenticated()) {
      return { success: false, error: 'Authentication required' };
    }

    // Calculate statistics
    const uniqueJobs = this.getUniqueJobs(jobs);

    // Format request according to backend requirements
    const requestBody = {
      statistics: {
        totalJobsFound: jobs.length,
        uniqueJobsFound: uniqueJobs.length,
      },
      scrapingConfig: {
        country: searchConfig.country || null,
        jobTitle: searchConfig.keywords || null,
        location: searchConfig.location || null,
        platforms: searchConfig.platforms || [],
        totalJobsFound: jobs.length,
      },
    };

    Logger.info('📤 Submitting job statistics to API:', {
      totalJobs: jobs.length,
      uniqueJobs: uniqueJobs.length,
      platforms: searchConfig.platforms,
    });

    return this.makeRequest(API_ENDPOINTS.PROCESS_JOBS, {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'X-Extension-Version': '3.0.0',
        'X-Extension-Source': 'chrome-extension',
      },
    });
  }

  /**
   * Get unique jobs based on title, company, and platform
   */
  private getUniqueJobs(jobs: JobData[]): JobData[] {
    const seen = new Set<string>();
    const uniqueJobs: JobData[] = [];

    for (const job of jobs) {
      const key = `${job.title?.toLowerCase().trim()}_${job.company?.toLowerCase().trim()}_${job.platform}`;

      if (!seen.has(key)) {
        seen.add(key);
        uniqueJobs.push(job);
      }
    }

    return uniqueJobs;
  }

  /**
   * Manually save a single job
   */
  async saveJobManually(jobData: any): Promise<ApiResponse> {
    if (!this.authService.isUserAuthenticated()) {
      return { success: false, error: 'Authentication required' };
    }

    // Prepare JSON payload matching backend JobMarketDto (PascalCase)
    const payload = {
      Title: jobData.Name?.trim() || '',
      Company: jobData.CompanyName?.trim() || '',
      Location: jobData.Location?.trim() || '',
      JobUrl: jobData.JobUrl?.trim() || '',
      Description: jobData.Description?.trim() || '',
      Salary: jobData.Salary?.trim() || '',
      JobType: jobData.EmploymentTypes?.trim() || '',
      PostedDate: jobData.PostedDate?.trim() || '',
      Platform: jobData.PlatformName?.trim() || 'JobJourney Extension',
      CompanyLogoUrl: jobData.CompanyLogoUrl || null,
      IsPRRequired: jobData.IsPRRequired === true || jobData.IsPRRequired === 'true',
      IsAlreadyApplied: jobData.IsAlreadyApplied === true,
      AppliedDateUtc: jobData.AppliedDateUtc || null,
    };

    return this.makeRequest(API_ENDPOINTS.SAVE_JOB, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Get API base URL
   */
  getApiUrl(): string {
    return this.configService.getApiUrl();
  }

  /**
   * Check if API is available. `/health` is at the API's origin, not under `/api`.
   */
  async isApiAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const origin = this.configService.getApiUrl().replace(/\/api\/?$/, '');

      const response = await fetch(`${origin}/health`, { signal: controller.signal });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Retry API request with exponential backoff
   */
  private async retryRequest<T>(
    requestFn: () => Promise<ApiResponse<T>>,
    maxRetries: number = 3,
  ): Promise<ApiResponse<T>> {
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await requestFn();
        if (result.success) {
          return result;
        }
        lastError = result.error;
      } catch (error) {
        lastError = error;
      }

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
        Logger.debug(`Retrying request in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return { success: false, error: lastError || 'Max retries exceeded' };
  }
}
