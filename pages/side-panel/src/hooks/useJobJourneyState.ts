import { useState, useEffect, useCallback } from 'react';

interface AuthStatus {
  isAuthenticated: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    isPro?: boolean;
  };
  token?: string;
}

interface SearchProgress {
  sessionId: string;
  status: string;
  progress?: {
    totalPlatforms: number;
    completedPlatforms: number;
    currentPlatform?: string;
    jobsFound: number;
    errors: string[];
  };
  platformProgress?: Record<
    string,
    {
      platform: string;
      status: 'pending' | 'active' | 'completed' | 'error';
      current: number;
      total: number;
      jobsFound: number;
      error?: string;
    }
  >;
}

interface SearchResults {
  sessionId: string;
  jobs: any[];
  totalJobs: number;
  duration?: number;
}

interface SearchConfig {
  keywords: string;
  location?: string;
  country?: string;
  platforms: string[];
}

export const useJobJourneyState = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isAuthenticated: false });
  const [searchProgress, setSearchProgress] = useState<SearchProgress | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check authentication status
  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_AUTH_STATUS',
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
        type: 'START_JOB_SEARCH',
        data: config,
      });

      if (response?.success) {
        // Create platform progress for only selected platforms
        const platformProgress: Record<string, any> = {};
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
        type: 'STOP_SCRAPING',
        data: { sessionId: searchProgress.sessionId },
      });

      setSearchProgress(null);
    } catch (error) {
      console.error('Failed to stop job search:', error);
    }
  }, [searchProgress?.sessionId]);

  // Get search progress
  const getSearchProgress = useCallback(async (sessionId: string) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SEARCH_PROGRESS',
        data: { sessionId },
      });

      if (response?.success) {
        return response.data;
      }
    } catch (error) {
      console.error('Failed to get search progress:', error);
    }
    return null;
  }, []);

  // Listen for Chrome runtime messages
  useEffect(() => {
    const messageListener = (message: any, sender: chrome.runtime.MessageSender) => {
      console.log('🎯 Side panel received message:', message.type, message.data);
      switch (message.type) {
        case 'AUTH_STATUS_CHANGED':
          setAuthStatus(message.data);
          break;

        case 'SCRAPING_PROGRESS':
          if (message.data.sessionId === searchProgress?.sessionId) {
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

        case 'SCRAPING_PROGRESS_UPDATE':
          // Always update progress for active sessions (more permissive matching)
          if (
            searchProgress &&
            (message.data.sessionId === searchProgress.sessionId ||
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

        case 'SCRAPING_COMPLETE':
          if (message.data.sessionId === searchProgress?.sessionId) {
            setSearchProgress(null);
            setSearchResults({
              sessionId: message.data.sessionId,
              jobs: message.data.jobs || [],
              totalJobs: message.data.totalJobs || 0,
              duration: message.data.duration,
            });
          }
          break;

        case 'SCRAPING_ERROR':
          if (message.data.sessionId === searchProgress?.sessionId) {
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
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [searchProgress?.sessionId]);

  // Check auth status on mount and periodically
  useEffect(() => {
    checkAuthStatus();

    const interval = setInterval(checkAuthStatus, 30000); // Safety net check every 30 seconds

    return () => clearInterval(interval);
  }, [checkAuthStatus]);

  // Poll for search progress if we have an active session
  useEffect(() => {
    if (!searchProgress?.sessionId) return;

    const pollProgress = async () => {
      const progress = await getSearchProgress(searchProgress.sessionId);
      if (progress) {
        setSearchProgress(prev =>
          prev
            ? {
                ...prev,
                progress: progress.progress,
                status: progress.status,
                platformProgress: progress.platformProgress, // Include platform progress in polling updates
              }
            : null,
        );
      }
    };

    const interval = setInterval(pollProgress, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [searchProgress?.sessionId, getSearchProgress]);

  return {
    authStatus,
    isAuthenticated: authStatus.isAuthenticated,
    searchProgress,
    searchResults,
    searchError,
    loading,
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
