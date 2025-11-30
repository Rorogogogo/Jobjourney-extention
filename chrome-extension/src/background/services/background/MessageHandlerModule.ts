import { Logger } from '../../utils/Logger';
import type { ChromeMessage } from '../../types';
import type { AuthService } from '../AuthService';
import type { ScrapingService } from '../ScrapingService';

export class MessageHandlerModule {
  private authService: AuthService;
  private scrapingService: ScrapingService;
  private onStartJobSearch?: (data: any, sendResponse: (response: any) => void) => Promise<void>;
  private onStopScraping?: (data: any, sendResponse: (response: any) => void) => Promise<void>;
  private getSearchProgress?: (sessionId: string) => Promise<any>;
  private onAuthDetected?: (
    data: any,
    shouldShowToast: boolean,
    sendResponse: (response: any) => void,
  ) => Promise<void>;
  private onAuthCleared?: (shouldShowToast: boolean, sendResponse: (response: any) => void) => Promise<void>;
  private onSignOutUser?: (sendResponse: (response: any) => void) => Promise<void>;
  private onScrapingProgressMessage?: (data: any, sendResponse: (response: any) => void) => Promise<void>;
  private onScrapingResult?: (data: any, sendResponse: (response: any) => void) => Promise<void>;
  private onPlatformCompleted?: (data: any, sendResponse: (response: any) => void) => Promise<void>;
  private onMakeTabActive?: (
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void,
  ) => Promise<void>;
  private onShowJobsInJobJourney?: (data: any, sendResponse: (response: any) => void) => Promise<void>;
  private onOpenSidePanel?: (
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void,
  ) => Promise<void>;
  private onSaveJobManually?: (data: any, sendResponse: (response: any) => void) => Promise<void>;

  constructor(authService: AuthService, scrapingService: ScrapingService) {
    this.authService = authService;
    this.scrapingService = scrapingService;
  }

  setHandlers(handlers: {
    onStartJobSearch: (data: any, sendResponse: (response: any) => void) => Promise<void>;
    onStopScraping: (data: any, sendResponse: (response: any) => void) => Promise<void>;
    getSearchProgress: (sessionId: string) => Promise<any>;
    onAuthDetected: (data: any, shouldShowToast: boolean, sendResponse: (response: any) => void) => Promise<void>;
    onAuthCleared: (shouldShowToast: boolean, sendResponse: (response: any) => void) => Promise<void>;
    onSignOutUser: (sendResponse: (response: any) => void) => Promise<void>;
    onScrapingProgressMessage: (data: any, sendResponse: (response: any) => void) => Promise<void>;
    onScrapingResult: (data: any, sendResponse: (response: any) => void) => Promise<void>;
    onPlatformCompleted: (data: any, sendResponse: (response: any) => void) => Promise<void>;
    onMakeTabActive: (sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => Promise<void>;
    onShowJobsInJobJourney: (data: any, sendResponse: (response: any) => void) => Promise<void>;
    onOpenSidePanel: (sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => Promise<void>;
    onSaveJobManually: (data: any, sendResponse: (response: any) => void) => Promise<void>;
  }) {
    this.onStartJobSearch = handlers.onStartJobSearch;
    this.onStopScraping = handlers.onStopScraping;
    this.getSearchProgress = handlers.getSearchProgress;
    this.onAuthDetected = handlers.onAuthDetected;
    this.onAuthCleared = handlers.onAuthCleared;
    this.onSignOutUser = handlers.onSignOutUser;
    this.onScrapingProgressMessage = handlers.onScrapingProgressMessage;
    this.onScrapingResult = handlers.onScrapingResult;
    this.onPlatformCompleted = handlers.onPlatformCompleted;
    this.onMakeTabActive = handlers.onMakeTabActive;
    this.onShowJobsInJobJourney = handlers.onShowJobsInJobJourney;
    this.onOpenSidePanel = handlers.onOpenSidePanel;
    this.onSaveJobManually = handlers.onSaveJobManually;
  }

  async handleMessage(
    message: ChromeMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ): Promise<void> {
    try {
      Logger.info(`📨 Received message: ${message.type}`, { sender: sender.tab?.url });

      switch (message.type) {
        case 'GET_AUTH_STATUS': {
          const authStatus = await this.authService.getAuthStatus();
          sendResponse({ success: true, data: authStatus });
          break;
        }

        case 'START_JOB_SEARCH':
          if (this.onStartJobSearch) {
            await this.onStartJobSearch(message.data, sendResponse);
          }
          break;

        case 'STOP_SCRAPING':
          if (this.onStopScraping) {
            await this.onStopScraping(message.data, sendResponse);
          }
          break;

        case 'GET_SEARCH_PROGRESS':
          if (this.getSearchProgress) {
            const progress = await this.getSearchProgress(message.data.sessionId);
            sendResponse({ success: true, data: progress });
          }
          break;

        case 'OPEN_LOGIN_PAGE': {
          const tab = await this.authService.openLoginPage();
          sendResponse({ success: true, data: { tab } });
          break;
        }

        case 'AUTH_DETECTED':
          if (this.onAuthDetected) {
            await this.onAuthDetected(message.data, message.shouldShowToast, sendResponse);
          }
          break;

        case 'AUTH_CLEARED':
          if (this.onAuthCleared) {
            await this.onAuthCleared(message.shouldShowToast, sendResponse);
          }
          break;

        case 'SIGN_OUT_USER':
          if (this.onSignOutUser) {
            await this.onSignOutUser(sendResponse);
          }
          break;

        case 'SCRAPING_PROGRESS':
          if (this.onScrapingProgressMessage) {
            await this.onScrapingProgressMessage(message.data, sendResponse);
          }
          break;

        case 'SCRAPING_RESULT':
          if (this.onScrapingResult) {
            await this.onScrapingResult(message.data, sendResponse);
          }
          break;

        case 'PLATFORM_COMPLETED':
          if (this.onPlatformCompleted) {
            await this.onPlatformCompleted(message.data, sendResponse);
          }
          break;

        case 'MAKE_TAB_ACTIVE':
          if (this.onMakeTabActive) {
            await this.onMakeTabActive(sender, sendResponse);
          }
          break;

        case 'SHOW_JOBS_IN_JOBJOURNEY':
          if (this.onShowJobsInJobJourney) {
            await this.onShowJobsInJobJourney(message.data, sendResponse);
          }
          break;

        case 'OPEN_SIDE_PANEL':
          if (this.onOpenSidePanel) {
            await this.onOpenSidePanel(sender, sendResponse);
          }
          break;

        case 'HIDE_OVERLAY':
          // Handle hiding overlay during robot check
          Logger.info('Hiding overlay for robot check verification');
          sendResponse({ success: true });
          break;

        case 'SHOW_OVERLAY':
          // Handle showing overlay after robot check
          Logger.info('Showing overlay after robot check completion', message.data);
          sendResponse({ success: true });
          break;

        case 'SAVE_JOB_MANUALLY':
          if (this.onSaveJobManually) {
            await this.onSaveJobManually(message.data, sendResponse);
          }
          break;

        default:
          Logger.warn(`Unknown message type: ${message.type}`);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      Logger.error('Error handling message', error);
      sendResponse({ success: false, error: error.message });
    }
  }
}
