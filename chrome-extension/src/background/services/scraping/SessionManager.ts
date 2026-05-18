import type { JobData, ScrapingProgress, SearchConfig } from '@extension/types';

export interface ScrapingSessionState {
  id: string;
  config: SearchConfig;
  status: 'running' | 'completed' | 'error' | 'stopped';
  startTime: number;
  endTime?: number;
  progress: ScrapingProgress;
  jobs: JobData[];
  error?: string;
}

export class SessionManager {
  private activeSessions = new Map<string, ScrapingSessionState>();
  private completedSessions = new Map<string, ScrapingSessionState>();

  startSession(config: SearchConfig): ScrapingSessionState {
    const session: ScrapingSessionState = {
      id: this.generateSessionId(),
      config,
      status: 'running',
      startTime: Date.now(),
      progress: {
        totalPlatforms: config.platforms.length,
        completedPlatforms: 0,
        jobsFound: 0,
        errors: [],
      },
      jobs: [],
    };

    this.activeSessions.set(session.id, session);
    return session;
  }

  getActiveSession(sessionId: string): ScrapingSessionState | undefined {
    return this.activeSessions.get(sessionId);
  }

  getSession(sessionId: string): ScrapingSessionState | undefined {
    return this.activeSessions.get(sessionId) || this.completedSessions.get(sessionId);
  }

  completeSession(session: ScrapingSessionState): void {
    this.completedSessions.set(session.id, session);
    this.activeSessions.delete(session.id);
  }

  getProgress(sessionId: string): ScrapingProgress | null {
    return this.activeSessions.get(sessionId)?.progress || null;
  }

  getActiveSessions(): ScrapingSessionState[] {
    return Array.from(this.activeSessions.values());
  }

  getCompletedSessions(): ScrapingSessionState[] {
    return Array.from(this.completedSessions.values());
  }

  cleanupOldSessions(): { activeRemoved: string[]; completedRemoved: string[] } {
    const maxAge = 24 * 60 * 60 * 1000;
    const completedMaxAge = 2 * 60 * 60 * 1000;
    const now = Date.now();
    const activeRemoved: string[] = [];
    const completedRemoved: string[] = [];

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.startTime > maxAge) {
        this.activeSessions.delete(sessionId);
        activeRemoved.push(sessionId);
      }
    }

    for (const [sessionId, session] of this.completedSessions.entries()) {
      const sessionAge = session.endTime ? now - session.endTime : now - session.startTime;
      if (sessionAge > completedMaxAge) {
        this.completedSessions.delete(sessionId);
        completedRemoved.push(sessionId);
      }
    }

    return { activeRemoved, completedRemoved };
  }

  private generateSessionId(): string {
    return `scraping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
