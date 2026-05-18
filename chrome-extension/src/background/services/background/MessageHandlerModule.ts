import { Logger } from '@extension/shared';
import { MessageType } from '@extension/types';
import type { ChromeMessage } from '@extension/types';
import type { AuthService } from '../AuthService';
import type { ScrapingService } from '../scraping/ScrapingService';

type SendResponse = (response?: unknown) => void;
type RuntimeMessage<T = unknown> = ChromeMessage<T> & { shouldShowToast?: boolean };
type MessageHandler = (
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
) => Promise<void>;

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
  private readonly messageHandlers = new Map<MessageType, MessageHandler>([
    [MessageType.GET_AUTH_STATUS, this.handleGetAuthStatus.bind(this)],
    [MessageType.START_JOB_SEARCH, this.handleStartJobSearch.bind(this)],
    [MessageType.STOP_SCRAPING, this.handleStopScraping.bind(this)],
    [MessageType.GET_SEARCH_PROGRESS, this.handleGetSearchProgress.bind(this)],
    [MessageType.OPEN_LOGIN_PAGE, this.handleOpenLoginPage.bind(this)],
    [MessageType.AUTH_DETECTED, this.handleAuthDetected.bind(this)],
    [MessageType.AUTH_CLEARED, this.handleAuthCleared.bind(this)],
    [MessageType.SIGN_OUT_USER, this.handleSignOutUser.bind(this)],
    [MessageType.SCRAPING_PROGRESS, this.handleScrapingProgress.bind(this)],
    [MessageType.SCRAPING_RESULT, this.handleScrapingResult.bind(this)],
    [MessageType.PLATFORM_COMPLETED, this.handlePlatformCompleted.bind(this)],
    [MessageType.MAKE_TAB_ACTIVE, this.handleMakeTabActive.bind(this)],
    [MessageType.SHOW_JOBS_IN_JOBJOURNEY, this.handleShowJobsInJobJourney.bind(this)],
    [MessageType.OPEN_SIDE_PANEL, this.handleOpenSidePanel.bind(this)],
    [MessageType.HIDE_OVERLAY, this.handleHideOverlay.bind(this)],
    [MessageType.SHOW_OVERLAY, this.handleShowOverlay.bind(this)],
    [MessageType.SAVE_JOB_MANUALLY, this.handleSaveJobManually.bind(this)],
    [MessageType.MOCK_LARGE_SCRAPE, this.handleMockLargeScrapeMessage.bind(this)],
  ]);

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
    sendResponse: SendResponse,
  ): Promise<void> {
    try {
      Logger.info(`📨 Received message: ${message.type}`, { sender: sender.tab?.url });

      const handler = this.messageHandlers.get(message.type as MessageType);

      if (!handler) {
        Logger.warn(`Unknown message type: ${message.type}`);
        sendResponse({ success: false, error: 'Unknown message type' });
        return;
      }

      await handler(message as RuntimeMessage, sender, sendResponse);
    } catch (error) {
      Logger.error('Error handling message', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown message error' });
    }
  }

  private async handleGetAuthStatus(
    _message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    const authStatus = await this.authService.getAuthStatus();
    sendResponse({ success: true, data: authStatus });
  }

  private async handleStartJobSearch(
    message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    if (this.onStartJobSearch) {
      await this.onStartJobSearch(message.data, sendResponse);
    }
  }

  private async handleStopScraping(
    message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    if (this.onStopScraping) {
      await this.onStopScraping(message.data, sendResponse);
    }
  }

  private async handleGetSearchProgress(
    message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    if (!this.getSearchProgress) {
      sendResponse({ success: false, error: 'Search progress handler not configured' });
      return;
    }

    const sessionId = (message.data as { sessionId?: string } | undefined)?.sessionId;
    if (!sessionId) {
      sendResponse({ success: false, error: 'Missing sessionId' });
      return;
    }

    const progress = await this.getSearchProgress(sessionId);
    sendResponse({ success: true, data: progress });
  }

  private async handleOpenLoginPage(
    _message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    const tab = await this.authService.openLoginPage();
    sendResponse({ success: true, data: { tab } });
  }

  private async handleAuthDetected(
    message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    if (this.onAuthDetected) {
      await this.onAuthDetected(message.data, message.shouldShowToast ?? true, sendResponse);
    }
  }

  private async handleAuthCleared(
    message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    if (this.onAuthCleared) {
      await this.onAuthCleared(message.shouldShowToast ?? true, sendResponse);
    }
  }

  private async handleSignOutUser(
    _message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    if (this.onSignOutUser) {
      await this.onSignOutUser(sendResponse);
    }
  }

  private async handleScrapingProgress(
    message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    if (this.onScrapingProgressMessage) {
      await this.onScrapingProgressMessage(message.data, sendResponse);
    }
  }

  private async handleScrapingResult(
    message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    if (this.onScrapingResult) {
      await this.onScrapingResult(message.data, sendResponse);
    }
  }

  private async handlePlatformCompleted(
    message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    if (this.onPlatformCompleted) {
      await this.onPlatformCompleted(message.data, sendResponse);
    }
  }

  private async handleMakeTabActive(
    _message: RuntimeMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    if (this.onMakeTabActive) {
      await this.onMakeTabActive(sender, sendResponse);
    }
  }

  private async handleShowJobsInJobJourney(
    message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    if (this.onShowJobsInJobJourney) {
      await this.onShowJobsInJobJourney(message.data, sendResponse);
    }
  }

  private async handleOpenSidePanel(
    _message: RuntimeMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    if (this.onOpenSidePanel) {
      await this.onOpenSidePanel(sender, sendResponse);
    }
  }

  private async handleHideOverlay(
    _message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    Logger.info('Hiding overlay for robot check verification');
    sendResponse({ success: true });
  }

  private async handleShowOverlay(
    message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    Logger.info('Showing overlay after robot check completion', message.data);
    sendResponse({ success: true });
  }

  private async handleSaveJobManually(
    message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    if (this.onSaveJobManually) {
      await this.onSaveJobManually(message.data, sendResponse);
    }
  }

  private async handleMockLargeScrapeMessage(
    message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: SendResponse,
  ): Promise<void> {
    await this.handleMockLargeScrape(message.data as { count?: number } | undefined, sendResponse);
  }

  /**
   * Run a mock scraping session through the full pipeline.
   * Dev/test only — exercises storage, progress events, chunking, and sendJobsToFrontend.
   */
  private async handleMockLargeScrape(data: { count?: number } | undefined, sendResponse: SendResponse): Promise<void> {
    const count = data?.count ?? 1000;

    try {
      Logger.info(`🧪 Starting mock scrape with ${count} jobs...`);
      const sessionId = await this.scrapingService.runMockScrapeSession(count);
      Logger.success(`🧪 Mock scrape complete: session ${sessionId} with ${count} jobs`);
      sendResponse({ success: true, message: `Mock scrape started: ${count} jobs`, sessionId });
    } catch (error) {
      Logger.error('🧪 Mock scrape failed:', error);
      sendResponse({ success: false, error: (error as Error).message });
    }
  }
}
