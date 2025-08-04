import { Logger } from '../../utils/Logger';
import type { AuthService } from '../AuthService';
import type { StorageService } from '../StorageService';

export class UtilityModule {
  private storageService: StorageService;
  private authService: AuthService;

  constructor(storageService: StorageService, authService: AuthService) {
    this.storageService = storageService;
    this.authService = authService;
  }

  async handleInstall(details: chrome.runtime.InstalledDetails): Promise<void> {
    if (details.reason === 'install') {
      Logger.info('🎉 Welcome to JobJourney Assistant!');
      await this.storageService.setDefaults();
    } else if (details.reason === 'update') {
      Logger.info(`🆙 Updated to version ${chrome.runtime.getManifest().version}`);
      await this.handleVersionMigration(details.previousVersion);
    }
  }

  handleAlarm(alarm: chrome.alarms.Alarm): void {
    Logger.info(`⏰ Alarm triggered: ${alarm.name}`);

    switch (alarm.name) {
      case 'token_refresh':
        this.authService.refreshToken();
        break;
      case 'cleanup':
        this.performCleanup();
        break;
      default:
        Logger.warn(`Unknown alarm: ${alarm.name}`);
    }
  }

  broadcastToSidebars(message: { type: string; data?: unknown }): void {
    Logger.info(`📢 Broadcasting message to sidebars: ${message.type}`, message.data);
    try {
      chrome.runtime.sendMessage(message).catch(() => {
        // Ignore errors if no listeners
      });
    } catch {
      // Ignore context errors
    }

    if (message.type === 'SCRAPING_COMPLETE' || message.type === 'SCRAPING_ERROR') {
      chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, message).catch(() => {
              // Ignore errors for tabs that don't have the content script
            });
          }
        });
      });
    }
  }

  private async handleVersionMigration(previousVersion?: string): Promise<void> {
    if (previousVersion) {
      Logger.info(`Migrating from version ${previousVersion}`);
      // Add migration logic here
    }
  }

  private performCleanup(): void {
    Logger.info('Performing periodic cleanup');
    // General cleanup logic can be added here
  }
}
