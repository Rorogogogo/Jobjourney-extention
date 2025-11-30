import { withErrorBoundary, withSuspense } from '@extension/shared';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useState, useEffect } from 'react';
import { AuthSection } from './components/AuthSection';
import { ErrorSection } from './components/ErrorSection';
import { ProgressSection } from './components/ProgressSection';
import { ResultsSection } from './components/ResultsSection';
import { SearchSection } from './components/SearchSection';
import ToastManager from './components/ToastManager';
import { useJobJourneyState } from './hooks/useJobJourneyState';

type ViewType = 'search' | 'progress' | 'results' | 'error';

const SidePanel = () => {
  const [currentView, setCurrentView] = useState<ViewType>('search');

  const {
    authStatus,
    isAuthenticated,
    searchProgress,
    searchResults,
    searchError,
    startJobSearch,
    stopJobSearch,
    checkAuthStatus,
  } = useJobJourneyState();

  // Handle view transitions based on state
  useEffect(() => {
    if (searchError) {
      setCurrentView('error');
    } else if (searchProgress?.sessionId && searchProgress.status !== 'completed') {
      setCurrentView('progress');
    } else if (searchResults?.jobs && searchResults.jobs.length > 0) {
      setCurrentView('results');
    } else {
      setCurrentView('search');
    }
  }, [searchProgress, searchResults, searchError]);

  const handleStartSearch = async (searchConfig: Record<string, unknown>) => {
    try {
      setCurrentView('progress');
      await startJobSearch(searchConfig);
    } catch {
      setCurrentView('error');
    }
  };

  const handleStopSearch = async () => {
    try {
      await stopJobSearch();
      setCurrentView('search');
    } catch (error) {
      console.error('Failed to stop search:', error);
    }
  };

  const handleSearchAgain = () => {
    setCurrentView('search');
  };

  const handleRetry = () => {
    setCurrentView('search');
  };

  return (
    <ToastManager>
      <div
        className={cn(
          'flex h-screen w-full flex-col overflow-x-hidden font-sans text-sm leading-relaxed text-white',
          'bg-gradient-to-br from-black to-gray-900',
        )}>
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-gray-700 px-4 py-2">
          <div className="flex items-center justify-center">
            <span className="text-base font-bold leading-none tracking-wider text-white">JJ</span>
          </div>
          <div className="flex-1">
            <AuthSection authStatus={authStatus} isAuthenticated={isAuthenticated} onAuthCheck={checkAuthStatus} />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {currentView === 'search' && (
            <SearchSection onStartSearch={handleStartSearch} isAuthenticated={isAuthenticated} />
          )}

          {currentView === 'progress' && <ProgressSection progress={searchProgress} onStop={handleStopSearch} />}

          {currentView === 'results' && <ResultsSection results={searchResults} onSearchAgain={handleSearchAgain} />}

          {currentView === 'error' && <ErrorSection error={searchError} onRetry={handleRetry} />}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 px-4 py-2 text-center">
          <p className="text-xs text-white/50">
            Powered by <span className="font-medium text-white/80">JobJourney</span>
          </p>
        </div>
      </div>
    </ToastManager>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
