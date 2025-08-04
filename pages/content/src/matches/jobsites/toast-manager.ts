// Toast notification management
export class ToastManager {
  static showToast(message: string, type: 'success' | 'error') {
    // Remove existing toast
    const existingToast = document.getElementById('jobjourney-toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'jobjourney-toast';

    // Get JobJourney icon
    const iconUrl = chrome.runtime.getURL('icon-16.png');
    const icon =
      type === 'success'
        ? `<img src="${iconUrl}" width="16" height="16" style="flex-shrink: 0; margin-bottom: 0 !important; vertical-align: middle !important;" alt="JobJourney" />`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        ${icon}
        <span>${message}</span>
      </div>
    `;

    // Elegant styling
    const bgColor = type === 'success' ? '#000000' : '#dc2626';
    const borderColor = type === 'success' ? '#333333' : '#ef4444';

    toast.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: ${bgColor};
      color: white;
      border: 1px solid ${borderColor};
      border-radius: 12px;
      padding: 16px 20px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideInToast 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      max-width: 360px;
      word-wrap: break-word;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    `;

    // Add elegant animation
    ToastManager.addToastAnimation();

    document.body.appendChild(toast);

    // Remove toast after 4 seconds with elegant exit animation
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOutToast 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }
    }, 4000);
  }

  private static addToastAnimation() {
    // Only add styles once
    if (document.getElementById('jobjourney-toast-styles')) return;

    const style = document.createElement('style');
    style.id = 'jobjourney-toast-styles';
    style.textContent = `
      @keyframes slideInToast {
        from {
          transform: translateX(100%) scale(0.9);
          opacity: 0;
        }
        to {
          transform: translateX(0) scale(1);
          opacity: 1;
        }
      }
      @keyframes slideOutToast {
        from {
          transform: translateX(0) scale(1);
          opacity: 1;
        }
        to {
          transform: translateX(100%) scale(0.9);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
}