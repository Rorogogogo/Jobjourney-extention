// API Service for JobJourney Extension
import { Logger } from '../utils/Logger';
import type { ApiResponse, JobData } from '../types';
import type { AuthService } from './AuthService';
import type { ConfigService } from './ConfigService';

// API Endpoints
export const API_ENDPOINTS = {
  JOBS: '/jobs',
  AUTH: '/auth',
  WEBHOOK: '/job-market/process',
  USER: '/user/profile',
  VALIDATE: '/auth/validate',
  REFRESH: '/auth/refresh',
} as const;

export class ApiService {
  private initialized = false;
  private configService!: ConfigService;
  private authService!: AuthService;

  setDependencies(configService: ConfigService, authService: AuthService): void {
    this.configService = configService;
    this.authService = authService;
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
   * Perform logout with fallback (same as logout button functionality)
   */
  private async performLogoutWithFallback(): Promise<void> {
    try {
      Logger.info('🔓 API Interceptor - Performing logout due to 401 response');

      // Find JobJourney tabs and send sign-out command (same as BackgroundService.handleSignOutUser)
      const jobJourneyTabs = await this.findJobJourneyTabs();

      if (jobJourneyTabs.length > 0) {
        // Send sign-out command to ALL JobJourney tabs for complete logout
        Logger.info(`🔗 Sending sign-out command to ${jobJourneyTabs.length} JobJourney tab(s)`);

        let commandSent = false;
        for (const tab of jobJourneyTabs) {
          try {
            // Focus the tab first to ensure it's active
            await chrome.tabs.update(tab.id!, { active: true });
            await chrome.windows.update(tab.windowId!, { focused: true });

            await chrome.tabs.sendMessage(tab.id!, {
              type: 'EXTENSION_SIGN_OUT_COMMAND',
            });
            Logger.success(`✅ Sign-out command sent to: ${tab.url}`);
            commandSent = true;
          } catch (error) {
            Logger.warning(`Failed to send sign-out command to tab ${tab.url}`, error);
          }
        }

        // Always clear auth data locally when 401 occurs, regardless of tab communication
        await this.authService.clearAuthData(true, 'token_expired');
        Logger.info('🔐 Cleared auth data due to 401 response');
      } else {
        // No JobJourney tabs found - just clear auth data immediately
        Logger.info('💡 No JobJourney tabs found - clearing auth data directly');
        await this.authService.clearAuthData(true, 'token_expired');
      }
    } catch (error) {
      Logger.error('Failed to perform logout with fallback, clearing auth data', error);
      await this.authService.clearAuthData(true, 'token_expired');
    }
  }

  /**
   * Find JobJourney tabs (same logic as BackgroundService)
   */
  private async findJobJourneyTabs(): Promise<chrome.tabs.Tab[]> {
    try {
      const tabs = await chrome.tabs.query({});
      return tabs.filter(tab => {
        if (!tab.url) return false;

        try {
          const url = new URL(tab.url);
          const hostname = url.hostname.toLowerCase();

          return (
            hostname === 'jobjourney.me' ||
            hostname === 'www.jobjourney.me' ||
            (hostname === 'localhost' && url.port === '5001')
          );
        } catch (urlError) {
          return false;
        }
      });
    } catch (error) {
      Logger.error('Failed to find JobJourney tabs', error);
      return [];
    }
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const url = `${this.configService.getApiUrl()}${endpoint}`;

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
        // Handle 401 responses with performLogoutWithFallback
        if (response.status === 401) {
          Logger.warning('API Request - 401 response detected, calling performLogoutWithFallback');
          this.performLogoutWithFallback();

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

    return this.makeRequest(API_ENDPOINTS.WEBHOOK, {
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
   * Get user profile
   */
  async getUserProfile(): Promise<ApiResponse> {
    if (!this.authService.isUserAuthenticated()) {
      return { success: false, error: 'Authentication required' };
    }

    return this.makeRequest(API_ENDPOINTS.USER);
  }

  /**
   * Validate authentication token
   */
  async validateToken(): Promise<ApiResponse> {
    const token = this.authService.getCurrentToken();
    if (!token) {
      return { success: false, error: 'No token available' };
    }

    return this.makeRequest(API_ENDPOINTS.VALIDATE);
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<ApiResponse> {
    const token = this.authService.getCurrentToken();
    if (!token) {
      return { success: false, error: 'No token available' };
    }

    return this.makeRequest(API_ENDPOINTS.REFRESH, {
      method: 'POST',
    });
  }

  /**
   * Get jobs from API
   */
  async getJobs(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      platform?: string;
    } = {},
  ): Promise<ApiResponse<JobData[]>> {
    if (!this.authService.isUserAuthenticated()) {
      return { success: false, error: 'Authentication required' };
    }

    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.search) queryParams.set('search', params.search);
    if (params.platform) queryParams.set('platform', params.platform);

    const endpoint = `${API_ENDPOINTS.JOBS}?${queryParams.toString()}`;
    return this.makeRequest<JobData[]>(endpoint);
  }

  /**
   * Delete jobs from API
   */
  async deleteJobs(jobIds: string[]): Promise<ApiResponse> {
    if (!this.authService.isUserAuthenticated()) {
      return { success: false, error: 'Authentication required' };
    }

    return this.makeRequest(API_ENDPOINTS.JOBS, {
      method: 'DELETE',
      body: JSON.stringify({ jobIds }),
    });
  }

  /**
   * Update job status
   */
  async updateJobStatus(jobId: string, status: string): Promise<ApiResponse> {
    if (!this.authService.isUserAuthenticated()) {
      return { success: false, error: 'Authentication required' };
    }

    return this.makeRequest(`${API_ENDPOINTS.JOBS}/${jobId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  /**
   * Send analytics event
   */
  async sendAnalytics(event: string, data: any): Promise<ApiResponse> {
    // Don't require auth for analytics
    return this.makeRequest('/analytics', {
      method: 'POST',
      body: JSON.stringify({
        event,
        data,
        timestamp: new Date().toISOString(),
        source: 'chrome_extension',
      }),
    });
  }

  /**
   * Manually save a single job
   */
  async saveJobManually(jobData: any): Promise<ApiResponse> {
    if (!this.authService.isUserAuthenticated()) {
      return { success: false, error: 'Authentication required' };
    }

    // Prepare JSON payload for the job-market API endpoint
    const payload = {
      title: jobData.Name?.trim() || '',
      company: jobData.CompanyName?.trim() || '',
      location: jobData.Location?.trim() || '',
      jobUrl: jobData.JobUrl?.trim() || '',
      description: jobData.Description?.trim() || '',
      salary: '', // Not provided in the current data
      jobType: jobData.EmploymentTypes?.trim() || '',
      postedDate: '', // Not provided in the current data
      platform: jobData.PlatformName?.trim() || 'JobJourney Extension',
      companyLogoUrl: jobData.CompanyLogoUrl || null,
      isRPRequired: jobData.IsRPRequired === true || jobData.IsRPRequired === 'true',
    };

    return this.makeRequest('/job-market/save', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Check API health
   */
  async checkHealth(): Promise<ApiResponse> {
    return this.makeRequest('/health');
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.checkHealth();
      return response.success;
    } catch (error) {
      Logger.error('API connection test failed', error);
      return false;
    }
  }

  /**
   * Get API base URL
   */
  getApiUrl(): string {
    return this.configService.getApiUrl();
  }

  /**
   * Check if API is available
   */
  async isApiAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.configService.getApiUrl()}/health`, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
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
