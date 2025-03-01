/**
 * Side Panel Service
 * Handles functionality specific to the Chrome Side Panel implementation
 */

class SidePanelService {
  /**
   * Initialize the side panel service
   */
  initialize () {
    console.log('Initializing Side Panel Service')
    this.setupMessageListeners()
  }

  /**
   * Set up message listeners for side panel communication
   */
  setupMessageListeners () {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'sidePanelLoaded') {
        console.log('Side panel loaded')
        sendResponse({ success: true })
      }
    })
  }

  /**
   * Open the side panel for a specific tab
   * @param {number} tabId - The ID of the tab to open the side panel for
   */
  openSidePanel (tabId) {
    if (!tabId) {
      console.error('Cannot open side panel: No tab ID provided')
      return
    }

    chrome.sidePanel.open({ tabId }).catch(error => {
      console.error('Error opening side panel:', error)
    })
  }
}

export default new SidePanelService() 