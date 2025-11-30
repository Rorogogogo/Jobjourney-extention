// Authentication Service for JobJourney Extension
import { getJobJourneyBaseUrl, getJobMarketUrl, getAuthUrl } from '../utils/environment';
import { Logger } from '../utils/Logger';
import type { AuthStatus } from '../types';
import { STORAGE_KEYS } from './StorageService';
import type { ConfigService } from './ConfigService';
import type { EventManager } from './EventManager';
import type { StorageService } from './StorageService';

export class AuthService {
  private isAuthenticated = false;
  private user: AuthStatus['user'] | null = null;
  private token: string | null = null;
  private initialized = false;
  private storageService!: StorageService;
  private eventManager!: EventManager;
  private configService!: ConfigService;

  setDependencies(storageService: StorageService, eventManager: EventManager, configService: ConfigService): void {
    this.storageService = storageService;
    this.eventManager = eventManager;
    this.configService = configService;
  }

  /**
   * Initialize the authentication service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load existing auth data from storage
      await this.loadAuthFromStorage();

      // Skip token validation on startup - let content script detection handle it
      // Token validation on startup was causing issues with valid tokens being cleared
      // The content script will re-detect and sync auth status automatically

      this.initialized = true;
      Logger.info('🔐 Auth service initialized', {
        isAuthenticated: this.isAuthenticated,
        hasUser: !!this.user,
      });

      // Emit initial auth status
      this.emitAuthStatusChange();
    } catch (error) {
      Logger.error('Failed to initialize auth service', error);
      throw error;
    }
  }

  /**
   * Load authentication data from storage
   */
  private async loadAuthFromStorage(): Promise<void> {
    try {
      const authData = await this.storageService.getAuth();

      if (authData) {
        this.isAuthenticated = authData.isAuthenticated;
        this.user = authData.user || null;
        this.token = authData.token || null;

        Logger.info('🔐 Auth data loaded from storage');
      } else {
        Logger.info('🔐 No existing auth data found');
        await this.clearAuthData();
      }
    } catch (error) {
      Logger.error('Failed to load auth from storage', error);
      await this.clearAuthData();
    }
  }

  /**
   * Validate current token with the API
   */
  private async validateCurrentToken(): Promise<void> {
    if (!this.token) return;

    try {
      const response = await fetch(`${this.configService.getApiUrl()}/auth/validate`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.valid) {
          this.isAuthenticated = true;
          if (data.user) {
            this.user = data.user;
          }
          Logger.info('✅ Token validation successful');
        } else {
          Logger.warning('⚠️ Token is invalid, clearing auth data');
          await this.clearAuthData();
        }
      } else {
        Logger.warning('⚠️ Token validation failed, clearing auth data');
        await this.clearAuthData();
      }
    } catch (error) {
      Logger.error('Failed to validate token', error);
      // Don't clear auth data on network errors, might be temporary
    }
  }

  /**
   * Get current authentication status
   */
  async getAuthStatus(): Promise<AuthStatus> {
    return {
      isAuthenticated: this.isAuthenticated,
      user: this.user,
      token: this.token,
      expiresAt: this.user ? Date.now() + 24 * 60 * 60 * 1000 : undefined, // 24 hours from now
    };
  }

  /**
   * Set authentication data
   */
  async setAuthData(authData: AuthStatus & { shouldShowToast?: boolean }): Promise<void> {
    try {
      this.isAuthenticated = authData.isAuthenticated;
      this.user = authData.user || null;
      this.token = authData.token || null;

      // Save to storage (without the shouldShowToast flag)
      const { shouldShowToast, ...authDataToStore } = authData;
      await this.storageService.setAuth(authDataToStore);

      Logger.info('🔐 Auth data updated', {
        isAuthenticated: this.isAuthenticated,
        hasUser: !!this.user,
        shouldShowToast: shouldShowToast ?? true,
      });

      // Emit auth status change with toast flag
      this.emitAuthStatusChange(shouldShowToast);

      // Set up token refresh if needed
      if (this.isAuthenticated && authData.expiresAt) {
        this.scheduleTokenRefresh(authData.expiresAt);
      }
    } catch (error) {
      Logger.error('Failed to set auth data', error);
      throw error;
    }
  }

  /**
   * Clear authentication data
   */
  async clearAuthData(shouldShowToast: boolean = true, reason: 'manual' | 'token_expired' = 'manual'): Promise<void> {
    try {
      this.isAuthenticated = false;
      this.user = null;
      this.token = null;

      // Remove from storage
      await this.storageService.remove(STORAGE_KEYS.AUTH);

      Logger.info('🔐 Auth data cleared', { shouldShowToast, reason });

      // Emit auth status change with toast flag and reason
      this.emitAuthStatusChange(shouldShowToast, reason);

      // Clear any scheduled token refresh
      this.clearTokenRefresh();
    } catch (error) {
      Logger.error('Failed to clear auth data', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isUserAuthenticated(): boolean {
    return this.isAuthenticated && !!this.token;
  }

  /**
   * Get current user
   */
  getCurrentUser(): AuthStatus['user'] | null {
    return this.user;
  }

  /**
   * Get current token
   */
  getCurrentToken(): string | null {
    return this.token;
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<void> {
    if (!this.token) {
      Logger.warning('No token available for refresh');
      return;
    }

    try {
      const response = await fetch(`${this.configService.getApiUrl()}/auth/refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.token) {
          const authData: AuthStatus = {
            isAuthenticated: true,
            user: data.user || this.user,
            token: data.token,
            expiresAt: data.expiresAt || Date.now() + 24 * 60 * 60 * 1000,
          };

          await this.setAuthData(authData);
          Logger.info('🔄 Token refreshed successfully');
        }
      } else {
        Logger.warning('Token refresh failed, clearing auth data');
        await this.clearAuthData();
      }
    } catch (error) {
      Logger.error('Failed to refresh token', error);
      // Don't clear auth data on network errors
    }
  }

  /**
   * Handle login from JobJourney website
   */
  async handleWebsiteLogin(authData: AuthStatus): Promise<void> {
    Logger.info('🌐 Handling website login');
    await this.setAuthData(authData);
  }

  /**
   * Handle logout from JobJourney website
   */
  async handleWebsiteLogout(): Promise<void> {
    Logger.info('🌐 Handling website logout');
    await this.clearAuthData();
  }

  /**
   * Detect authentication from JobJourney tabs
   * This method tries to extract the auth token from cookies or localStorage
   */
  async detectAuthenticationFromTab(tabId: number): Promise<boolean> {
    try {
      Logger.info('🔍 Attempting to detect auth from tab', { tabId });

      // Execute script to check for authentication in the tab
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: this.extractAuthFromPage,
      });

      Logger.info('🔍 Auth detection script results:', {
        hasResults: !!results,
        resultCount: results?.length,
        firstResult: results?.[0]?.result,
      });

      if (results && results[0] && results[0].result) {
        const authData = results[0].result;
        Logger.info('🔍 Extracted auth data:', {
          hasToken: !!authData.token,
          hasUser: !!authData.user,
          tokenPreview: authData.token ? authData.token.substring(0, 20) + '...' : null,
        });

        if (authData.token) {
          await this.setAuthData({
            isAuthenticated: true,
            user: authData.user,
            token: authData.token,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
          });
          Logger.success('🌐 Authentication detected from tab');
          return true;
        } else {
          Logger.info('🔍 No token found in auth data');
        }
      } else {
        Logger.info('🔍 No auth data returned from script');
      }
    } catch (error) {
      Logger.warning('Could not detect auth from tab (this is normal if not on JobJourney)', error);
    }

    return false;
  }

  /**
   * Function injected into pages to extract authentication
   * This runs in the context of the webpage
   */
  private extractAuthFromPage() {
    try {
      // Try to get token from localStorage - including 'auth' key that frontend uses
      let token =
        localStorage.getItem('auth') ||
        localStorage.getItem('jobjourney_auth_token') ||
        localStorage.getItem('auth_token') ||
        localStorage.getItem('token');

      // Try to get user data - including 'auth' key that might contain full auth object
      const userDataStr =
        localStorage.getItem('auth') ||
        localStorage.getItem('jobjourney_user_data') ||
        localStorage.getItem('user_data') ||
        localStorage.getItem('user');

      let userData = null;
      let authObject = null;

      // Try to parse the auth data - it might be a full auth object or just a token
      if (userDataStr) {
        try {
          authObject = JSON.parse(userDataStr);

          // If it's a full auth object, extract token and user data
          if (authObject && typeof authObject === 'object') {
            if (authObject.token || authObject.accessToken) {
              token = authObject.token || authObject.accessToken;
            }
            if (authObject.user) {
              userData = authObject.user;
            } else if (authObject.email || authObject.firstName || authObject.lastName) {
              // The auth object itself might contain user data
              userData = authObject;
            }
          }
        } catch (e) {
          // Not JSON, might be just a token string or username/email
          if (userDataStr.length > 50) {
            // Probably a JWT token
            token = token || userDataStr;
          } else {
            // Probably user info
            userData = { email: userDataStr };
          }
        }
      }

      // If no localStorage data, try to extract from cookies
      if (!token) {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === 'jobjourney_token' || name === 'auth_token' || name === 'token') {
            token = decodeURIComponent(value);
            break;
          }
        }
      }

      // Try to extract user info from page if available
      if (!userData) {
        // Look for user data in common selectors
        const userEmailEl =
          document.querySelector('[data-user-email]') ||
          document.querySelector('.user-email') ||
          document.querySelector('#user-email');

        const userNameEl =
          document.querySelector('[data-user-name]') ||
          document.querySelector('.user-name') ||
          document.querySelector('#user-name');

        if (userEmailEl || userNameEl) {
          userData = {
            email: userEmailEl?.textContent?.trim() || '',
            name: userNameEl?.textContent?.trim() || '',
          };
        }
      }

      console.log('🔍 Auth extraction result:', {
        hasToken: !!token,
        hasUser: !!userData,
        tokenPreview: token ? token.substring(0, 20) + '...' : null,
        userData: userData,
        localStorage_keys: Object.keys(localStorage),
        auth_value: localStorage.getItem('auth'),
        parsedAuth: authObject,
        currentUrl: window.location.href,
      });

      return {
        token,
        user: userData,
      };
    } catch (error) {
      console.warn('Error extracting auth from page:', error);
      return null;
    }
  }

  /**
   * Emit authentication status change event
   */
  private emitAuthStatusChange(shouldShowToast: boolean = true, reason: 'manual' | 'token_expired' = 'manual'): void {
    this.eventManager.emit('AUTH_STATUS', {
      isAuthenticated: this.isAuthenticated,
      user: this.user,
      token: this.token,
      shouldShowToast,
      reason,
    });
  }

  /**
   * Schedule token refresh before expiration
   */
  private scheduleTokenRefresh(expiresAt: number): void {
    this.clearTokenRefresh();

    const now = Date.now();
    const expiresIn = expiresAt - now;
    const refreshIn = Math.max(expiresIn - 5 * 60 * 1000, 60 * 1000); // 5 minutes before expiry, minimum 1 minute

    if (refreshIn > 0) {
      chrome.alarms.create('token_refresh', {
        when: now + refreshIn,
      });
      Logger.info(`🕒 Token refresh scheduled in ${Math.round(refreshIn / 60000)} minutes`);
    }
  }

  /**
   * Clear scheduled token refresh
   */
  private clearTokenRefresh(): void {
    chrome.alarms.clear('token_refresh');
  }

  /**
   * Check if user has pro features
   */
  isProUser(): boolean {
    return this.user?.isPro || false;
  }

  /**
   * Get user's profile picture URL
   */
  getUserAvatar(): string | null {
    return this.user?.avatar || null;
  }

  /**
   * Get frontend URL (not backend URL) for opening tabs
   * Uses global environment detection utility
   */
  async getFrontendUrl(): Promise<string> {
    return await getJobJourneyBaseUrl();
  }

  /**
   * Get JobJourney job market page URL
   * This is where users should be redirected to view scraped jobs
   */
  async getJobMarketUrl(): Promise<string> {
    return await getJobMarketUrl();
  }

  /**
   * Open JobJourney extension auth page
   */
  async openLoginPage(): Promise<chrome.tabs.Tab> {
    try {
      // Use global environment detection utility
      const loginUrl = await getAuthUrl();

      Logger.info(`🔗 Opening extension auth page: ${loginUrl}`);

      const tab = await chrome.tabs.create({
        url: loginUrl,
        active: true,
      });

      // Set up a listener to detect when authentication completes
      const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          this.detectAuthenticationFromTab(tabId);
        }
      };

      chrome.tabs.onUpdated.addListener(listener);

      // Clean up listener after 5 minutes
      setTimeout(
        () => {
          chrome.tabs.onUpdated.removeListener(listener);
        },
        5 * 60 * 1000,
      );

      return tab;
    } catch (error) {
      Logger.error('Failed to open login page', error);
      throw error;
    }
  }

  /**
   * Get authentication headers for API requests
   */
  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }
}
