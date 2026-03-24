// Scraping Service for JobJourney Extension
import { getJobMarketUrl, getJobJourneyBaseUrl, Logger, isPRRequired } from '@extension/shared';
import { MessageType } from '@extension/types';
import type { JobData, Platform, PlatformUrls, ScrapingProgress, SearchConfig } from '@extension/types';
import { PLATFORMS, COUNTRIES, buildSearchUrl, SCRAPING_CONFIG, TIMEOUT_CONFIG } from '../../constants';
import type { ApiService } from '../ApiService';
import type { EventManager } from '../EventManager';
import type { StorageService } from '../StorageService';
import { ProgressTracker } from './ProgressTracker';
import { SessionManager } from './SessionManager';
import type { ScrapingSessionState as ScrapingSession } from './SessionManager';
import { TabSequencer } from './TabSequencer';
import { WindowManager } from './WindowManager';

export class ScrapingService {
  private initialized = false;
  private sessionManager = new SessionManager();
  private windowManager = new WindowManager();
  private tabSequencer = new TabSequencer();
  private progressTracker!: ProgressTracker;
  private eventManager!: EventManager;
  private apiService!: ApiService;
  private storageService!: StorageService;

  setDependencies(eventManager: EventManager, apiService: ApiService, storageService: StorageService): void {
    this.eventManager = eventManager;
    this.apiService = apiService;
    this.storageService = storageService;
    this.progressTracker = new ProgressTracker(eventManager);
  }

  /**
   * Initialize the scraping service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Listen for tab closure to automatically stop scraping
      chrome.tabs.onRemoved.addListener(tabId => {
        this.handleTabClosure(tabId);
      });

      this.initialized = true;
      Logger.info('🔧 Scraping service initialized');
    } catch (error) {
      Logger.error('Failed to initialize scraping service', error);
      throw error;
    }
  }

  /**
   * Start a job search across platforms
   */
  async startJobSearch(config: SearchConfig): Promise<string> {
    const session = this.sessionManager.startSession(config);
    const sessionId = session.id;

    // Clear previous scraped jobs at the start of a new session
    try {
      await this.storageService.clearScrapedJobs();
      Logger.info('🧹 Cleared previous scraped jobs before starting new session');
    } catch (error) {
      Logger.warning('Failed to clear previous scraped jobs:', error);
    }

    // Also clear localStorage on all tabs to prevent quota issues
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url) {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_SCRAPED_JOBS' });
          } catch {
            // Ignore errors for tabs that don't have content scripts
          }
        }
      }
      Logger.info('🧹 Sent clear command to all tabs');
    } catch (error) {
      Logger.warning('Failed to clear localStorage on tabs:', error);
    }

    Logger.info(`🚀 Starting job search session: ${sessionId}`, config);

    // Start scraping asynchronously
    this.runScrapingSession(session).catch(error => {
      Logger.error(`Scraping session ${sessionId} failed`, error);
      session.status = 'error';
      session.error = error.message;
    });

    return sessionId;
  }

  /**
   * Track timeout for a session
   */
  private trackTimeout(sessionId: string, timeout: ReturnType<typeof setTimeout>): void {
    this.tabSequencer.trackTimeout(sessionId, timeout);
  }

  /**
   * Clear all timeouts for a session
   */
  private clearSessionTimeouts(sessionId: string): void {
    this.tabSequencer.clearSessionTimeouts(sessionId);
  }

  /**
   * Handle tab closure - stop scraping if all tabs for a session are closed
   * Uses a delay to handle redirects (like Cloudflare verification) that may temporarily close/recreate tabs
   */
  private handleTabClosure(closedTabId: number): void {
    // Use a delay to handle potential redirects that may recreate tabs
    setTimeout(async () => {
      try {
        // Check if the tab still exists (it might have been recreated by a redirect)
        const tab = await chrome.tabs.get(closedTabId).catch(() => null);
        if (tab) {
          Logger.info(`🔄 Tab ${closedTabId} was recreated after closure (likely redirect), keeping session active`);
          return;
        }
      } catch {
        // Tab truly doesn't exist, proceed with removal
      }

      // Find which session this tab belongs to
      for (const session of this.sessionManager.getActiveSessions()) {
        if (session.status !== 'running') continue;

        const sessionId = session.id;
        const sessionTabs = this.tabSequencer.getSessionTabs(sessionId);
        if (sessionTabs && sessionTabs.includes(closedTabId)) {
          Logger.info(`📝 Tab ${closedTabId} confirmed closed for session ${sessionId}`);

          // Remove the closed tab from tracking
          const updatedTabs = this.tabSequencer.removeTab(sessionId, closedTabId);

          // If no tabs remain for this session, stop the scraping
          if (updatedTabs.length === 0) {
            Logger.info(`🚪 All tabs closed for session ${sessionId} - stopping scraping`);
            this.stopScrapingSession(sessionId);
          }

          break; // Tab can only belong to one session
        }
      }
    }, 2000); // Wait 2 seconds to see if tab gets recreated due to redirect
  }

  /**
   * Stop a scraping session
   */
  async stopScrapingSession(sessionId: string): Promise<void> {
    const session = this.sessionManager.getActiveSession(sessionId);

    if (session) {
      // Immediately set status to stopped to prevent any ongoing operations
      session.status = 'stopped';
      session.endTime = Date.now();
      Logger.info(`⏹️ Stopped scraping session: ${sessionId}`);

      // Clear all timeouts first to prevent delayed operations from overriding 'stopped' status
      this.clearSessionTimeouts(sessionId);

      // Close all windows associated with this session
      await this.windowManager.closeSessionWindows(sessionId);
      this.tabSequencer.clearSession(sessionId);
      this.stopSequentialTabActivation();

      // Move session from active to completed sessions for retrieval
      this.sessionManager.completeSession(session);

      // Debug logging
      Logger.info(
        `🔍 Debug - Session ${sessionId} moved to completed sessions. Active: ${this.sessionManager.getActiveSessions().length}, Completed: ${this.sessionManager.getCompletedSessions().length}`,
      );

      this.progressTracker.emitScrapingComplete(session, 'stopped');

      // Also send jobs to backend and frontend for manually stopped sessions if they have jobs
      if (session.jobs.length > 0) {
        Logger.info(`📋 Sending ${session.jobs.length} stopped session jobs to backend and frontend`);
        Promise.resolve().then(async () => {
          try {
            await this.submitJobsToApi(session);
            await this.sendJobsToFrontend(session);
          } catch (error) {
            Logger.error('Failed to send stopped session jobs to backend/frontend:', error);
          }
        });
      }
    }
  }

  /**
   * Get progress of a scraping session
   */
  async getProgress(sessionId: string): Promise<ScrapingProgress | null> {
    return this.progressTracker.getProgress(this.sessionManager.getActiveSession(sessionId));
  }

  /**
   * Run the scraping session
   */
  private async runScrapingSession(session: ScrapingSession): Promise<void> {
    const { config } = session;

    try {
      this.progressTracker.emitSessionStatus(session, 'Starting job search...');

      // Get enabled platforms for scraping
      const platforms = config.platforms
        .map(platformId => PLATFORMS[platformId as keyof typeof PLATFORMS])
        .filter((platform): platform is Platform => !!platform?.enabled);

      if (platforms.length === 0) {
        throw new Error('No enabled platforms to scrape');
      }

      // Start sequential tab activation for performance
      this.startSequentialTabActivation(session.id);

      // Scrape all platforms concurrently for better performance
      const platformPromises = platforms.map((platform, index) =>
        this.scrapePlatform(session, platform, index, platforms.length).catch(error => {
          Logger.error(`Failed to scrape platform ${platform.id}`, error);
          session.progress.errors.push(`${platform.name}: ${error.message}`);
          return null; // Continue with other platforms
        }),
      );

      // Wait for all platforms to complete
      await Promise.allSettled(platformPromises);

      // Stop sequential tab activation
      this.stopSequentialTabActivation();
      session.progress.completedPlatforms = session.progress.totalPlatforms;

      this.progressTracker.emitSessionStatus(session, `Completed scraping from ${platforms.length} platforms`);

      // Check if session was manually stopped before marking as completed
      if (session.status === 'stopped') {
        Logger.info(`⏹️ Session ${session.id} was already stopped, skipping completion`);
        return;
      }

      // Session completed
      session.status = 'completed';
      session.endTime = Date.now();

      // Remove duplicates from all collected jobs
      const uniqueJobs = this.removeDuplicateJobs(session.jobs);
      session.jobs = uniqueJobs;

      Logger.success(`✅ Scraping session completed: ${session.id}`, {
        totalJobs: session.jobs.length,
        duration: session.endTime - session.startTime,
        platforms: config.platforms.length,
        errors: session.progress.errors,
      });

      // Clean up session resources when completed normally
      this.clearSessionTimeouts(session.id); // Clear any remaining timeouts
      this.windowManager.clearSession(session.id);
      this.tabSequencer.clearSession(session.id);
      // Tab activation already stopped above, no need to stop again

      // Move session to completed sessions for retrieval while keeping it active temporarily
      this.sessionManager.completeSession(session);

      // Debug logging
      Logger.info(
        `🔍 Debug - Session ${session.id} moved to completed sessions (natural completion). Active: ${this.sessionManager.getActiveSessions().length}, Completed: ${this.sessionManager.getCompletedSessions().length}`,
      );

      // Emit completion event FIRST to trigger result page
      this.progressTracker.emitScrapingComplete(session, 'completed', session.endTime - session.startTime);

      // THEN process API calls in the background (non-blocking)
      if (session.jobs.length > 0) {
        // Run API operations asynchronously without blocking the UI
        Promise.resolve().then(async () => {
          try {
            await this.submitJobsToApi(session);
            await this.sendJobsToFrontend(session);
          } catch (error) {
            Logger.error('Background API operations failed:', error);
            // Don't fail the entire scraping session for API errors
          }
        });
      }
    } catch (error) {
      session.status = 'error';
      session.error = error instanceof Error ? error.message : 'Unknown scraping error';
      session.endTime = Date.now();

      Logger.error(`❌ Scraping session failed: ${session.id}`, error);

      // Clean up session resources when failed
      this.clearSessionTimeouts(session.id); // Clear any remaining timeouts
      this.windowManager.clearSession(session.id);
      this.tabSequencer.clearSession(session.id);
      this.stopSequentialTabActivation();

      this.progressTracker.emitScrapingError(session, session.error);
    }
  }

  /**
   * Remove duplicate jobs based on title, company, and platform
   */
  private removeDuplicateJobs(jobs: JobData[]): JobData[] {
    const seen = new Set<string>();
    const uniqueJobs: JobData[] = [];

    for (const job of jobs) {
      const key = `${job.title?.toLowerCase().trim()}_${job.company?.toLowerCase().trim()}_${job.platform}`;

      if (!seen.has(key)) {
        seen.add(key);
        uniqueJobs.push(job);
      }
    }

    if (jobs.length > uniqueJobs.length) {
      Logger.info(`Removed ${jobs.length - uniqueJobs.length} duplicate jobs`);
    }

    return uniqueJobs;
  }

  /**
   * Scrape jobs from a specific platform
   */
  private async scrapePlatform(
    session: ScrapingSession,
    platform: Platform,
    platformIndex: number,
    totalPlatforms: number,
  ): Promise<void> {
    Logger.info(`📝 Scraping platform: ${platform.name}`);

    const { config } = session;
    let windowId: number | undefined;
    let tabId: number | undefined;

    try {
      // Create new tab for scraping
      const searchUrl = this.buildSearchUrl(platform, config);
      const tab = await chrome.tabs.create({
        url: searchUrl,
        active: false,
      });

      tabId = tab.id;

      // Track this tab for the session for sequential activation
      if (tabId) {
        this.tabSequencer.trackTab(session.id, tabId);
        Logger.info(`📝 Tracking tab ${tabId} for session ${session.id}`);
      }

      // Set zoom when tab starts loading (not when fully loaded)
      if (tabId) {
        const zoomTabId = tabId; // Capture for closure
        const tabLoadListener = (changedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
          if (changedTabId === zoomTabId && changeInfo.status === 'loading') {
            chrome.tabs.onUpdated.removeListener(tabLoadListener);

            // Set zoom when tab starts loading (before content analysis)
            chrome.tabs
              .setZoom(zoomTabId, 0.5)
              .then(() => {
                Logger.info(`🔍 Set zoom to 50% for ${platform.name} (on loading)`);
              })
              .catch(error => {
                Logger.warning(`Failed to set zoom for ${platform.name}:`, error.message);
              });
          }
        };

        chrome.tabs.onUpdated.addListener(tabLoadListener);
      }

      if (tabId) {
        try {
          // Calculate window layout for tiling
          const layout = await this.calculateWindowLayout(platformIndex, totalPlatforms);

          // Move the tab to a new positioned window
          const window = await chrome.windows.create({
            tabId: tabId,
            focused: platformIndex === 0, // Only focus the first window
            type: 'normal',
            left: layout.left,
            top: layout.top,
            width: layout.width,
            height: layout.height,
          });

          windowId = window.id;
          Logger.info(`📐 Window positioned for ${platform.name}:`, layout);

          // Track this window for the session so we can close it when stopped
          if (windowId) {
            this.windowManager.trackWindow(session.id, windowId);
            Logger.info(`📝 Tracking window ${windowId} for session ${session.id}`);
          }

          // Wait for tab to load first
          await this.waitForTabLoad(tabId);

          // Give tab a moment to fully initialize
          await new Promise(resolve => setTimeout(resolve, 500));

          // Show scraping overlay
          await this.showScrapingOverlay(tabId, platform.name);

          // Start scraping (zoom is now applied)
          await this.scrapePlatformTab(session, platform, tabId);

          // Hide overlay
          await this.hideScrapingOverlay(tabId);
        } finally {
          // Clean up: reset zoom and close the window
          if (windowId) {
            try {
              // Reset zoom back to 100% before closing
              if (tabId) {
                try {
                  await chrome.tabs.setZoom(tabId, 1.0); // 100% zoom
                  Logger.info(`🔍 Reset zoom to 100% for ${platform.name}`);
                } catch (zoomError) {
                  const message = zoomError instanceof Error ? zoomError.message : String(zoomError);
                  Logger.warning(`Failed to reset zoom for ${platform.name}:`, message);
                }
              }

              await chrome.windows.remove(windowId);
              this.windowManager.untrackWindow(session.id, windowId);
            } catch (error) {
              Logger.warning(`Could not close window ${windowId}:`, error);
            }
          }
        }
      }
    } catch (error) {
      Logger.error(`Failed to scrape platform ${platform.name}:`, error);

      // Add error to session instead of throwing (graceful handling)
      session.progress.errors.push(`${platform.name}: ${error instanceof Error ? error.message : String(error)}`);

      // Don't throw - let other platforms continue
      Logger.warning(`Continuing with other platforms despite ${platform.name} failure`);
    }
  }

  /**
   * Scrape jobs from a specific tab with pagination support
   */
  private async scrapePlatformTab(session: ScrapingSession, platform: Platform, tabId: number): Promise<void> {
    // No page limit - scrape until user stops or no more pages
    let currentPage = 1;
    let nextUrl: string | null = null;
    let totalJobsForPlatform = 0;

    // Emit platform started event
    this.progressTracker.emitPlatformStarted(session.id, platform.id, platform.name);

    // Loop through pages indefinitely until no more pages or user stops
    while (true) {
      // Check if session was stopped by user
      if (session.status === 'stopped') {
        Logger.info(`🛑 Scraping stopped by user for ${platform.name}`);
        break;
      }

      Logger.info(`📄 Scraping ${platform.name} - Page ${currentPage}`);

      // Emit progress update to show current page immediately
      Logger.info(
        `📊 Emitting progress for ${platform.name} - Page ${currentPage}: totalJobsForPlatform=${totalJobsForPlatform}`,
      );
      this.progressTracker.emitPlatformProgress({
        sessionId: session.id,
        platform: platform.id,
        platformName: platform.name,
        currentPage: currentPage,
        jobsFoundOnPage: 0,
        totalJobsForPlatform: totalJobsForPlatform,
        totalJobs: session.progress.jobsFound,
        hasNextPage: !!nextUrl,
      });

      // If we have a next URL (not first page), navigate to it
      if (nextUrl && currentPage > 1) {
        await chrome.tabs.update(tabId, { url: nextUrl });
        await this.waitForTabLoad(tabId);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Extra wait for dynamic content

        // Show overlay again for the new page
        await this.showScrapingOverlay(tabId, `${platform.name} (Page ${currentPage})`);
      }

      // Scrape current page
      const pageResult = await this.scrapeCurrentPage(session, platform, tabId, currentPage);

      if (!pageResult.success) {
        Logger.warning(`Failed to scrape page ${currentPage} of ${platform.name}`);
        break;
      }

      totalJobsForPlatform += pageResult.jobCount;
      nextUrl = pageResult.nextUrl;

      // Check if we should continue
      if (!nextUrl) {
        Logger.info(`✅ No more pages for ${platform.name}. Total jobs: ${totalJobsForPlatform}`);
        break;
      }

      // No job limit - let user decide when to stop via stop button

      currentPage++;

      // Small delay between pages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    Logger.info(`✅ Completed scraping ${platform.name}: ${totalJobsForPlatform} jobs from ${currentPage} pages`);

    // Emit platform completed event only when ALL pages are done
    this.progressTracker.emitPlatformCompleted({
      sessionId: session.id,
      platform: platform.id,
      platformName: platform.name,
      totalJobs: totalJobsForPlatform,
      totalPages: currentPage,
    });
  }

  /**
   * Scrape the current page
   */
  private async scrapeCurrentPage(
    session: ScrapingSession,
    platform: Platform,
    tabId: number,
    pageNumber: number,
  ): Promise<{
    success: boolean;
    jobCount: number;
    nextUrl: string | null;
  }> {
    return new Promise(resolve => {
      let isResolved = false;

      const cleanup = () => {
        if (!isResolved) {
          chrome.runtime.onMessage.removeListener(messageListener);
          isResolved = true;
        }
      };

      // Standard timeout for all platforms/pages
      const timeoutDuration = SCRAPING_CONFIG.TIMEOUT;

      const timeout = setTimeout(() => {
        cleanup();
        if (!isResolved) {
          Logger.warning(`Scraping timeout for ${platform.name} page ${pageNumber} after ${timeoutDuration / 1000}s`);
          resolve({ success: false, jobCount: 0, nextUrl: null });
        }
      }, timeoutDuration);

      // Track this timeout for the session
      this.trackTimeout(session.id, timeout);

      // Listen for scraping results
      const messageListener = (message: any, sender: chrome.runtime.MessageSender, sendResponse: Function) => {
        if (sender.tab?.id === tabId && message.type === MessageType.SCRAPING_RESULT) {
          clearTimeout(timeout);
          cleanup();

          const { jobs, error, nextUrl } = message.data;

          if (error) {
            Logger.warning(`Scraping error from ${platform.name} page ${pageNumber}:`, error);
            resolve({ success: false, jobCount: 0, nextUrl: null });
          } else {
            // Add platform info to jobs and analyze PR requirements
            const platformJobs: JobData[] = (jobs || []).map((job: any) => ({
              ...job,
              platform: platform.id,
              // Ensure postedDate is explicitly null when empty, not undefined
              postedDate: job.postedDate && job.postedDate.trim() ? job.postedDate.trim() : undefined,
              isPRRequired: job.isPRRequired !== undefined ? job.isPRRequired : isPRRequired(job.description || ''),
            }));

            session.jobs.push(...platformJobs);
            session.progress.jobsFound += platformJobs.length;

            // Store jobs immediately to avoid quota issues with content scripts (non-blocking)
            this.storageService
              .setScrapedJobs(session.jobs)
              .then(() => {
                Logger.info(`💾 Updated storage with ${session.jobs.length} total jobs`);
              })
              .catch(error => {
                Logger.warning('Failed to store jobs in storage:', error);
              });

            Logger.info(`✅ Found ${platformJobs.length} jobs from ${platform.name} page ${pageNumber}`);

            // Update progress
            this.progressTracker.emitPlatformProgress({
              sessionId: session.id,
              platform: platform.id,
              platformName: platform.name,
              currentPage: pageNumber,
              jobsFoundOnPage: platformJobs.length,
              totalJobsForPlatform: session.jobs.filter(j => j.platform === platform.id).length,
              totalJobs: session.progress.jobsFound,
              hasNextPage: !!nextUrl,
            });

            resolve({
              success: true,
              jobCount: platformJobs.length,
              nextUrl: nextUrl || null,
            });
          }

          // Send response to avoid "message channel closed" error
          try {
            if (sendResponse && typeof sendResponse === 'function') {
              sendResponse({ received: true });
            }
          } catch (e) {
            // Ignore response errors - tab might be closed
            Logger.warning(
              `Failed to send response to ${platform.name} tab:`,
              e instanceof Error ? e.message : String(e),
            );
          }
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);

      // Validate tab exists before sending message
      chrome.tabs
        .get(tabId)
        .then(tab => {
          if (!tab || tab.discarded) {
            clearTimeout(timeout);
            cleanup();
            Logger.warning(`Tab ${tabId} for ${platform.name} is no longer available`);
            resolve({ success: false, jobCount: 0, nextUrl: null });
            return;
          }

          // Send scraping command to content script with better error handling
          chrome.tabs
            .sendMessage(tabId, {
              type: MessageType.START_SCRAPING,
              data: {
                platform: platform.id,
                config: session.config,
                maxJobsPerPlatform: SCRAPING_CONFIG.MAX_JOBS_PER_PLATFORM,
                pageNumber: pageNumber,
              },
            })
            .catch(error => {
              // Fail fast; no special verification retries
              clearTimeout(timeout);
              cleanup();
              Logger.error(`Failed to communicate with ${platform.name} tab:`, error);
              resolve({ success: false, jobCount: 0, nextUrl: null });
            });
        })
        .catch(() => {
          clearTimeout(timeout);
          cleanup();
          Logger.warning(`Tab ${tabId} for ${platform.name} does not exist`);
          resolve({ success: false, jobCount: 0, nextUrl: null });
        });
    });
  }

  /**
   * Build search URL for a platform using constants
   */
  private buildSearchUrl(platform: Platform, config: SearchConfig): string {
    return buildSearchUrl(platform.id as keyof PlatformUrls, config);
  }

  /**
   * Wait for tab to fully load
   */
  private async waitForTabLoad(tabId: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // First check if tab is already loaded
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete') {
          Logger.info(`Tab ${tabId} is already loaded, no need to wait`);
          // Wait a bit for JavaScript to initialize
          setTimeout(resolve, 1000);
          return;
        }
      } catch (error) {
        Logger.warning(`Could not get tab ${tabId} status:`, error);
        reject(new Error('Tab not found'));
        return;
      }

      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab load timeout'));
      }, TIMEOUT_CONFIG.PAGE_LOAD); // Use centralized timeout configuration

      // Note: Don't track PAGE_LOAD timeouts as they're short-lived and for navigation only

      const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          // Wait a bit more for JavaScript to load
          setTimeout(resolve, 1000);
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  /**
   * Calculate window position and size for tiling
   */
  private async calculateWindowLayout(
    platformIndex: number,
    totalPlatforms: number,
  ): Promise<{
    left: number;
    top: number;
    width: number;
    height: number;
  }> {
    // Get current window to determine screen dimensions
    let screenWidth = 1920; // Default fallback
    let screenHeight = 1080; // Default fallback

    try {
      const currentWindow = await chrome.windows.getCurrent();
      if (currentWindow) {
        // Estimate screen size based on current window
        screenWidth = Math.max(1920, (currentWindow.left || 0) + (currentWindow.width || 1200) + 100);
        screenHeight = Math.max(1080, (currentWindow.top || 0) + (currentWindow.height || 800) + 100);
      }
    } catch {
      Logger.warning('Could not get current window dimensions, using defaults');
    }

    // Reserve right 40% of screen for side panel
    const availableWidth = Math.floor(screenWidth * 0.6);

    // Calculate layout based on number of platforms
    let rows = 1;
    let cols = 1;
    let windowWidth: number;
    let windowHeight: number;
    let left: number;
    let top: number;

    if (totalPlatforms === 1) {
      // Single window - use all available space
      windowWidth = availableWidth;
      windowHeight = screenHeight;
      left = 0;
      top = 0;
    } else if (totalPlatforms === 2) {
      // 2 windows - side by side, no gaps
      cols = 2;
      rows = 1;
      windowWidth = Math.floor(availableWidth / cols);
      windowHeight = screenHeight;

      const col = platformIndex % cols;
      left = col * windowWidth;
      top = 0;
    } else if (totalPlatforms <= 4) {
      // 3-4 windows - 2x2 grid, no gaps
      cols = 2;
      rows = 2;
      windowWidth = Math.floor(availableWidth / cols);
      windowHeight = Math.floor(screenHeight / rows);

      const row = Math.floor(platformIndex / cols);
      const col = platformIndex % cols;
      left = col * windowWidth;
      top = row * windowHeight;
    } else {
      // 5+ windows - 3 columns, limited to 2 rows max
      cols = 3;
      rows = Math.min(Math.ceil(totalPlatforms / cols), 2);
      windowWidth = Math.floor(availableWidth / cols);
      windowHeight = Math.floor(screenHeight / rows);

      const row = Math.floor(platformIndex / cols);
      const col = platformIndex % cols;
      left = col * windowWidth;
      top = row * windowHeight;
    }

    const layout = {
      left,
      top,
      width: windowWidth,
      height: windowHeight,
    };

    Logger.info(`📐 Calculated layout for platform ${platformIndex}/${totalPlatforms}:`, {
      ...layout,
      screenSize: `${screenWidth}x${screenHeight}`,
      availableWidth,
      grid: `${cols}x${rows}`,
    });

    return layout;
  }

  /**
   * Show discovering overlay in tab
   */
  private async showScrapingOverlay(tabId: number, platformName: string): Promise<void> {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: MessageType.SHOW_OVERLAY,
        data: {
          message: `JobJourney is discovering ${platformName}...`,
          submessage: 'Please do not interact with this page',
        },
      });
    } catch (error) {
      Logger.warning('Could not show discovering overlay:', error);
    }
  }

  /**
   * Hide discovering overlay in tab
   */
  private async hideScrapingOverlay(tabId: number): Promise<void> {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: MessageType.HIDE_OVERLAY,
      });
    } catch (error) {
      Logger.warning('Could not hide discovering overlay:', error);
    }
  }

  /**
   * Submit jobs to API
   */
  private async submitJobsToApi(session: ScrapingSession): Promise<void> {
    try {
      Logger.info(`📤 Submitting ${session.jobs.length} jobs to API`);

      const response = await this.apiService.submitJobs(session.jobs, session.config);

      if (response.success) {
        Logger.success(`✅ Successfully submitted jobs to API`);
      } else {
        Logger.error(`❌ Failed to submit jobs to API: ${response.error}`);
      }
    } catch (error) {
      Logger.error('Failed to submit jobs to API', error);
    }
  }

  /**
   * Send jobs directly to JobJourney frontend when scraping completes
   * Only looks for existing /job-market pages, creates new one if none exists
   */
  async sendJobsToFrontend(session: ScrapingSession): Promise<void> {
    try {
      Logger.info(`📋 Sending ${session.jobs.length} jobs directly to frontend`);

      // Get the job market URL
      const jobMarketUrl = await getJobMarketUrl();

      // Find existing JobJourney job-market tabs only
      const allTabs = await chrome.tabs.query({});
      const existingJobMarketTabs: chrome.tabs.Tab[] = [];

      for (const tab of allTabs) {
        if (!tab.url) continue;

        try {
          if (await this.isJobJourneyUrl(tab.url)) {
            const url = new URL(tab.url);
            const pathname = url.pathname.toLowerCase();
            if (pathname.includes('/job-market')) {
              existingJobMarketTabs.push(tab);
            }
          }
        } catch {
          // Invalid URL, skip
        }
      }

      let targetTab: chrome.tabs.Tab;

      if (existingJobMarketTabs.length > 0) {
        // Use existing job-market tab
        targetTab = existingJobMarketTabs[0];
        Logger.info(`🔍 Found existing JobJourney job-market tab: ${targetTab.url}`);

        // Just focus the existing job-market tab
        await chrome.tabs.update(targetTab.id!, { active: true });

        // Focus the window containing the tab
        if (targetTab.windowId) {
          await chrome.windows.update(targetTab.windowId, { focused: true });
        }

        Logger.info(`🎯 Focused existing JobJourney job-market tab`);
      } else {
        // No existing job-market tabs found - create new one
        Logger.info('💡 No JobJourney job-market tab found - opening new job-market page');

        targetTab = await chrome.tabs.create({
          url: `${jobMarketUrl}?source=extension`,
          active: true,
        });

        Logger.info(`✅ Created new JobJourney job-market tab`);
      }

      // Wait for tab to load completely
      await this.waitForTabLoad(targetTab.id!);

      // Emit sending status so the side panel can show feedback
      this.progressTracker.emitJobsSending(session.id, session.jobs.length);

      // Send jobs to the tab via chrome.tabs.sendMessage with chunking for large payloads
      const CHUNK_SIZE = 50;
      const CHUNK_THRESHOLD = 200;
      const tabId = targetTab.id!;

      const jobsPayload = {
        jobs: session.jobs,
        config: session.config,
        timestamp: new Date().toISOString(),
        source: 'extension_scraping' as const,
        sessionId: session.id,
        totalJobs: session.jobs.length,
        platforms: session.config.platforms,
      };

      try {
        if (session.jobs.length <= CHUNK_THRESHOLD) {
          // Small payload: send as a single message
          await chrome.tabs.sendMessage(tabId, {
            type: MessageType.EXTENSION_JOBS_PROCESSED,
            data: jobsPayload,
          });
          Logger.success(`✅ Jobs sent via single message (${session.jobs.length} jobs) to: ${targetTab.url}`);
        } else {
          // Large payload: send in chunks
          const transferId = `transfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const totalChunks = Math.ceil(session.jobs.length / CHUNK_SIZE);

          Logger.info(`📦 Chunking ${session.jobs.length} jobs into ${totalChunks} chunks (transferId: ${transferId})`);

          for (let i = 0; i < totalChunks; i++) {
            const chunkJobs = session.jobs.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);

            await chrome.tabs.sendMessage(tabId, {
              type: MessageType.EXTENSION_JOBS_CHUNK,
              data: {
                transferId,
                chunkIndex: i,
                totalChunks,
                jobs: chunkJobs,
                config: session.config,
                timestamp: jobsPayload.timestamp,
                source: jobsPayload.source,
                totalJobs: session.jobs.length,
              },
            });

            // Small delay between chunks to avoid overwhelming the content script
            if (i < totalChunks - 1) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }

          Logger.success(`✅ Jobs sent via ${totalChunks} chunks (${session.jobs.length} jobs) to: ${targetTab.url}`);
        }
      } catch (error) {
        Logger.error(`Failed to send jobs via message:`, error);
      }

      // Emit sending complete
      this.progressTracker.emitJobsSent(session.id, session.jobs.length);
    } catch (error) {
      Logger.error('Failed to send jobs to frontend', error);
      // Don't fail the entire scraping process if job delivery fails
      // The jobs are still saved in extension storage and can be accessed via API
    }
  }

  /**
   * Check if a URL is a JobJourney domain using environment-based detection
   */
  private async isJobJourneyUrl(url: string): Promise<boolean> {
    try {
      const jobJourneyBaseUrl = await getJobJourneyBaseUrl();
      const jobJourneyUrl = new URL(jobJourneyBaseUrl);
      const targetUrl = new URL(url);

      return (
        targetUrl.hostname.toLowerCase() === jobJourneyUrl.hostname.toLowerCase() &&
        targetUrl.port === jobJourneyUrl.port
      );
    } catch {
      return false;
    }
  }

  /**
   * Find JobJourney tabs using environment-based detection
   */
  private async findJobJourneyTabs(): Promise<chrome.tabs.Tab[]> {
    try {
      const tabs = await chrome.tabs.query({});
      const jobJourneyTabs: chrome.tabs.Tab[] = [];

      for (const tab of tabs) {
        if (tab.url && (await this.isJobJourneyUrl(tab.url))) {
          jobJourneyTabs.push(tab);
        }
      }

      return jobJourneyTabs;
    } catch (error) {
      Logger.error('Failed to find JobJourney tabs', error);
      return [];
    }
  }

  /**
   * Start sequential tab activation for performance improvement
   */
  private startSequentialTabActivation(sessionId: string): void {
    this.tabSequencer.startSequentialTabActivation(sessionId);
  }

  /**
   * Stop sequential tab activation
   */
  private stopSequentialTabActivation(): void {
    this.tabSequencer.stopSequentialTabActivation();
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): ScrapingSession[] {
    return this.sessionManager.getActiveSessions();
  }

  /**
   * Get all completed sessions
   */
  getCompletedSessions(): ScrapingSession[] {
    return this.sessionManager.getCompletedSessions();
  }

  /**
   * Get session by ID (checks both active and completed sessions)
   */
  getSession(sessionId: string): ScrapingSession | undefined {
    const activeSession = this.sessionManager.getActiveSession(sessionId);
    const completedSession = this.sessionManager.getCompletedSessions().find(session => session.id === sessionId);

    Logger.info(`🔍 Debug getSession - Looking for: ${sessionId}`);
    Logger.info(
      `🔍 Debug getSession - Active sessions: ${this.sessionManager.getActiveSessions().length} (found: ${!!activeSession})`,
    );
    Logger.info(
      `🔍 Debug getSession - Completed sessions: ${this.sessionManager.getCompletedSessions().length} (found: ${!!completedSession})`,
    );

    if (!activeSession && !completedSession) {
      Logger.info(
        `🔍 Debug getSession - Active IDs: [${this.sessionManager
          .getActiveSessions()
          .map(session => session.id)
          .join(', ')}]`,
      );
      Logger.info(
        `🔍 Debug getSession - Completed IDs: [${this.sessionManager
          .getCompletedSessions()
          .map(session => session.id)
          .join(', ')}]`,
      );
    }

    return activeSession || completedSession;
  }

  /**
   * Clean up old sessions
   */
  cleanupOldSessions(): void {
    const { activeRemoved, completedRemoved } = this.sessionManager.cleanupOldSessions();
    activeRemoved.forEach(sessionId => Logger.info(`🧹 Cleaned up old active session: ${sessionId}`));
    completedRemoved.forEach(sessionId => Logger.info(`🧹 Cleaned up old completed session: ${sessionId}`));
  }

  /**
   * Get available platforms
   */
  getAvailablePlatforms(): Platform[] {
    return Object.values(PLATFORMS).filter(platform => platform.enabled);
  }

  /**
   * Get available platforms for a specific country
   */
  getAvailablePlatformsForCountry(countryCode: string): Platform[] {
    const country = COUNTRIES[countryCode];
    if (!country) {
      return this.getAvailablePlatforms();
    }

    return Object.values(PLATFORMS).filter(platform => platform.enabled && country.platforms.includes(platform.id));
  }

  /**
   * Run a mock scraping session that exercises the full pipeline:
   * session creation → progress events → storage writes → completion → sendJobsToFrontend
   * Skips submitJobsToApi to avoid polluting the backend with fake data.
   */
  async runMockScrapeSession(jobCount: number): Promise<string> {
    const platforms = ['linkedin', 'indeed', 'seek', 'reed'];
    const config: SearchConfig = {
      keywords: 'mock test',
      location: 'Worldwide',
      platforms,
      maxJobs: jobCount,
    };

    const session = this.sessionManager.startSession(config);
    const sessionId = session.id;

    // Clear previous scraped jobs
    try {
      await this.storageService.clearScrapedJobs();
    } catch (error) {
      Logger.warning('Mock: Failed to clear previous scraped jobs:', error);
    }

    Logger.info(`🧪 Starting mock scrape session: ${sessionId} (${jobCount} jobs)`);

    this.progressTracker.emitSessionStatus(session, 'Starting mock job search...');

    // Generate mock jobs and feed them in batches per platform (like real scraping)
    const jobsPerPlatform = Math.ceil(jobCount / platforms.length);
    const titles = [
      'Software Engineer',
      'Frontend Developer',
      'Backend Developer',
      'Full Stack Developer',
      'DevOps Engineer',
      'Data Scientist',
      'Product Manager',
      'UX Designer',
      'QA Engineer',
      'Cloud Architect',
    ];
    const companies = [
      'TechCorp',
      'InnovateLabs',
      'DataDriven Inc',
      'CloudScale',
      'PixelPerfect',
      'Quantum Solutions',
      'NexGen Systems',
      'ByteForge',
      'Apex Digital',
      'Horizon AI',
    ];
    const cities = ['Sydney', 'Melbourne', 'London', 'New York', 'San Francisco', 'Berlin', 'Toronto', 'Singapore'];

    let globalIndex = 0;

    for (let pIdx = 0; pIdx < platforms.length; pIdx++) {
      const platformId = platforms[pIdx];
      const platformName = platformId.charAt(0).toUpperCase() + platformId.slice(1);
      const count = pIdx < platforms.length - 1 ? jobsPerPlatform : jobCount - globalIndex;

      // Simulate pages of ~20 jobs each
      const pageSize = 20;
      const totalPages = Math.ceil(count / pageSize);

      for (let page = 0; page < totalPages; page++) {
        // Check if session was stopped
        if (session.status === 'stopped') {
          Logger.info(`🧪 Mock session ${sessionId} was stopped`);
          return sessionId;
        }

        const jobsOnPage = Math.min(pageSize, count - page * pageSize);
        const pageJobs: JobData[] = [];

        for (let j = 0; j < jobsOnPage; j++) {
          const i = globalIndex++;
          pageJobs.push({
            id: `mock_${sessionId}_${i}`,
            title: `${titles[i % titles.length]} ${Math.floor(i / titles.length) + 1}`,
            company: companies[i % companies.length],
            location: cities[i % cities.length],
            jobUrl: `https://example.com/jobs/mock-${i}`,
            platform: platformId,
            description: `Mock job description for testing. Position: ${titles[i % titles.length]} at ${companies[i % companies.length]}, ${cities[i % cities.length]}. `,
            salary: `$${80 + (i % 120)}k - $${100 + (i % 120)}k`,
            postedDate: new Date(Date.now() - i * 3600000).toISOString(),
            isPRRequired: i % 5 === 0,
            companyLogoUrl: null,
            isAlreadyApplied: i % 20 === 0,
            appliedDateUtc: i % 20 === 0 ? new Date().toISOString() : null,
          });
        }

        session.jobs.push(...pageJobs);
        session.progress.jobsFound += pageJobs.length;

        // Store jobs in storage (like real scraping does)
        this.storageService.setScrapedJobs(session.jobs).catch(error => {
          Logger.warning('Mock: Failed to store jobs:', error);
        });

        // Emit progress event (like real scraping does)
        this.progressTracker.emitPlatformProgress({
          sessionId: session.id,
          platform: platformId,
          platformName,
          currentPage: page + 1,
          jobsFoundOnPage: pageJobs.length,
          totalJobsForPlatform: session.jobs.filter(j => j.platform === platformId).length,
          totalJobs: session.progress.jobsFound,
          hasNextPage: page < totalPages - 1,
        });

        // Small delay between pages to simulate scraping
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      session.progress.completedPlatforms++;

      this.progressTracker.emitSessionStatus(session, `Completed ${platformName}`);
    }

    // Complete session (mirrors runScrapingSession completion logic)
    session.status = 'completed';
    session.endTime = Date.now();

    this.sessionManager.completeSession(session);

    Logger.success(`🧪 Mock scraping completed: ${session.id}`, {
      totalJobs: session.jobs.length,
      duration: session.endTime - session.startTime,
    });

    // Emit completion event (triggers results page in side panel)
    this.progressTracker.emitScrapingComplete(session, 'completed', session.endTime - session.startTime);

    // Send jobs to frontend (skipping submitJobsToApi to avoid fake data in backend)
    if (session.jobs.length > 0) {
      Promise.resolve().then(async () => {
        try {
          await this.sendJobsToFrontend(session);
        } catch (error) {
          Logger.error('Mock: Failed to send jobs to frontend:', error);
        }
      });
    }

    return sessionId;
  }
}
