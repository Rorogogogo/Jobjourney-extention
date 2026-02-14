import { withErrorBoundary, withSuspense } from '@extension/shared';
import { cn, ErrorDisplay, LoadingSpinner, Button, Card } from '@extension/ui';
import { useState, useEffect } from 'react';
import { LogOut, Search, Settings } from 'lucide-react';
import { AuthSection } from './components/AuthSection';
import { ErrorSection } from './components/ErrorSection';
import { ProgressSection } from './components/ProgressSection';
import { ResultsSection } from './components/ResultsSection';
import { SearchSection } from './components/SearchSection';
import ToastManager from './components/ToastManager';
import { useJobJourneyState, type SearchConfig } from './hooks/useJobJourneyState';

type ViewType = 'search' | 'progress' | 'sending' | 'results' | 'error';

const SidePanel = () => {
  const [currentView, setCurrentView] = useState<ViewType>('search');

  const { authStatus, isAuthenticated, searchProgress, searchResults, searchError, isSendingJobs, sendingJobCount, startJobSearch, stopJobSearch } =
    useJobJourneyState();

  // Handle view transitions based on state
  useEffect(() => {
    if (searchError) {
      setCurrentView('error');
    } else if (isSendingJobs) {
      setCurrentView('sending');
    } else if (searchProgress?.sessionId && searchProgress.status !== 'completed') {
      setCurrentView('progress');
    } else if (searchResults?.jobs && searchResults.jobs.length > 0) {
      setCurrentView('results');
    } else {
      setCurrentView('search');
    }
  }, [searchProgress, searchResults, searchError, isSendingJobs]);

  const handleStartSearch = async (searchConfig: SearchConfig) => {
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
      <div className="flex h-screen w-full flex-col overflow-x-hidden bg-white font-sans text-sm text-gray-900">
        {/* Apple-style Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/90 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">JobJourney</span>
          </div>
          <div className="flex items-center gap-2">
             <AuthSection authStatus={authStatus} isAuthenticated={isAuthenticated} />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-3">
          <div className="mx-auto flex h-full max-w-md flex-col space-y-4">
            {currentView === 'search' && (
              <SearchSection onStartSearch={handleStartSearch} isAuthenticated={isAuthenticated} />
            )}

            {currentView === 'progress' && <ProgressSection progress={searchProgress} onStop={handleStopSearch} />}

            {currentView === 'sending' && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
                <p className="text-sm font-medium text-gray-700">
                  Sending {sendingJobCount} job{sendingJobCount !== 1 ? 's' : ''} to JobJourney...
                </p>
                <p className="text-xs text-gray-500">Opening your dashboard</p>
              </div>
            )}

            {currentView === 'results' && <ResultsSection results={searchResults} onSearchAgain={handleSearchAgain} />}

            {currentView === 'error' && <ErrorSection error={searchError} onRetry={handleRetry} />}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t bg-white px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by <span className="font-medium text-foreground">JobJourney AI</span>
          </p>
        </footer>
      </div>
    </ToastManager>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
