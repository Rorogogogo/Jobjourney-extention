// Toast service wrapper
import { ToastManager } from '../toast-manager';

export class ToastService {
  static showToast(message: string, type: 'success' | 'error') {
    ToastManager.showToast(message, type);
  }
}
