import { useEffect, useState } from 'react';
import type React from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastData;
  onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    // Show toast with animation
    const showTimer = setTimeout(() => setIsVisible(true), 10);

    // Auto-remove toast after duration
    const removeTimer = setTimeout(() => {
      handleRemove();
    }, toast.duration || 4000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  const handleRemove = () => {
    setIsRemoving(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300); // Match animation duration
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
            <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
            <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      case 'warning':
        return (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500">
            <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      case 'info':
      default:
        return (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
            <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
    }
  };

  // All toasts now use white background with colored icons
  const colors = {
    bg: 'bg-white/95',
    border: 'border-gray-300/50',
    text: 'text-gray-900',
  };

  return (
    <div
      className={`min-w-[280px] max-w-[320px] ${colors.bg} ${colors.border} ${colors.text} transform rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-300 ease-out ${
        isVisible && !isRemoving ? 'translate-x-0 scale-100 opacity-100' : 'translate-x-full scale-95 opacity-0'
      } `}>
      <div className="flex items-start gap-3 p-3">
        <div className="mt-0.5 flex-shrink-0">{getIcon()}</div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight">{toast.title}</div>
          {toast.message && <div className="mt-1 text-xs leading-relaxed opacity-90">{toast.message}</div>}
        </div>

        <button
          onClick={handleRemove}
          className="ml-2 flex-shrink-0 text-lg leading-none text-white/70 transition-colors duration-200 hover:text-white"
          title="Dismiss">
          ×
        </button>
      </div>
    </div>
  );
};

export default Toast;
