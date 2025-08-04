import { Logger } from '../../utils/Logger';
import type { AuthService } from '../AuthService';
import type { ScrapingService } from '../ScrapingService';

export class TabManagerModule {
  private authService: AuthService;
  private scrapingService: ScrapingService;

  constructor(authService: AuthService, scrapingService: ScrapingService) {
    this.authService = authService;
    this.scrapingService = scrapingService;
  }

  async findJobJourneyTabs(): Promise<chrome.tabs.Tab[]> {
    try {
      const tabs = await chrome.tabs.query({});
      return tabs.filter(tab => {
        if (!tab.url) return false;

        const url = new URL(tab.url);
        const hostname = url.hostname.toLowerCase();

        return (
          hostname === 'jobjourney.me' ||
          hostname === 'www.jobjourney.me' ||
          (hostname === 'localhost' && url.port === '5001')
        );
      });
    } catch (error) {
      Logger.error('Failed to find JobJourney tabs', error);
      return [];
    }
  }

  async handleSignOutUser(
    sendResponse: (response: { success: boolean; message?: string; error?: string }) => void,
  ): Promise<void> {
    try {
      Logger.info('🔓 Sign out requested from extension UI');

      const jobJourneyTabs = await this.findJobJourneyTabs();

      if (jobJourneyTabs.length > 0) {
        Logger.info(`🔗 Sending sign-out command to ${jobJourneyTabs.length} JobJourney tab(s)`);

        let commandSent = false;
        for (const tab of jobJourneyTabs) {
          try {
            await chrome.tabs.update(tab.id!, { active: true });
            await chrome.windows.update(tab.windowId!, { focused: true });

            await chrome.tabs.sendMessage(tab.id!, {
              type: 'EXTENSION_SIGN_OUT_COMMAND',
            });
            Logger.success(`✅ Sign-out command sent to: ${tab.url}`);
            commandSent = true;
          } catch (error) {
            Logger.warning(`Failed to send sign-out command to tab ${tab.url}`, error);
          }
        }

        if (commandSent) {
          sendResponse({ success: true, message: 'Sign-out command sent to JobJourney tabs' });
        } else {
          Logger.warning('Failed to send sign-out command to any tabs, clearing auth locally');
          await this.authService.clearAuthData();
          sendResponse({ success: true, message: 'Signed out locally (tabs not responsive)' });
        }
      } else {
        Logger.info('📋 No JobJourney tabs found, opening one to send sign-out command');

        try {
          const jobMarketUrl = await this.authService.getJobMarketUrl();
          const tab = await chrome.tabs.create({
            url: jobMarketUrl,
            active: false,
          });

          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tab.id!, {
                type: 'EXTENSION_SIGN_OUT_COMMAND',
              });
              Logger.success(`✅ Sign-out command sent to newly opened tab`);

              setTimeout(() => {
                chrome.tabs.remove(tab.id!).catch(() => {});
              }, 2000);
            } catch (error) {
              Logger.warning('Failed to send sign-out command to newly opened tab, clearing auth locally', error);
              await this.authService.clearAuthData();

              chrome.tabs.remove(tab.id!).catch(() => {});
            }
          }, 3000);

          sendResponse({ success: true, message: 'Opened JobJourney tab to send sign-out command' });
        } catch (error) {
          Logger.error('Failed to open JobJourney tab for sign-out', error);
          await this.authService.clearAuthData();
          sendResponse({ success: true, message: 'Signed out locally (could not open JobJourney tab)' });
        }
      }
    } catch (error) {
      Logger.error('Failed to handle sign out', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleMakeTabActive(
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: { success: boolean; message?: string; error?: string }) => void,
  ): Promise<void> {
    try {
      Logger.info(`🔍 Making tab active (simple activation only)`);

      if (sender.tab?.id) {
        const tabId = sender.tab.id;

        try {
          if (sender.tab.windowId) {
            await chrome.windows.update(sender.tab.windowId, { focused: true });
          }
          await chrome.tabs.update(tabId, { active: true });
          Logger.success(`✅ Tab ${tabId} activated`);
          sendResponse({ success: true, message: 'Tab activated successfully' });
          return;
        } catch (activationError) {
          Logger.warning('Tab activation failed:', activationError);
        }

        try {
          const tabs = await chrome.tabs.query({
            url: ['*://www.linkedin.com/*', '*://www.indeed.com/*', '*://www.seek.com.au/*', '*://www.seek.co.nz/*'],
          });
          const targetTab = tabs.find(tab => tab.id === tabId);

          if (targetTab && targetTab.windowId) {
            await chrome.windows.update(targetTab.windowId, { focused: true });
            await chrome.tabs.update(tabId, { active: true });
            Logger.success(`✅ Tab ${tabId} activated via fallback`);
            sendResponse({ success: true, message: 'Tab activated via fallback' });
            return;
          }
        } catch (queryError) {
          Logger.warning('Fallback method failed:', queryError);
        }

        sendResponse({ success: false, error: 'All activation methods failed' });
      } else {
        Logger.warning('Sender tab ID not available');
        sendResponse({ success: false, error: 'Tab ID not available' });
      }
    } catch (error) {
      Logger.error('Failed to make tab active', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleShowJobsInJobJourney(
    data: { sessionId: string },
    sendResponse: (response: { success: boolean; message?: string; error?: string }) => void,
  ): Promise<void> {
    try {
      const { sessionId } = data;
      Logger.info(`📋 Handling show jobs in JobJourney for session: ${sessionId}`);

      const session = this.scrapingService.getSession(sessionId);

      const activeSessions = this.scrapingService.getActiveSessions();
      const completedSessions = this.scrapingService.getCompletedSessions();
      Logger.info(
        `📊 Debug - Active sessions: ${activeSessions.length}, Completed sessions: ${completedSessions.length}`,
      );
      Logger.info(`📊 Debug - Session found: ${!!session}`);
      if (session) {
        Logger.info(`📊 Debug - Session status: ${session.status}, Jobs count: ${session.jobs?.length || 0}`);
      } else {
        Logger.info(`📊 Debug - Active session IDs: ${activeSessions.map(s => s.id).join(', ')}`);
        Logger.info(`📊 Debug - Completed session IDs: ${completedSessions.map(s => s.id).join(', ')}`);
        Logger.info(`📊 Debug - Looking for session ID: ${sessionId}`);
      }

      if (!session || !session.jobs || session.jobs.length === 0) {
        Logger.warning('No jobs found for session:', sessionId);
        sendResponse({ success: false, error: 'No jobs found' });
        return;
      }

      await this.scrapingService.sendJobsToFrontend(session);

      sendResponse({ success: true, message: 'Jobs sent to JobJourney' });
    } catch (error) {
      Logger.error('Failed to show jobs in JobJourney', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleOpenSidePanel(
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: { success: boolean; error?: string }) => void,
  ): Promise<void> {
    try {
      if (sender.tab?.id) {
        Logger.info(`📱 Opening side panel for tab: ${sender.tab.id}`);
        await chrome.sidePanel.open({ tabId: sender.tab.id });
        sendResponse({ success: true });
      } else {
        Logger.warning('Cannot open side panel: no tab ID available');
        sendResponse({ success: false, error: 'No tab ID available' });
      }
    } catch (error) {
      Logger.error('Failed to open side panel', error);
      sendResponse({ success: false, error: error.message });
    }
  }
}
