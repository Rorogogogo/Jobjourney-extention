import Toast from './Toast';
import React, { useState, useCallback, useEffect } from 'react';
import type { ToastData, ToastType } from './Toast';

interface ToastManagerProps {
  children: React.ReactNode;
}

// Global toast manager context
export const ToastContext = React.createContext<{
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
}>({
  showToast: () => {},
});

const ToastManager: React.FC<ToastManagerProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback((type: ToastType, title: string, message?: string, duration: number = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastData = {
      id,
      type,
      title,
      message,
      duration,
    };

    setToasts(prev => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Listen for events from background script
  useEffect(() => {
    const handleMessages = (message: any) => {
      switch (message.type) {
        case 'AUTH_STATUS_CHANGED':
          const { isAuthenticated, user, shouldShowToast, reason } = message.data;

          // Only show toast if explicitly requested (default to true for backward compatibility)
          if (shouldShowToast !== false) {
            if (isAuthenticated && user) {
              showToast(
                'success',
                'Signed In Successfully!',
                `Welcome back, ${user.firstName || user.name || 'User'}`,
                3000,
              );
            } else {
              // Show different message based on reason
              if (reason === 'token_expired') {
                showToast(
                  'warning',
                  'Session Expired',
                  'Your session has expired. Please sign in again to continue.',
                  5000,
                );
              } else {
                showToast('info', 'Signed Out', 'You have been signed out successfully', 3000);
              }
            }
          }
          break;

        case 'SCRAPING_COMPLETE':
          const { jobs, sessionId, status } = message.data;
          const jobCount = jobs?.length || 0;

          // Only show toast for natural completion, not manual stops
          if (status === 'completed') {
            if (jobCount > 0) {
              showToast(
                'success',
                'Job Search Complete!',
                `Found ${jobCount} job${jobCount > 1 ? 's' : ''} matching your criteria`,
                4000,
              );
            } else {
              showToast('warning', 'No Jobs Found', 'Try adjusting your search criteria or location', 4000);
            }
          }
          // For manual stops (status === 'stopped'), don't show toast as user initiated the action
          break;

        case 'SCRAPING_ERROR':
          const { error } = message.data;
          showToast('error', 'Search Failed', error?.message || 'An error occurred while searching for jobs', 5000);
          break;

        default:
          break;
      }
    };

    // Listen for messages from background script
    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessages);

      return () => {
        chrome.runtime.onMessage.removeListener(handleMessages);
      };
    }
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div className="pointer-events-none fixed right-4 top-4 z-50">
        <div className="flex flex-col gap-3">
          {toasts.map((toast, index) => (
            <div
              key={toast.id}
              className="pointer-events-auto"
              style={{
                zIndex: 1000 - index,
              }}>
              <Toast toast={toast} onRemove={removeToast} />
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};

export default ToastManager;

// Hook for using toast
export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastManager');
  }
  return context;
};
