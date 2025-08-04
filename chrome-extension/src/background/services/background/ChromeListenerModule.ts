import { Logger } from '../../utils/Logger';
import type { ChromeMessage } from '../../types';

export class ChromeListenerModule {
  private onActionClick?: (tab: chrome.tabs.Tab) => Promise<void>;
  private onTabUpdate?: (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void;
  private onMessage?: (
    message: ChromeMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ) => Promise<void>;
  private onAlarm?: (alarm: chrome.alarms.Alarm) => void;
  private onInstall?: (details: chrome.runtime.InstalledDetails) => Promise<void>;
  private onInitialize?: () => Promise<void>;

  setHandlers(handlers: {
    onActionClick: (tab: chrome.tabs.Tab) => Promise<void>;
    onTabUpdate: (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void;
    onMessage: (
      message: ChromeMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void,
    ) => Promise<void>;
    onAlarm: (alarm: chrome.alarms.Alarm) => void;
    onInstall: (details: chrome.runtime.InstalledDetails) => Promise<void>;
    onInitialize: () => Promise<void>;
  }) {
    this.onActionClick = handlers.onActionClick;
    this.onTabUpdate = handlers.onTabUpdate;
    this.onMessage = handlers.onMessage;
    this.onAlarm = handlers.onAlarm;
    this.onInstall = handlers.onInstall;
    this.onInitialize = handlers.onInitialize;
  }

  setupChromeListeners(): void {
    chrome.action.onClicked.addListener(this.handleActionClick.bind(this));
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));

    chrome.runtime.onStartup.addListener(() => {
      Logger.info('🔄 Extension startup detected');
      this.onInitialize?.();
    });

    chrome.runtime.onInstalled.addListener(details => {
      Logger.info(`📦 Extension ${details.reason}`, { version: chrome.runtime.getManifest().version });
      this.handleInstall(details);
    });

    if (chrome.alarms?.onAlarm) {
      chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
    }

    chrome.runtime.onMessage.addListener((message: ChromeMessage, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  private async handleActionClick(tab: chrome.tabs.Tab): Promise<void> {
    try {
      if (tab.id) {
        await chrome.sidePanel.open({ tabId: tab.id });
      }
    } catch (error) {
      Logger.error('Failed to open side panel', error);
    }
  }

  private handleTabUpdate(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): void {
    if (this.onTabUpdate) {
      this.onTabUpdate(tabId, changeInfo, tab);
    }
  }

  private async handleMessage(
    message: ChromeMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ): Promise<void> {
    if (this.onMessage) {
      await this.onMessage(message, sender, sendResponse);
    }
  }

  private handleAlarm(alarm: chrome.alarms.Alarm): void {
    if (this.onAlarm) {
      this.onAlarm(alarm);
    }
  }

  private async handleInstall(details: chrome.runtime.InstalledDetails): Promise<void> {
    if (this.onInstall) {
      await this.onInstall(details);
    }
  }
}
