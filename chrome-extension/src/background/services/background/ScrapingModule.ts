import { Logger } from '../../utils/Logger';
import type { ScrapingSession } from '../../types';
import type { EventManager } from '../EventManager';
import type { ScrapingService } from '../ScrapingService';
import type { StorageService } from '../StorageService';

export class ScrapingModule {
  private eventManager: EventManager;
  private scrapingService: ScrapingService;
  private storageService: StorageService;
  private activeScrapingSessions = new Map<string, ScrapingSession>();
  private scrapingControllers = new Map<string, AbortController>();
  private platformProgress: Record<string, any> = {};

  private broadcastToSidebars?: (message: any) => void;

  constructor(eventManager: EventManager, scrapingService: ScrapingService, storageService: StorageService) {
    this.eventManager = eventManager;
    this.scrapingService = scrapingService;
    this.storageService = storageService;
  }

  setBroadcastHandler(broadcastHandler: (message: any) => void) {
    this.broadcastToSidebars = broadcastHandler;
  }

  setupEventListeners(): void {
    this.eventManager.on('START_SCRAPING', this.handleStartScraping.bind(this));
    this.eventManager.on('SCRAPING_PROGRESS', this.handleScrapingProgress.bind(this));
    this.eventManager.on('SCRAPING_COMPLETE', this.handleScrapingComplete.bind(this));
    this.eventManager.on('SCRAPING_ERROR', this.handleScrapingError.bind(this));
    this.eventManager.on('PLATFORM_STARTED', this.handlePlatformStarted.bind(this));
    this.eventManager.on('PLATFORM_COMPLETED', this.handlePlatformCompleted.bind(this));
  }

  async loadPlatformProgress(): Promise<void> {
    try {
      const stored = await this.storageService.get('platformProgress');
      if (stored && typeof stored === 'object') {
        this.platformProgress = stored;
        Logger.info('📊 Loaded platform progress from storage:', this.platformProgress);
      }
    } catch (error) {
      Logger.error('Failed to load platform progress', error);
    }
  }

  private async savePlatformProgress(): Promise<void> {
    try {
      await this.storageService.set('platformProgress', this.platformProgress);
      Logger.info('💾 Saved platform progress to storage');
    } catch (error) {
      Logger.error('Failed to save platform progress', error);
    }
  }

  private handleStartScraping(data: any): void {
    Logger.info('Starting scraping session', data);
  }

  private handleScrapingProgress(data: any): void {
    if (data.currentPage && data.platform) {
      const { platform, platformName, currentPage, jobsFoundOnPage, totalJobsForPlatform, hasNextPage } = data;

      if (!this.platformProgress) {
        this.platformProgress = {};
      }

      if (!this.platformProgress[platform]) {
        Logger.warning(`⚠️ Platform ${platform} not found in platformProgress, initializing...`);
        this.platformProgress[platform] = {
          platform: platform,
          platformName: platformName,
          status: 'scraping',
          currentPage: 1,
          current: 0,
          total: 0,
          jobsFound: 0,
        };
      }

      const previousJobsFound = this.platformProgress[platform].jobsFound || 0;
      Logger.info(
        `🔍 Updating ${platform} progress: Previous jobsFound=${previousJobsFound}, New totalJobsForPlatform=${totalJobsForPlatform}`,
      );

      let totalJobsFromPreviousPages = 0;
      if (currentPage > 1 && jobsFoundOnPage === 0) {
        totalJobsFromPreviousPages = totalJobsForPlatform;
      } else {
        totalJobsFromPreviousPages =
          this.platformProgress[platform].totalJobsFromPreviousPages || totalJobsForPlatform - jobsFoundOnPage;
      }

      this.platformProgress[platform] = {
        ...this.platformProgress[platform],
        currentPage: currentPage,
        jobsFound: totalJobsForPlatform,
        current: jobsFoundOnPage,
        total: 25,
        hasNextPage: hasNextPage,
        status: 'scraping',
        totalJobsFromPreviousPages: totalJobsFromPreviousPages,
      };

      Logger.info(
        `📊 ${platformName} - Page ${currentPage}: Found ${jobsFoundOnPage} jobs (Total: ${totalJobsForPlatform})`,
      );

      this.updateOverallProgress();
    } else {
      Logger.info('Scraping progress update', data);

      if (data.platform && this.platformProgress && this.platformProgress[data.platform]) {
        const existingPlatform = this.platformProgress[data.platform];

        if (existingPlatform.currentPage && existingPlatform.status === 'scraping') {
          this.platformProgress[data.platform] = {
            ...existingPlatform,
            current: data.current || existingPlatform.current,
            total: data.total || existingPlatform.total,
            jobsFound: data.jobsFound || existingPlatform.jobsFound,
          };
          Logger.info(`🔄 Preserving page info for ${data.platform}: Page ${existingPlatform.currentPage}`);
        } else {
          this.platformProgress[data.platform] = {
            ...existingPlatform,
            current: data.current,
            total: data.total,
            jobsFound: data.jobsFound,
            status: 'active',
          };
        }

        this.updateOverallProgress();
      }

      this.broadcastToSidebars?.({ type: 'SCRAPING_PROGRESS', data });
    }
  }

  private handleScrapingComplete(data: any): void {
    Logger.success('Scraping completed', data);
    this.broadcastToSidebars?.({ type: 'SCRAPING_COMPLETE', data });
  }

  private handleScrapingError(data: any): void {
    Logger.error('Scraping error', data);
    this.broadcastToSidebars?.({ type: 'SCRAPING_ERROR', data });
  }

  private async handlePlatformStarted(data: any): Promise<void> {
    try {
      const { platform, platformName } = data;

      if (!this.platformProgress) {
        this.platformProgress = {};
      }

      this.platformProgress[platform] = {
        platform: platform,
        platformName: platformName,
        status: 'scraping',
        currentPage: 1,
        current: 0,
        total: 0,
        jobsFound: 0,
        error: null,
      };

      this.updateOverallProgress();

      Logger.info(`🚀 Platform ${platformName} started scraping`);
    } catch (error) {
      Logger.error('Error handling platform started', error);
    }
  }

  async handlePlatformCompleted(data: any): Promise<void> {
    try {
      const { platform, platformName, totalJobs = 0, totalPages = 1, error } = data;

      if (this.platformProgress[platform]) {
        if (error) {
          this.platformProgress[platform].status = 'completed';
          this.platformProgress[platform].error = error;
          this.platformProgress[platform].jobsFound = totalJobs;
        } else {
          this.platformProgress[platform].status = 'completed';
          this.platformProgress[platform].jobsFound = totalJobs;
          this.platformProgress[platform].totalPages = totalPages;
        }

        Logger.info(`✅ Platform ${platformName} completed: ${totalJobs} jobs from ${totalPages} pages`);

        this.updateOverallProgress();
      }
    } catch (error) {
      Logger.error('Error handling platform completion', error);
    }
  }

  private updateOverallProgress(): void {
    const platforms = Object.values(this.platformProgress);
    const totalJobsFound = platforms.reduce((sum: number, p: any) => sum + p.jobsFound, 0);
    const completedPlatforms = platforms.filter((p: any) => p.status === 'completed').length;
    const scrapingPlatforms = platforms.filter((p: any) => p.status === 'scraping');
    const errors = platforms
      .filter((p: any) => p.error)
      .map((p: any) => `${p.platform}: ${p.error || 'Unknown error'}`);

    let statusMessage = 'Initializing...';
    if (scrapingPlatforms.length > 0) {
      const currentPlatform = scrapingPlatforms[0];
      const page = currentPlatform.currentPage || 1;
      statusMessage = `Scraping ${currentPlatform.platformName || currentPlatform.platform} - Page ${page}`;
    } else if (completedPlatforms === platforms.length && platforms.length > 0) {
      statusMessage = 'Finalizing results...';
    }

    this.broadcastToSidebars?.({
      type: 'SCRAPING_PROGRESS_UPDATE',
      data: {
        sessionId: 'current',
        status: statusMessage,
        progress: {
          totalPlatforms: platforms.length,
          completedPlatforms: completedPlatforms,
          currentPlatform: scrapingPlatforms[0]?.platform || null,
          jobsFound: totalJobsFound,
          errors: errors,
        },
        platformProgress: this.platformProgress,
      },
    });

    this.savePlatformProgress();
  }

  async handleStartJobSearch(data: any, sendResponse: (response: any) => void): Promise<void> {
    try {
      if (data.clearProgress) {
        this.platformProgress = {};
        await this.savePlatformProgress();
        Logger.info('🗑️ Cleared platform progress for new search');
      }

      if (!this.platformProgress) {
        this.platformProgress = {};
      }
      const enabledPlatforms = data.platforms || [];
      Logger.info('🎯 Starting job search with platforms:', enabledPlatforms);

      Object.keys(this.platformProgress).forEach(platform => {
        if (!enabledPlatforms.includes(platform)) {
          delete this.platformProgress[platform];
          Logger.info(`🗑️ Removed unselected platform: ${platform}`);
        }
      });

      enabledPlatforms.forEach((platform: string) => {
        this.platformProgress[platform] = {
          platform,
          status: 'pending',
          current: 0,
          total: 0,
          jobsFound: 0,
        };
      });

      const completedPlatforms = 0;

      this.broadcastToSidebars?.({
        type: 'SCRAPING_PROGRESS_UPDATE',
        data: {
          sessionId: 'initializing',
          status: 'Initializing job search...',
          progress: {
            totalPlatforms: enabledPlatforms.length,
            completedPlatforms: completedPlatforms,
            currentPlatform: null,
            jobsFound: 0,
            errors: [],
          },
          platformProgress: this.platformProgress,
        },
      });

      const sessionId = await this.scrapingService.startJobSearch(data);
      this.activeScrapingSessions.set(sessionId, {
        id: sessionId,
        startTime: new Date(),
        status: 'active',
        platforms: data.platforms,
        keywords: data.keywords,
      });

      sendResponse({ success: true, data: { sessionId } });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleStopScraping(data: any, sendResponse: (response: any) => void): Promise<void> {
    try {
      const { sessionId } = data;
      const controller = this.scrapingControllers.get(sessionId);

      if (controller) {
        controller.abort();
        this.scrapingControllers.delete(sessionId);
      }

      const session = this.activeScrapingSessions.get(sessionId);
      if (session) {
        session.status = 'stopped';
        this.activeScrapingSessions.set(sessionId, session);
      }

      await this.scrapingService.stopScrapingSession(sessionId);

      sendResponse({ success: true, data: { sessionId, status: 'stopped' } });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async getSearchProgress(sessionId: string): Promise<any> {
    const session = this.activeScrapingSessions.get(sessionId);

    const platforms = Object.values(this.platformProgress);
    const totalJobsFound = platforms.reduce((sum: number, p: any) => sum + p.jobsFound, 0);
    const completedPlatforms = platforms.filter((p: any) => p.status === 'completed').length;
    const activePlatform = platforms.find((p: any) => p.status === 'active');
    const errors = platforms
      .filter((p: any) => p.error)
      .map((p: any) => `${p.platform}: ${p.error || 'Unknown error'}`);

    return {
      sessionId: sessionId || 'current',
      status: activePlatform ? `Processing ${activePlatform.platform}...` : session ? session.status : 'active',
      progress: {
        totalPlatforms: platforms.length || 3,
        completedPlatforms: completedPlatforms,
        currentPlatform: activePlatform?.platform || null,
        jobsFound: totalJobsFound,
        errors: errors,
      },
      platformProgress: this.platformProgress,
      startTime: session?.startTime || new Date(),
    };
  }

  async handleScrapingProgressMessage(data: any, sendResponse: (response?: any) => void): Promise<void> {
    try {
      Logger.info(
        `📊 Scraping progress from ${data.platform}: ${data.current}/${data.total} jobs, ${data.jobsFound} found`,
      );

      if (!this.platformProgress) {
        this.platformProgress = {};
      }

      if (!this.platformProgress[data.platform] || this.platformProgress[data.platform].status !== 'completed') {
        const existingPlatform = this.platformProgress[data.platform] || {};

        if (existingPlatform.currentPage && existingPlatform.status === 'scraping') {
          const baseJobCount = existingPlatform.totalJobsFromPreviousPages || 0;
          const updatedTotalJobs = baseJobCount + data.jobsFound;

          this.platformProgress[data.platform] = {
            ...existingPlatform,
            current: data.current,
            total: data.total,
            jobsFound: updatedTotalJobs,
          };
          Logger.info(
            `🔄 Updated ${data.platform}: Processing ${data.current}/${data.total}, Found ${data.jobsFound} on page, Total: ${updatedTotalJobs}`,
          );
        } else {
          this.platformProgress[data.platform] = {
            platform: data.platform,
            status: 'active',
            current: data.current,
            total: data.total,
            jobsFound: data.jobsFound,
          };
        }
      }

      const platforms = Object.values(this.platformProgress);
      const totalJobsFound = platforms.reduce((sum, p) => sum + p.jobsFound, 0);
      const activePlatforms = platforms.filter(p => p.status === 'active').length;
      const completedPlatforms = platforms.filter(p => p.status === 'completed').length;

      this.broadcastToSidebars?.({
        type: 'SCRAPING_PROGRESS_UPDATE',
        data: {
          sessionId: 'current',
          status: `Processing ${data.platform} jobs: ${data.current}/${data.total}`,
          progress: {
            totalPlatforms: platforms.length,
            completedPlatforms: completedPlatforms,
            currentPlatform: data.platform,
            jobsFound: totalJobsFound,
            errors: [],
          },
          platformProgress: this.platformProgress,
        },
      });

      sendResponse({ success: true });
    } catch (error) {
      Logger.error('Error handling scraping progress message', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleScrapingResult(data: any, sendResponse: (response?: any) => void): Promise<void> {
    try {
      const { platform, jobs = [], error } = data;

      Logger.info(`📄 Received scraping result from ${platform}: ${jobs.length} jobs`);

      sendResponse({ success: true });
    } catch (error) {
      Logger.error('Error handling scraping result', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  performCleanup(): void {
    Logger.info('Performing periodic cleanup for scraping sessions');

    const now = new Date();
    for (const [sessionId, session] of this.activeScrapingSessions.entries()) {
      const ageInHours = (now.getTime() - session.startTime.getTime()) / (1000 * 60 * 60);
      if (ageInHours > 24) {
        this.activeScrapingSessions.delete(sessionId);
        this.scrapingControllers.delete(sessionId);
      }
    }
  }
}
