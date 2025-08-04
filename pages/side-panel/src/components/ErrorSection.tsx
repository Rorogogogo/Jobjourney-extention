import type React from 'react';

interface ErrorSectionProps {
  error: string | null;
  onRetry: () => void;
}

export const ErrorSection: React.FC<ErrorSectionProps> = ({ error, onRetry }) => {
  if (!error) return null;

  const getErrorDetails = (errorMessage: string) => {
    // Parse different types of errors and provide helpful details
    if (errorMessage.includes('Authentication required')) {
      return {
        title: 'Authentication Required',
        message: 'Please sign in to JobJourney to search for jobs.',
        suggestion: 'Click the "Sign In" button to authenticate your account.',
      };
    }

    if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
      return {
        title: 'Connection Error',
        message: 'Unable to connect to JobJourney servers.',
        suggestion: 'Please check your internet connection and try again.',
      };
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      return {
        title: 'Request Timeout',
        message: 'The search request took too long to complete.',
        suggestion: 'Try searching with fewer platforms or check your connection.',
      };
    }

    return {
      title: 'Search Error',
      message: errorMessage,
      suggestion: 'Please try again or contact support if the problem persists.',
    };
  };

  const errorDetails = getErrorDetails(error);

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="text-5xl">⚠️</div>
        <div className="text-lg font-semibold text-red-400">{errorDetails.title}</div>
        <div className="text-sm text-white/80">{errorDetails.message}</div>
        {errorDetails.suggestion && <div className="mb-2 text-xs text-white/60">{errorDetails.suggestion}</div>}
        <button
          className="min-w-30 cursor-pointer rounded-lg border border-white/20 bg-white/10 px-6 py-2 text-sm font-semibold text-white transition-all duration-300 hover:border-white/30 hover:bg-white/15"
          onClick={onRetry}>
          Try Again
        </button>
      </div>
    </div>
  );
};
