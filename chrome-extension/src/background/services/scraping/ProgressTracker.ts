import { EventType } from '@extension/types';
import type { EventManager } from '../EventManager';
import type { ScrapingSessionState } from './SessionManager';

export class ProgressTracker {
  constructor(private readonly eventManager: EventManager) {}

  getProgress(session: ScrapingSessionState | undefined): ScrapingSessionState['progress'] | null {
    return session?.progress || null;
  }

  emitSessionStatus(session: ScrapingSessionState, status: string): void {
    this.eventManager.emit(EventType.SCRAPING_PROGRESS, {
      sessionId: session.id,
      progress: session.progress,
      status,
    });
  }

  emitPlatformStarted(sessionId: string, platform: string, platformName: string): void {
    this.eventManager.emit(EventType.PLATFORM_STARTED, {
      sessionId,
      platform,
      platformName,
    });
  }

  emitPlatformProgress(data: {
    sessionId: string;
    platform: string;
    platformName: string;
    currentPage: number;
    jobsFoundOnPage: number;
    totalJobsForPlatform: number;
    totalJobs: number;
    hasNextPage: boolean;
  }): void {
    this.eventManager.emit(EventType.SCRAPING_PROGRESS, data);
  }

  emitPlatformCompleted(data: {
    sessionId: string;
    platform: string;
    platformName: string;
    totalJobs: number;
    totalPages: number;
  }): void {
    this.eventManager.emit(EventType.PLATFORM_COMPLETED, data);
  }

  emitScrapingComplete(session: ScrapingSessionState, status: 'completed' | 'stopped', duration?: number): void {
    this.eventManager.emit(EventType.SCRAPING_COMPLETE, {
      sessionId: session.id,
      status,
      jobs: session.jobs,
      totalJobs: session.jobs.length,
      duration,
      errors: session.progress.errors,
    });
  }

  emitScrapingError(session: ScrapingSessionState, error: string): void {
    this.eventManager.emit(EventType.SCRAPING_ERROR, {
      sessionId: session.id,
      error,
      jobs: session.jobs,
      totalJobs: session.jobs.length,
    });
  }

  emitJobsSending(sessionId: string, totalJobs: number): void {
    this.eventManager.emit(EventType.JOBS_SENDING, {
      sessionId,
      totalJobs,
    });
  }

  emitJobsSent(sessionId: string, totalJobs: number): void {
    this.eventManager.emit(EventType.JOBS_SENT, {
      sessionId,
      totalJobs,
    });
  }
}
