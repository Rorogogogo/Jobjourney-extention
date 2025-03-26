import messagingService, { MessageType } from '../src/services/messagingService.js'
// import { startScraping } from './scraping.js'
import { findOrCreateJobJourneyTab, sendVersionCheckMessage } from './versionCheck.js'
import { isPanelOpen, safelySendThroughPort, activePanelPort } from './panelState.js'
import tabService from '../src/services/tabService.js'



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
    try {
      // Use tabService to find or create a JobJourney tab
      tabService.ensureJobJourneyWebsite(true)
        .then(tab => {
          console.log(`Using JobJourney tab with ID: ${tab.id}`)

          // Give the page a moment to initialize if it's a new tab
          setTimeout(() => {
            // Send the jobs directly to the tab
            chrome.tabs.sendMessage(tab.id, {
              action: 'JOBS_SCRAPED',
              data: {
                jobs: data.jobs,
                source: 'extension',
                timestamp: Date.now()
              }
            }).then(() => {
              console.log(`Jobs data sent to tab ${tab.id}`)
            }).catch(err => {
              console.error('Error sending jobs to tab:', err)
            })
          }, 500)

          return tab
        })
        .catch(err => {
          console.error('Error with JobJourney tab:', err)
        })

      return {
        success: true,
        message: `Showing ${data.jobs.length} jobs in JobJourney`
      }
    } catch (error) {
      console.error('Error processing show in JobJourney request:', error)
      return { success: false, message: error.message }
    }
  } else {
    console.warn('Show in JobJourney request received with no jobs')
    return { success: false, message: 'No jobs provided' }
  }
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
  console.log("Handling version check from panel, version:", currentVersion)

  // Store the request information to match with response later
  const requestId = Date.now().toString()
  const versionCheckRequest = {
    requestId: requestId,
    port: port,
    tabId: null,
    timeoutId: null
  }

  // Set a timeout for the version check
  versionCheckRequest.timeoutId = setTimeout(() => {
    console.log("Version check timed out after 10 seconds")

    // Send timeout response through the port
    safelySendThroughPort(port, {
      action: "VERSION_STATUS_UPDATE",
      data: {
        isCompatible: true, // Default to compatible on timeout
        message: "Version check timed out, assuming compatible",
        requestId: requestId
      }
    })

    // Remove the request from tracking
    delete activeVersionChecks[requestId]
  }, 10000)

  // Find or create a JobJourney tab
  findOrCreateJobJourneyTab(currentVersion)
    .then(tab => {
      if (!tab) {
        throw new Error("Could not create JobJourney tab")
      }

      console.log("Found/created JobJourney tab:", tab.id)

      // Store the tab ID with the request
      versionCheckRequest.tabId = tab.id
      activeVersionChecks[requestId] = versionCheckRequest

      // Send message to content script with request ID
      return sendVersionCheckMessage(tab, currentVersion, requestId)
    })
    .then(result => {
      console.log("Version check message sent, result:", result)

      // If tab was refreshed, give it time to load and try again
      if (result.refreshed) {
        console.log("Tab was refreshed, waiting for content scripts to initialize...")

        // Wait for tab to fully load
        setTimeout(() => {
          chrome.tabs.get(versionCheckRequest.tabId, (tab) => {
            if (chrome.runtime.lastError) {
              console.error("Error getting tab after refresh:", chrome.runtime.lastError)
              return
            }

            console.log("Attempting version check again after refresh")
            sendVersionCheckMessage(tab, currentVersion, requestId)
              .catch(error => {
                console.error("Error in second version check attempt:", error)
              })
          })
        }, 2000) // Wait 2 seconds for content scripts to initialize
      }
      // We'll wait for the response via the port message handler
    })
    .catch(err => {
      console.error("Error in version check process:", err)

      // Clear the timeout
      if (versionCheckRequest.timeoutId) {
        clearTimeout(versionCheckRequest.timeoutId)
      }

      // Send error response through the port
      safelySendThroughPort(port, {
        action: "VERSION_STATUS_UPDATE",
        data: {
          isCompatible: true, // Default to compatible on error
          message: "Error checking version, assuming compatible",
          requestId: requestId
        }
      })

      // Remove the request from tracking
      delete activeVersionChecks[requestId]
    })
}



// Track active version check requests
const activeVersionChecks = {}

// Handle version check response received from content script
export function handleVersionCheckResponseFromContentScript (message, sender) {
  console.log('Background received VERSION_CHECK_RESPONSE from content script:', message.data)

  // Find the matching request by tab ID
  const requestId = message.data.requestId
  const matchingRequest = requestId ?
    activeVersionChecks[requestId] :
    Object.values(activeVersionChecks).find(req => req.tabId === sender.tab.id)

  if (matchingRequest) {
    console.log("Found matching version check request:", matchingRequest.requestId)

    // Clear the timeout
    if (matchingRequest.timeoutId) {
      clearTimeout(matchingRequest.timeoutId)
    }

    // Store compatibility information
    if (message.data && message.data.isCompatible === false) {
      storeIncompatibilityInfo(message.data)
    } else if (message.data && message.data.isCompatible === true) {
      clearIncompatibilityInfo()
    }

    // Forward response through the port
    safelySendThroughPort(matchingRequest.port, {
      action: "VERSION_STATUS_UPDATE",
      data: message.data
    })

    // Remove the request from tracking
    delete activeVersionChecks[matchingRequest.requestId]

    return true
  } else {
    console.warn("Received version check response but couldn't find matching request")
    return false
  }
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


// Handle LOG_PANEL_STATE message
export function handleLogPanelState (message, sendResponse) {
  const isPanelActive = message.data?.isPanelActive === true
  const logMethod = isPanelActive ? console.log : console.warn

  logMethod(`Panel state updated: ${isPanelActive ? 'Active ✅' : 'Inactive ❌'}`)
  sendResponse({ received: true })
}

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

// Handle trigger download extension
export function handleTriggerDownloadExtension () {
  console.log('Handling trigger download extension')

  // Get active port if available


  // If no port, try to send via content script
  findOrCreateJobJourneyTab()
    .then(tab => {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'DOWNLOAD_EXTENSION',
          data: {
            success: true,
            message: 'Please download the extension'
          }
        })
      }
    })
    .catch(err => {
      console.error('Error sending download extension message:', err)
    })

  return { success: true, message: 'Download extension triggered' }
}

// Register message handlers
export function registerMessageHandlers () {
  messagingService.registerHandler(MessageType.VERSION_CHECK, handleVersionCheck)
  messagingService.registerHandler(MessageType.SIDE_PANEL_LOADED, handleSidePanelLoaded)
  messagingService.registerHandler(MessageType.SHOW_IN_JOBJOURNEY, handleShowInJobJourney)
  messagingService.registerHandler('CHECK_PANEL_STATE', data => {
    return {
      isPanelActive: isPanelOpen(),
      timestamp: Date.now()
    }
  })
  messagingService.registerHandler(MessageType.DOWNLOAD_EXTENSION, handleTriggerDownloadExtension)
}

// Setup runtime message listeners
export function setupRuntimeMessageListeners () {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.action)

    try {
      // Handle version check response from content script
      if (message.action === 'VERSION_CHECK_RESPONSE') {
        const handled = handleVersionCheckResponseFromContentScript(message, sender)
        sendResponse({ received: true, handled: handled })
        return true
      }


    } catch (error) {
      console.error('Error handling runtime message:', error)
      sendResponse({ error: error.message })
    }

    return true // Keep the message channel open for async response
  })
} 