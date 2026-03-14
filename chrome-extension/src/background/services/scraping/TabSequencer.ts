import { Logger } from '@extension/shared';

type TimeoutHandle = ReturnType<typeof setTimeout>;
type IntervalHandle = ReturnType<typeof setInterval>;

export class TabSequencer {
  private sessionTabs = new Map<string, number[]>();
  private sessionTimeouts = new Map<string, TimeoutHandle[]>();
  private tabActivationInterval: IntervalHandle | null = null;

  trackTab(sessionId: string, tabId: number): void {
    const sessionTabs = this.sessionTabs.get(sessionId) || [];
    sessionTabs.push(tabId);
    this.sessionTabs.set(sessionId, sessionTabs);
  }

  getSessionTabs(sessionId: string): number[] {
    return this.sessionTabs.get(sessionId) || [];
  }

  removeTab(sessionId: string, tabId: number): number[] {
    const updatedTabs = this.getSessionTabs(sessionId).filter(currentTabId => currentTabId !== tabId);
    this.sessionTabs.set(sessionId, updatedTabs);
    return updatedTabs;
  }

  clearSession(sessionId: string): void {
    this.sessionTabs.delete(sessionId);
    this.clearSessionTimeouts(sessionId);
  }

  trackTimeout(sessionId: string, timeout: TimeoutHandle): void {
    const timeouts = this.sessionTimeouts.get(sessionId) || [];
    timeouts.push(timeout);
    this.sessionTimeouts.set(sessionId, timeouts);
  }

  clearSessionTimeouts(sessionId: string): void {
    const timeouts = this.sessionTimeouts.get(sessionId);
    if (!timeouts) {
      return;
    }

    timeouts.forEach(timeout => clearTimeout(timeout));
    this.sessionTimeouts.delete(sessionId);
    Logger.info(`🧹 Cleared ${timeouts.length} timeouts for session ${sessionId}`);
  }

  startSequentialTabActivation(sessionId: string): void {
    this.stopSequentialTabActivation();

    let currentTabIndex = 0;

    this.tabActivationInterval = setInterval(async () => {
      try {
        const sessionTabs = this.getSessionTabs(sessionId);
        if (sessionTabs.length === 0) {
          return;
        }

        const tabId = sessionTabs[currentTabIndex];

        try {
          const tab = await chrome.tabs.get(tabId);
          if (tab.windowId) {
            await chrome.windows.update(tab.windowId, { focused: true });
          }

          Logger.info(
            `🎯 Focused window ${tab.windowId} for tab ${tabId} (${currentTabIndex + 1}/${sessionTabs.length})`,
          );
        } catch {
          Logger.warning(`Tab ${tabId} no longer exists, removing from activation list`);
          const updatedTabs = this.removeTab(sessionId, tabId);
          if (currentTabIndex >= updatedTabs.length) {
            currentTabIndex = 0;
          }
          return;
        }

        currentTabIndex = (currentTabIndex + 1) % sessionTabs.length;
      } catch (error) {
        Logger.error('Error in sequential tab activation:', error);
      }
    }, 3000);

    Logger.info(`🔄 Started sequential tab activation for session ${sessionId}`);
  }

  stopSequentialTabActivation(): void {
    if (this.tabActivationInterval !== null) {
      clearInterval(this.tabActivationInterval);
      this.tabActivationInterval = null;
      Logger.info(`⏹️ Stopped sequential tab activation`);
    }
  }
}
