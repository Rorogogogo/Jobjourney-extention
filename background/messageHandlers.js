import messagingService, { MessageType } from '../src/services/messagingService.js'
import scraperService from '../src/services/scraperService.js'
import { startScraping } from './scraping.js'
import { findOrCreateJobJourneyTab, executeVersionCheck } from './versionCheck.js'
import { isPanelOpen, safelySendThroughPort, activePanelPort } from './panelState.js'

// ============================
// MESSAGE HANDLERS
// ============================

// Handle start scraping request
export function handleStartScraping (data) {
  console.log('Start scraping request received:', data)

  return new Promise(resolve => {
    console.log('Forwarding scraping request to panel...')

    // Directly use scraperService instead of forwarding to panel
    // This allows us to handle scraping in the background script
    try {
      // Start scraping using the scraperService
      const { jobTitle, city, country, platforms } = data

      // Return initial status immediately
      const initialResponse = {
        success: true,
        status: 'processing',
        message: 'Scraping request started',
        detail: `Starting search for ${jobTitle} in ${city}, ${country}`,
        progress: 0,
        platforms: platforms
      }

      // Resolve with initial status
      resolve(initialResponse)

      // Then start the actual scraping process asynchronously
      startScraping(data)
    } catch (err) {
      console.error('Error starting scraping process:', err)
      // Still return a success status as we've received the request
      resolve({
        success: true,
        status: 'error',
        message: 'Error starting scraping',
        detail: err.message || 'Unknown error',
        progress: 0,
        platforms: data.platforms
      })
    }
  })
}

// Handle version check request
export function handleVersionCheck (data) {
  console.log('Received version check request from website')
  return {
    success: true,
    version: chrome.runtime.getManifest().version
  }
}

// Handle side panel loaded notification
export function handleSidePanelLoaded () {
  console.log('Side panel loaded')
  return { success: true, message: 'Side panel load acknowledged' }
}


// Handle show in JobJourney request
export function handleShowInJobJourney (data) {
  console.log('Show in JobJourney request received:', data)

  if (data && data.jobs) {
    const jobsParam = encodeURIComponent(JSON.stringify(data.jobs))
    const url = `http://localhost:5001/market?jobs=${jobsParam}`

    chrome.tabs.create({ url })
      .catch(err => console.error('Error opening JobJourney:', err))
  }

  return { success: true }
}

// Handle scraping from panel
export function handleScrapingFromPanel (message, port) {
  handleStartScraping(message.data)
    .then(result => {
      console.log("Scraping started successfully, result:", result)
      safelySendThroughPort(port, {
        action: "SCRAPING_STARTED",
        data: result
      })
    })
    .catch(error => {
      console.error("Error starting scraping:", error)
      safelySendThroughPort(port, {
        action: "SCRAPING_ERROR",
        data: {
          success: false,
          error: error.message || "Unknown error starting scraping"
        }
      })
    })
}

// Handle version check from panel
export function handleVersionCheckFromPanel (message, port) {
  const currentVersion = message.data.version

  // Find or create a JobJourney tab
  findOrCreateJobJourneyTab(currentVersion)
    .then(tab => {
      if (!tab) {
        throw new Error("Could not create JobJourney tab")
      }

      // Execute script to check version
      return executeVersionCheck(tab, currentVersion)
    })
    .catch(err => {
      console.error("Error in version check process:", err)
      safelySendThroughPort(port, {
        action: "VERSION_STATUS_UPDATE",
        data: {
          isCompatible: true, // Default to compatible on error
          message: "Error checking version, assuming compatible"
        }
      })
    })
}

// Handle version check response
export function handleVersionCheckResponse (message, sendResponse) {
  console.log('Background received VERSION_CHECK_RESPONSE:', message.data)

  // Store compatibility information
  if (message.data && message.data.isCompatible === false) {
    storeIncompatibilityInfo(message.data)
  } else if (message.data && message.data.isCompatible === true) {
    clearIncompatibilityInfo()
  }

  // Broadcast to all extension pages
  chrome.runtime.sendMessage({
    action: 'VERSION_STATUS_UPDATE',
    data: message.data
  })

  // Send to active panel port if available
  const currentPort = activePanelPort()
  if (currentPort) {
    console.log('Sending VERSION_STATUS_UPDATE through active panel port')
    safelySendThroughPort(currentPort, {
      action: 'VERSION_STATUS_UPDATE',
      data: message.data
    })
  } else {
    console.log('No active panel port available for VERSION_STATUS_UPDATE')
  }

  sendResponse({ received: true, status: 'processed' })
}

// Store incompatibility information
export function storeIncompatibilityInfo (data) {
  chrome.storage.local.set({
    'extensionCompatible': false,
    'compatibilityMessage': data.message,
    'minimumVersion': data.minimumVersion,
    'latestVersion': data.latestVersion
  }, () => {
    console.log('Stored incompatibility information:', data)
  })
}

// Clear incompatibility information
export function clearIncompatibilityInfo () {
  chrome.storage.local.remove([
    'extensionCompatible',
    'compatibilityMessage',
    'minimumVersion',
    'latestVersion'
  ], () => {
    console.log('Cleared previous incompatibility information')
  })
}

// Handle START_SCRAPING message
export function handleStartScrapingMessage (message, sendResponse) {
  console.log('START_SCRAPING runtime message received:', message.data)

  handleStartScraping(message.data)
    .then(result => {
      console.log('Scraping handler result:', result)
      sendResponse({
        success: result.success,
        data: result,
        sendToWebsite: true
      })
    })
    .catch(err => {
      console.error('Error in scraping handler:', err)
      sendResponse({
        success: false,
        error: err.message || 'Unknown error in scraping handler',
        sendToWebsite: true
      })
    })
}

// Handle LOG_PANEL_STATE message
export function handleLogPanelState (message, sendResponse) {
  const isPanelActive = message.data?.isPanelActive === true
  const logMethod = isPanelActive ? console.log : console.warn

  logMethod(`Panel state updated: ${isPanelActive ? 'Active ✅' : 'Inactive ❌'}`)
  sendResponse({ received: true })
}

// Handle RESET_PANEL_STATE message
// export function handleResetPanelState (message, sendResponse) {
//   console.log('Received request to reset panel state')

//   try {
//     // Reset the panel state
//     sidePanelService.resetPanelState()
//       .then(() => {
//         console.log('Panel state reset completed')
//         sendResponse({
//           success: true,
//           message: 'Panel state has been reset'
//         })
//       })
//       .catch(err => {
//         console.error('Error resetting panel state:', err)
//         sendResponse({
//           success: false,
//           error: err.message || 'Unknown error resetting panel state'
//         })
//       })
//   } catch (err) {
//     console.error('Exception in RESET_PANEL_STATE handler:', err)
//     sendResponse({
//       success: false,
//       error: err.message || 'Unknown error in reset handler'
//     })
//   }
// }

// Handle CHECK_PANEL_STATE message
export function handleCheckPanelState (message, sendResponse) {
  if (message.debug) {
    console.log('Received CHECK_PANEL_STATE request')
  }

  sendResponse({
    isPanelActive: isPanelOpen(),
    timestamp: Date.now()
  })
}

// Register message handlers
export function registerMessageHandlers () {
  messagingService.registerHandler(MessageType.VERSION_CHECK, handleVersionCheck)
  messagingService.registerHandler(MessageType.SIDE_PANEL_LOADED, handleSidePanelLoaded)
  messagingService.registerHandler(MessageType.SHOW_IN_JOBJOURNEY, handleShowInJobJourney)
  messagingService.registerHandler(MessageType.START_SCRAPING, handleStartScraping)
  messagingService.registerHandler('CHECK_PANEL_STATE', data => {
    return {
      isPanelActive: isPanelOpen(),
      timestamp: Date.now()
    }
  })
}

// Setup runtime message listeners
export function setupRuntimeMessageListeners () {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Runtime message received in background:', message, 'from', sender.tab?.url || 'unknown')

    // Handle VERSION_CHECK_RESPONSE from content script
    if (message.action === 'VERSION_CHECK_RESPONSE') {
      handleVersionCheckResponse(message, sendResponse)
      return false // Synchronous response
    }
    // Handle START_SCRAPING message
    else if (message.action === 'START_SCRAPING') {
      handleStartScrapingMessage(message, sendResponse)
      return true // Async response
    }
    // Handle WEBSITE_CONNECTED message
    else if (message.action === 'WEBSITE_CONNECTED') {
      console.log('Website connected at URL:', message.url)
      sendResponse({ success: true })
      return false
    }
    // Handle LOG_PANEL_STATE message
    else if (message.action === 'LOG_PANEL_STATE') {
      handleLogPanelState(message, sendResponse)
      return false
    }
    // Handle RESET_PANEL_STATE message
    else if (message.action === 'RESET_PANEL_STATE') {
      handleResetPanelState(message, sendResponse)
      return true // Async response
    }
    // Handle CHECK_PANEL_STATE message
    else if (message.action === 'CHECK_PANEL_STATE') {
      handleCheckPanelState(message, sendResponse)
      return false
    }

    return false
  })
} 