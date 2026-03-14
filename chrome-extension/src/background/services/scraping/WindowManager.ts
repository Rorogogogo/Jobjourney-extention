import { Logger } from '@extension/shared';

export class WindowManager {
  private sessionWindows = new Map<string, number[]>();

  trackWindow(sessionId: string, windowId: number): void {
    const sessionWindows = this.sessionWindows.get(sessionId) || [];
    sessionWindows.push(windowId);
    this.sessionWindows.set(sessionId, sessionWindows);
  }

  untrackWindow(sessionId: string, windowId: number): void {
    const sessionWindows = this.sessionWindows.get(sessionId) || [];
    this.sessionWindows.set(
      sessionId,
      sessionWindows.filter(id => id !== windowId),
    );
  }

  async closeSessionWindows(sessionId: string): Promise<void> {
    const windowIds = this.sessionWindows.get(sessionId);
    if (!windowIds || windowIds.length === 0) {
      return;
    }

    Logger.info(`🗑️ Closing ${windowIds.length} scraper windows for session ${sessionId}`);

    for (const windowId of windowIds) {
      try {
        const tabs = await chrome.tabs.query({ windowId });
        for (const tab of tabs) {
          if (tab.id) {
            try {
              await chrome.tabs.setZoom(tab.id, 1.0);
              Logger.info(`🔍 Reset zoom to 100% for tab ${tab.id}`);
            } catch (zoomError) {
              const message = zoomError instanceof Error ? zoomError.message : String(zoomError);
              Logger.warning(`Failed to reset zoom for tab ${tab.id}:`, message);
            }
          }
        }

        await chrome.windows.remove(windowId);
        Logger.info(`✅ Closed scraper window ${windowId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Logger.warning(`Could not close window ${windowId}:`, message);
      }
    }

    this.sessionWindows.delete(sessionId);
  }

  clearSession(sessionId: string): void {
    this.sessionWindows.delete(sessionId);
  }
}
