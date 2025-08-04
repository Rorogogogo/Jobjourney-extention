// Background Service Worker - Main Entry Point
import { ApiService } from './ApiService';
import { AuthService } from './AuthService';

// Import modularized components
import { AuthModule } from './background/AuthModule';
import { ChromeListenerModule } from './background/ChromeListenerModule';
import { MessageHandlerModule } from './background/MessageHandlerModule';
import { ScrapingModule } from './background/ScrapingModule';
import { TabManagerModule } from './background/TabManagerModule';
import { ToastModule } from './background/ToastModule';
import { UtilityModule } from './background/UtilityModule';
import { ConfigService } from './ConfigService';
import { EventManager } from './EventManager';
import { ScrapingService } from './ScrapingService';
import { StorageService } from './StorageService';
import { Logger } from '../utils/Logger';
import type { ScrapingSession, ChromeMessage } from '../types';

export class BackgroundService {
  private initialized = false;

  // Core services
  private configService: ConfigService;
  private eventManager: EventManager;
  private apiService: ApiService;
  private authService: AuthService;
  private scrapingService: ScrapingService;
  private storageService: StorageService;

  // Modularized components
  private chromeListenerModule: ChromeListenerModule;
  private messageHandlerModule: MessageHandlerModule;
  private authModule: AuthModule;
  private scrapingModule: ScrapingModule;
  private toastModule: ToastModule;
  private tabManagerModule: TabManagerModule;
  private utilityModule: UtilityModule;

  constructor() {
    // Initialize core services
    this.configService = new ConfigService();
    this.eventManager = new EventManager();
    this.storageService = new StorageService();
    this.authService = new AuthService();
    this.apiService = new ApiService();
    this.scrapingService = new ScrapingService();

    // Set up dependencies for core services
    this.authService.setDependencies(this.storageService, this.eventManager, this.configService);
    this.apiService.setDependencies(this.configService, this.authService);
    this.scrapingService.setDependencies(this.eventManager, this.apiService, this.storageService);

    // Initialize modules
    this.chromeListenerModule = new ChromeListenerModule();
    this.messageHandlerModule = new MessageHandlerModule(this.authService, this.scrapingService);
    this.authModule = new AuthModule(this.authService, this.eventManager);
    this.scrapingModule = new ScrapingModule(this.eventManager, this.scrapingService, this.storageService);
    this.toastModule = new ToastModule();
    this.tabManagerModule = new TabManagerModule(this.authService, this.scrapingService);
    this.utilityModule = new UtilityModule(this.storageService, this.authService);

    // Set up module handlers
    this.setupModuleHandlers();
  }

  /**
   * Set up handlers for modularized components
   */
  private setupModuleHandlers(): void {
    // Set up Chrome listener handlers
    this.chromeListenerModule.setHandlers({
      onActionClick: this.handleActionClick.bind(this),
      onTabUpdate: this.authModule.handleTabUpdate.bind(this.authModule),
      onMessage: this.messageHandlerModule.handleMessage.bind(this.messageHandlerModule),
      onAlarm: this.utilityModule.handleAlarm.bind(this.utilityModule),
      onInstall: this.utilityModule.handleInstall.bind(this.utilityModule),
      onInitialize: this.initialize.bind(this),
    });

    // Set up message handler callbacks
    this.messageHandlerModule.setHandlers({
      onStartJobSearch: this.scrapingModule.handleStartJobSearch.bind(this.scrapingModule),
      onStopScraping: this.scrapingModule.handleStopScraping.bind(this.scrapingModule),
      getSearchProgress: this.scrapingModule.getSearchProgress.bind(this.scrapingModule),
      onAuthDetected: this.authModule.handleAuthDetected.bind(this.authModule),
      onAuthCleared: this.authModule.handleAuthCleared.bind(this.authModule),
      onSignOutUser: this.tabManagerModule.handleSignOutUser.bind(this.tabManagerModule),
      onScrapingProgressMessage: this.scrapingModule.handleScrapingProgressMessage.bind(this.scrapingModule),
      onScrapingResult: this.scrapingModule.handleScrapingResult.bind(this.scrapingModule),
      onPlatformCompleted: (
        data: { sessionId: string; platform: string; result: unknown },
        sendResponse: (response: unknown) => void,
      ) => this.scrapingModule.handlePlatformCompleted(data),
      onMakeTabActive: this.tabManagerModule.handleMakeTabActive.bind(this.tabManagerModule),
      onShowJobsInJobJourney: this.tabManagerModule.handleShowJobsInJobJourney.bind(this.tabManagerModule),
      onOpenSidePanel: this.tabManagerModule.handleOpenSidePanel.bind(this.tabManagerModule),
      onSaveJobManually: this.handleSaveJobManually.bind(this),
    });

    // Set up broadcast handlers for modules that need it
    this.toastModule.setBroadcastHandler(this.utilityModule.broadcastToSidebars.bind(this.utilityModule));
    this.scrapingModule.setBroadcastHandler(this.utilityModule.broadcastToSidebars.bind(this.utilityModule));

    // Set up auth status change handler with toast module
    this.eventManager.on('AUTH_STATUS', this.toastModule.handleAuthStatusChange.bind(this.toastModule));
  }

  /**
   * Initialize the background service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      Logger.info('🚀 Initializing JobJourney Background Service...');

      // Initialize core services
      await this.configService.initialize();
      this.eventManager.initialize();
      await this.storageService.initialize();
      await this.authService.initialize();
      await this.apiService.initialize();
      await this.scrapingService.initialize();

      // Load persisted platform progress
      await this.scrapingModule.loadPlatformProgress();

      // Setup event listeners
      this.setupEventListeners();

      // Setup Chrome extension listeners
      this.chromeListenerModule.setupChromeListeners();

      this.initialized = true;
      Logger.success('✅ Background service initialized successfully');
    } catch (error) {
      Logger.error('❌ Failed to initialize background service', error);
      throw error;
    }
  }

  /**
   * Setup event listeners for inter-service communication
   */
  private setupEventListeners(): void {
    // Setup module event listeners
    this.authModule.setupEventListeners();
    this.scrapingModule.setupEventListeners();

    // API events (keeping this in main service for now)
    this.eventManager.on('API_REQUEST', this.handleApiRequest.bind(this));
  }

  /**
   * Handle action click (extension icon click)
   */
  private async handleActionClick(tab: chrome.tabs.Tab): Promise<void> {
    try {
      if (tab.id) {
        await chrome.sidePanel.open({ tabId: tab.id });
      }
    } catch (error) {
      Logger.error('Failed to open side panel', error);
    }
  }

  /**
   * Handle manual job save request
   */
  private async handleSaveJobManually(
    data: { Name: string; CompanyName: string; JobUrl: string; [key: string]: unknown },
    sendResponse: (response: { success: boolean; data?: unknown; error?: string }) => void,
  ): Promise<void> {
    try {
      Logger.info('🔄 Saving job manually:', data.Name);
      Logger.info('🔍 Full job data received:', JSON.stringify(data, null, 2));

      // Check if user is authenticated
      const authStatus = await this.authService.getAuthStatus();
      if (!authStatus.isAuthenticated) {
        sendResponse({
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      // Validate required fields before sending
      if (!data.Name?.trim()) {
        Logger.error('❌ Missing required field: Name');
        sendResponse({
          success: false,
          error: 'Job title is required',
        });
        return;
      }

      if (!data.CompanyName?.trim()) {
        Logger.error('❌ Missing required field: CompanyName');
        sendResponse({
          success: false,
          error: 'Company name is required',
        });
        return;
      }

      if (!data.JobUrl?.trim()) {
        Logger.error('❌ Missing required field: JobUrl');
        sendResponse({
          success: false,
          error: 'Job URL is required',
        });
        return;
      }

      // Make API request to manually save job using the dedicated method
      const response = await this.apiService.saveJobManually(data);

      if (response.success) {
        Logger.success('✅ Job saved successfully:', data.Name);
        sendResponse({
          success: true,
          data: response.data,
        });
      } else {
        throw new Error(response.error || 'Failed to save job');
      }
    } catch (error) {
      Logger.error('❌ Error saving job manually:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to save job',
      });
    }
  }

  /**
   * Handle API request events
   */

  private handleApiRequest(data: unknown): void {
    Logger.info('API request', data);
  }
}
