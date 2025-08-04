import { Logger } from '../../utils/Logger';
import type { AuthService } from '../AuthService';
import type { EventManager } from '../EventManager';

export class AuthModule {
  private authService: AuthService;
  private eventManager: EventManager;

  constructor(authService: AuthService, eventManager: EventManager) {
    this.authService = authService;
    this.eventManager = eventManager;
  }

  setupEventListeners(): void {
    this.eventManager.on('AUTH_STATUS', this.handleAuthStatusChange.bind(this));
    this.eventManager.on('TOKEN_UPDATE', this.handleTokenUpdate.bind(this));
    this.eventManager.on('AUTH_CHECK_REQUIRED', this.handleAuthCheckRequired.bind(this));
  }

  handleTabUpdate(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): void {
    if (changeInfo.status === 'complete' && tab.url) {
      try {
        const url = new URL(tab.url);
        const hostname = url.hostname.toLowerCase();

        const isJobJourneyDomain =
          hostname === 'jobjourney.me' ||
          hostname === 'www.jobjourney.me' ||
          (hostname === 'localhost' && url.port === '5001');

        if (isJobJourneyDomain) {
          Logger.info('🔐 JobJourney domain detected for auth monitoring');
          this.eventManager.emit('AUTH_CHECK_REQUIRED', { tabId, url: tab.url });
        }
      } catch (error) {
        // Invalid URL, skip
      }
    }
  }

  private async handleAuthCheckRequired(data: { tabId: number; url: string }): Promise<void> {
    try {
      Logger.info(`🔍 Checking auth from tab: ${data.url}`);
      await this.authService.detectAuthenticationFromTab(data.tabId);
    } catch (error) {
      Logger.warning('Failed to check auth from tab', error);
    }
  }

  private handleTokenUpdate(data: any): void {
    Logger.info('Token updated');
    this.eventManager.emit('AUTH_STATUS_REFRESH');
  }

  private handleAuthStatusChange(data: any): void {
    Logger.info('Auth status changed', data);
  }

  async handleAuthDetected(
    data: any,
    shouldShowToast: boolean = true,
    sendResponse: (response: any) => void,
  ): Promise<void> {
    try {
      Logger.info('🔐 Auth detected from content script', { shouldShowToast, hasToken: !!data.token });

      if (data.token && data.user) {
        const userData = {
          ...data.user,
          name: data.user.firstName + (data.user.lastName ? ' ' + data.user.lastName : ''),
          avatar: data.user.profilePictureUrl,
          isPro: data.user.isPro || data.user.isProActive,
        };

        await this.authService.setAuthData({
          isAuthenticated: true,
          user: userData,
          token: data.token,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          shouldShowToast,
        });

        Logger.success('✅ Auth data updated from content script');
        sendResponse({ success: true, message: 'Auth data updated' });
      } else {
        Logger.warning('⚠️ Invalid auth data from content script');
        sendResponse({ success: false, error: 'Invalid auth data' });
      }
    } catch (error) {
      Logger.error('Failed to handle auth detected', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleAuthCleared(shouldShowToast: boolean = true, sendResponse: (response: any) => void): Promise<void> {
    try {
      Logger.info('🔓 Auth cleared from content script', { shouldShowToast });
      await this.authService.clearAuthData(shouldShowToast);
      sendResponse({ success: true, message: 'Auth cleared' });
    } catch (error) {
      Logger.error('Failed to handle auth cleared', error);
      sendResponse({ success: false, error: error.message });
    }
  }
}
