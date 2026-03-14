import { ErrorHeader } from './ErrorHeader';
import { ErrorResetButton } from './ErrorResetButton';
import { ErrorStackTraceList } from './ErrorStackTraceList';

export const ErrorDisplay = ({ error, resetErrorBoundary }: { error?: Error; resetErrorBoundary?: () => void }) => (
  <div className="flex items-center justify-center bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
    <div className="w-full max-w-md space-y-8">
      <ErrorHeader />
      <ErrorStackTraceList error={error} />
      <ErrorResetButton resetErrorBoundary={resetErrorBoundary} />
    </div>
  </div>
);
