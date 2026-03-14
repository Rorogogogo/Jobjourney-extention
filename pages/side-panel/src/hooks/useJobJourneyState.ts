import { useState, useEffect, useCallback } from 'react';
import type { AuthStatus, SearchConfig, SearchResults, ScrapingProgress, PlatformProgress } from '@extension/types';
import { MessageType } from '@extension/types';

export interface SearchProgressState {
  sessionId: string;
  status: string;
  progress?: ScrapingProgress;
  platformProgress?: Record<string, PlatformProgress>;
}

export type { SearchConfig };

export const useJobJourneyState = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isAuthenticated: false });
  const [searchProgress, setSearchProgress] = useState<SearchProgressState | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSendingJobs, setIsSendingJobs] = useState(false);
  const [sendingJobCount, setSendingJobCount] = useState(0);
  const currentSessionId = searchProgress?.sessionId;

  // Check authentication status
  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.GET_AUTH_STATUS,
      });

      if (response?.success) {
        setAuthStatus(response.data);
      } else {
        setAuthStatus({ isAuthenticated: false });
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setAuthStatus({ isAuthenticated: false });
    }
  }, []);

  // Start job search
  const startJobSearch = useCallback(async (config: SearchConfig) => {
    try {
      setLoading(true);
      setSearchError(null);
      setSearchResults(null);

      const response = await chrome.runtime.sendMessage({
        type: MessageType.START_JOB_SEARCH,
        data: config,
      });

      if (response?.success) {
        // Create platform progress for only selected platforms
        const platformProgress: Record<string, PlatformProgress> = {};
        config.platforms.forEach(platformId => {
          platformProgress[platformId] = {
            platform: platformId,
            status: 'pending',
            current: 0,
            total: 0,
            jobsFound: 0,
          };
        });

        setSearchProgress({
          sessionId: response.data.sessionId,
          status: 'starting',
          progress: {
            totalPlatforms: config.platforms.length,
            completedPlatforms: 0,
            jobsFound: 0,
            errors: [],
          },
          platformProgress: platformProgress,
        });
      } else {
        throw new Error(response?.error || 'Failed to start job search');
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Stop job search
  const stopJobSearch = useCallback(async () => {
    if (!searchProgress?.sessionId) return;

    try {
      await chrome.runtime.sendMessage({
        type: MessageType.STOP_SCRAPING,
        data: { sessionId: searchProgress.sessionId },
      });

      setSearchProgress(null);
    } catch (error) {
      console.error('Failed to stop job search:', error);
    }
  }, [searchProgress?.sessionId]);

  // Listen for Chrome runtime messages
  useEffect(() => {
    const messageListener = (message: any) => {
      console.log('🎯 Side panel received message:', message.type, message.data);
      switch (message.type) {
        case MessageType.AUTH_STATUS_CHANGED:
          setAuthStatus(message.data);
          break;

        case MessageType.SCRAPING_PROGRESS:
          if (message.data.sessionId === currentSessionId) {
            setSearchProgress(prev =>
              prev
                ? {
                    ...prev,
                    progress: message.data.progress,
                    status: message.data.status || prev.status,
                  }
                : null,
            );
          }
          break;

        case MessageType.SCRAPING_PROGRESS_UPDATE:
          // Always update progress for active sessions (more permissive matching)
          if (
            currentSessionId &&
            (message.data.sessionId === currentSessionId ||
              message.data.sessionId === 'current' ||
              message.data.sessionId === 'initializing')
          ) {
            setSearchProgress(prev =>
              prev
                ? {
                    ...prev,
                    progress: message.data.progress,
                    status: message.data.status || prev.status,
                    platformProgress: message.data.platformProgress,
                  }
                : {
                    sessionId: message.data.sessionId,
                    status: message.data.status,
                    progress: message.data.progress,
                    platformProgress: message.data.platformProgress,
                  },
            );
          }
          break;

        case MessageType.SCRAPING_COMPLETE:
          if (message.data.sessionId === currentSessionId) {
            setSearchProgress(null);
            setSearchResults({
              sessionId: message.data.sessionId,
              jobs: message.data.jobs || [],
              totalJobs: message.data.totalJobs || 0,
              duration: message.data.duration,
            });
          }
          break;

        case MessageType.SCRAPING_ERROR:
          if (message.data.sessionId === currentSessionId) {
            setSearchProgress(null);
            setSearchError(message.data.error || 'Scraping failed');

            // Show partial results if available
            if (message.data.jobs && message.data.jobs.length > 0) {
              setSearchResults({
                sessionId: message.data.sessionId,
                jobs: message.data.jobs,
                totalJobs: message.data.totalJobs || message.data.jobs.length,
              });
            }
          }
          break;

        case MessageType.JOBS_SENDING:
          setIsSendingJobs(true);
          setSendingJobCount(message.data.totalJobs || 0);
          break;

        case MessageType.JOBS_SENT:
          setIsSendingJobs(false);
          setSendingJobCount(0);
          break;
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [currentSessionId]);

  // Check auth status on mount and when the side panel becomes visible
  useEffect(() => {
    checkAuthStatus();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAuthStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkAuthStatus]);

  return {
    authStatus,
    isAuthenticated: authStatus.isAuthenticated,
    searchProgress,
    searchResults,
    searchError,
    loading,
    isSendingJobs,
    sendingJobCount,
    startJobSearch,
    stopJobSearch,
    checkAuthStatus,
    clearResults: () => {
      setSearchResults(null);
      setSearchError(null);
    },
    clearError: () => setSearchError(null),
  };
};
