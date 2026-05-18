import { Logger } from '@extension/shared';
import { MessageType } from '@extension/types';
import type { ChromeMessage, EventData } from '@extension/types';

export class ToastModule {
  private lastToastTime = 0;
  private lastToastType = '';
  private readonly TOAST_DEBOUNCE_MS = 2000;

  private broadcastToSidebars?: (message: ChromeMessage) => void;

  setBroadcastHandler(broadcastHandler: (message: ChromeMessage) => void) {
    this.broadcastToSidebars = broadcastHandler;
  }

  handleAuthStatusChange(data: EventData): void {
    Logger.info('Auth status changed', data);

    const isAuthenticated = data.isAuthenticated === true;
    const shouldShowToast = data.shouldShowToast !== false;
    const reason = typeof data.reason === 'string' ? data.reason : undefined;

    const now = Date.now();
    const toastType = isAuthenticated ? 'SIGN_IN' : reason === 'token_expired' ? 'TOKEN_EXPIRED' : 'SIGN_OUT';
    const timeSinceLastToast = now - this.lastToastTime;
    const isDuplicateToast = this.lastToastType === toastType && timeSinceLastToast < this.TOAST_DEBOUNCE_MS;

    if (shouldShowToast && !isDuplicateToast) {
      this.lastToastTime = now;
      this.lastToastType = toastType;

      this.broadcastToSidebars?.({
        type: MessageType.AUTH_STATUS_CHANGED,
        data: { ...data, shouldShowToast: true },
      });
    } else {
      this.broadcastToSidebars?.({
        type: MessageType.AUTH_STATUS_CHANGED,
        data: { ...data, shouldShowToast: false },
      });

      if (isDuplicateToast) {
        Logger.info(`🔇 Suppressing duplicate ${toastType} toast (${timeSinceLastToast}ms since last)`);
      } else {
        Logger.info('🔇 Silent auth sync - no toast requested');
      }
    }
  }

  shouldShowToast(toastType: string): boolean {
    const now = Date.now();
    const timeSinceLastToast = now - this.lastToastTime;
    const isDuplicateToast = this.lastToastType === toastType && timeSinceLastToast < this.TOAST_DEBOUNCE_MS;

    return !isDuplicateToast;
  }

  recordToast(toastType: string): void {
    this.lastToastTime = Date.now();
    this.lastToastType = toastType;
  }
}
