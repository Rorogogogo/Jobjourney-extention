import type React from 'react';
import { AlertCircle, RotateCcw, WifiOff, Lock } from 'lucide-react';
import { Card, CardContent, Button } from '@extension/ui';

interface ErrorSectionProps {
  error: string | null;
  onRetry: () => void;
}

export const ErrorSection: React.FC<ErrorSectionProps> = ({ error, onRetry }) => {
  if (!error) return null;

  const getErrorDetails = (errorMessage: string) => {
    if (errorMessage.includes('Authentication required')) {
      return {
        icon: <Lock className="h-10 w-10 text-orange-500" />,
        title: 'Authentication Required',
        message: 'Please sign in to JobJourney to search for jobs.',
        suggestion: 'Click the "Sign In" button in the header.',
      };
    }

    if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
      return {
        icon: <WifiOff className="h-10 w-10 text-red-500" />,
        title: 'Connection Error',
        message: 'Unable to connect to JobJourney servers.',
        suggestion: 'Please check your internet connection.',
      };
    }

    return {
      icon: <AlertCircle className="h-10 w-10 text-destructive" />,
      title: 'Search Error',
      message: errorMessage,
      suggestion: 'Please try again or contact support.',
    };
  };

  const details = getErrorDetails(error);

  return (
    <Card className="border-destructive/20 shadow-sm">
      <CardContent className="flex flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 rounded-full bg-destructive/10 p-3">
          {details.icon}
        </div>
        <h3 className="mb-2 text-lg font-semibold tracking-tight">{details.title}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{details.message}</p>
        
        {details.suggestion && (
          <div className="mb-6 rounded-md bg-secondary p-3 text-xs text-secondary-foreground">
            {details.suggestion}
          </div>
        )}

        <Button onClick={onRetry} variant="outline" className="w-full sm:w-auto gap-2">
          <RotateCcw className="h-4 w-4" /> Try Again
        </Button>
      </CardContent>
    </Card>
  );
};
