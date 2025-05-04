import messagingService, { MessageType } from '../src/services/messagingService.js'
import {
  registerMessageHandlers,
  setupRuntimeMessageListeners
} from './messageHandlers.js'
import { setupPortConnectionListeners } from './portConnection.js'
import { setupActionClickHandler } from './actionHandlers.js'
// import { initialize } from './initialization.js'

console.log('Background script starting...')

// Set to keep track of tabs actively being scraped
const activeScrapingTabs = new Set()

// ============================
// ERROR HANDLING
// ============================

// Global error handler for uncaught promise rejections
self.addEventListener('unhandledrejection', function (event) {
  console.warn('Unhandled promise rejection:', event.reason)

  if (event.reason && event.reason.message &&
    event.reason.message.includes("Receiving end does not exist")) {
    console.log("Suppressing known connection error")
    event.preventDefault()
  }
})

// ============================
// INITIALIZATION
// ============================

// Initialize components
async function initialize () {
  try {
    // Initialize messaging service
    messagingService.initialize({ debug: true })

    // Register message handlers
    registerMessageHandlers()

    // Setup runtime message listeners
    setupRuntimeMessageListeners()

    // Initialize side panel
    // await initializeSidePanel()

    // Setup port connection listeners
    setupPortConnectionListeners()

    // Setup extension icon click handler
    setupActionClickHandler()

    // Listen for updates to scraping state from scraperService
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'SCRAPING_STATE_UPDATE') {
        const { tabId, isActive } = message.data
        if (isActive) {
          console.log(`Background: Marking tab ${tabId} as actively scraping.`)
          activeScrapingTabs.add(tabId)
        } else {
          console.log(`Background: Unmarking tab ${tabId} as actively scraping.`)
          activeScrapingTabs.delete(tabId)
        }
        // Optional: Send confirmation back if needed
        // sendResponse({ success: true }); 
      }
      // Important: Return true if you might use sendResponse asynchronously elsewhere
      // or false/undefined if not handling this message type here.
      // Since other listeners might handle other actions, let's return undefined for now.
      return undefined
    })

    // Listen for tab updates to re-apply overlay if necessary
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      // Check if the tab finished loading and is marked as actively scraping
      if (changeInfo.status === 'complete' && activeScrapingTabs.has(tabId)) {
        console.log(`Background: Tab ${tabId} finished loading and is actively scraping. Re-sending showScrapeOverlay.`)
        try {
          // Re-send the message to ensure the overlay is visible after navigation
          await chrome.tabs.sendMessage(tabId, { action: 'showScrapeOverlay' })
        } catch (error) {
          console.warn(`Background: Failed to re-send showScrapeOverlay to tab ${tabId} (it might have been closed):`, error.message)
          // If we can't message the tab, it's likely closed, so stop tracking it
          activeScrapingTabs.delete(tabId)
        }
      }
    })

    console.log('Background script initialization complete')
  } catch (error) {
    console.error('Error initializing background script:', error)
  }
}

// Start initialization
initialize() 