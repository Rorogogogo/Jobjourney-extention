import sidePanelService from './src/services/sidePanelService.js'
import messagingService, { MessageType } from './src/services/messagingService.js'
import scraperService from './src/services/scraperService.js'

console.log('Background script starting...')

// ============================
// STATE VARIABLES
// ============================
let panelOpen = false
let activePanelPort = null
let portConnected = false

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
// MESSAGE HANDLERS
// ============================

// Handle start scraping request
function handleStartScraping (data) {
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

// Function to start the actual scraping process
async function startScraping (data) {
  const { jobTitle, city, country, platforms } = data

  try {
    console.log(`Starting scraping for ${jobTitle} in ${city}, ${country} on platforms:`, platforms)

    // Track progress
    let currentProgress = 0
    const totalSteps = platforms.length

    // Collect all jobs
    const allJobs = []

    // Progress update callback
    const progressCallback = (progress, platformName, status) => {
      const message = {
        action: 'SCRAPING_PROGRESS',
        data: {
          platform: platformName,
          progress: progress,
          status: status,
          overallProgress: Math.round((currentProgress + progress / 100) / totalSteps * 100)
        }
      }

      // Broadcast progress to all extension pages
      chrome.runtime.sendMessage(message)

      // Also send through port if available
      if (activePanelPort) {
        safelySendThroughPort(activePanelPort, message)
      }
    }

    // Process each platform
    for (const platform of platforms) {
      try {
        // Update progress
        progressCallback(0, platform, 'starting')

        // Scrape jobs from this platform
        const jobs = await scraperService.scrapeFromPlatform(platform, jobTitle, city, country,
          (progress, status) => progressCallback(progress, platform, status))

        console.log(`Found ${jobs.length} jobs from ${platform}`)
        allJobs.push(...jobs)

        // Update progress
        currentProgress += 1
        progressCallback(100, platform, 'completed')
      } catch (err) {
        console.error(`Error scraping from ${platform}:`, err)
        currentProgress += 1
        progressCallback(100, platform, 'error')
      }
    }

    // All done - send final result
    const finalResult = {
      action: 'SCRAPING_COMPLETED',
      data: {
        success: true,
        jobs: allJobs,
        count: allJobs.length,
        platforms: platforms,
        query: {
          jobTitle,
          city,
          country
        }
      }
    }

    // Broadcast to all extension pages
    chrome.runtime.sendMessage(finalResult)

    // Also send through port if available
    if (activePanelPort) {
      safelySendThroughPort(activePanelPort, finalResult)
    }

    console.log('Scraping completed successfully')
  } catch (err) {
    console.error('Error in scraping process:', err)

    // Send error status
    const errorMessage = {
      action: 'SCRAPING_ERROR',
      data: {
        success: false,
        error: err.message || 'Unknown error in scraping process',
        platforms: platforms
      }
    }

    // Broadcast to all extension pages
    chrome.runtime.sendMessage(errorMessage)

    // Also send through port if available
    if (activePanelPort) {
      safelySendThroughPort(activePanelPort, errorMessage)
    }
  }
}

// Handle version check request
function handleVersionCheck (data) {
  console.log('Received version check request from website')
  return {
    success: true,
    version: chrome.runtime.getManifest().version
  }
}

// Handle side panel loaded notification
function handleSidePanelLoaded () {
  console.log('Side panel loaded')
  return { success: true, message: 'Side panel load acknowledged' }
}

// Handle base URL request
function handleGetBaseUrl () {
  const baseUrl = 'http://localhost:5001'
  console.log('Returning base URL for JobJourney:', baseUrl)
  return baseUrl
}

// Handle show in JobJourney request
function handleShowInJobJourney (data) {
  console.log('Show in JobJourney request received:', data)

  if (data && data.jobs) {
    const jobsParam = encodeURIComponent(JSON.stringify(data.jobs))
    const url = `http://localhost:5001/market?jobs=${jobsParam}`

    chrome.tabs.create({ url })
      .catch(err => console.error('Error opening JobJourney:', err))
  }

  return { success: true }
}

// Helper function to check if panel is open
function isPanelOpen () {
  if (!panelOpen) {
    console.warn("Operation attempted while panel is closed")
    return false
  }
  return true
}

// ============================
// COMMUNICATION HELPERS
// ============================

// Helper function to safely send message through port
function safelySendThroughPort (port, message) {
  if (!port) {
    console.warn("Cannot send message - port is null")
    return false
  }

  try {
    port.postMessage(message)
    return true
  } catch (error) {
    console.error("Error sending message through port:", error.message)
    // If we get a connection error, mark the port as disconnected
    if (error.message.includes("Receiving end does not exist")) {
      portConnected = false

      // If this is the active port, clear it
      if (activePanelPort === port) {
        activePanelPort = null
      }
    }
    return false
  }
}

// ============================
// PORT CONNECTION HANDLING
// ============================

// Listen for panel connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "panel") {
    panelOpen = true
    portConnected = true
    console.log("Panel opened")

    // Store the active port
    activePanelPort = port

    // Listen for messages from the panel
    port.onMessage.addListener((message) => {
      console.log("Received message from panel:", message)

      // Handle panel state updates
      if (message.action === "PANEL_STATE_UPDATE") {
        const isActive = message.data?.isActive === true
        console.log(`Panel reporting state: ${isActive ? 'Active ✅' : 'Inactive ❌'}`)
        panelOpen = isActive
      }
      // Handle version check request
      else if (message.action === "CHECK_VERSION") {
        console.log("Received version check request from panel")
        handleVersionCheckFromPanel(message, port)
      }
      // Handle scraping request
      else if (message.action === "START_SCRAPING") {
        console.log("Received START_SCRAPING request from panel:", message.data)
        handleScrapingFromPanel(message, port)
      }
    })

    port.onDisconnect.addListener(() => {
      panelOpen = false
      portConnected = false
      console.log("Panel closed")

      // Clear the active port reference
      if (activePanelPort === port) {
        activePanelPort = null
      }
    })
  }
})

// Handle a scraping request from the panel
function handleScrapingFromPanel (message, port) {
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

// ============================
// VERSION CHECKING
// ============================

// Handle version check from panel
function handleVersionCheckFromPanel (message, port) {
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

// Find or create a JobJourney tab
async function findOrCreateJobJourneyTab (version) {
  try {
    // Try to find an existing tab
    const tabs = await chrome.tabs.query({
      url: [
        "*://jobjourney.me/job-market*",
        "http://localhost:5001/job-market*",
        "https://localhost:5001/job-market*"
      ]
    })

    if (tabs && tabs.length > 0) {
      console.log("Using existing JobJourney tab:", tabs[0].id)
      return tabs[0]
    }

    // Create a new tab
    console.log("No JobJourney tabs found, creating a new one")
    const baseUrl = handleGetBaseUrl()
    const url = `${baseUrl}/job-market?source=extension&version=${version}`
    console.log("Opening JobJourney at:", url)

    const tab = await chrome.tabs.create({
      url: url,
      active: false // Don't focus it
    })

    // Wait for tab to load
    await new Promise((resolve) => {
      const listener = function (tabId, changeInfo) {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener)
          resolve()
        }
      }
      chrome.tabs.onUpdated.addListener(listener)
    })

    console.log("JobJourney tab loaded successfully:", tab.id)
    return tab
  } catch (error) {
    console.error("Error finding/creating JobJourney tab:", error)
    return null
  }
}

// Execute version check script in tab
function executeVersionCheck (tab, version) {
  return chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (version) => {
      console.log('Sending version check from page context, version:', version)

      // Track version check in the page context
      if (typeof window._jobJourneyVersionCheckSent !== 'undefined') {
        console.log('Version check already sent, skipping duplicate')
        return true
      }

      // Mark that we've sent the check
      window._jobJourneyVersionCheckSent = true

      // Send message directly to window
      window.postMessage({
        type: 'VERSION_CHECK',
        source: 'JOBJOURNEY_EXTENSION',
        data: { version },
        timestamp: Date.now()
      }, '*')

      // Also try sendExtensionMessage if available
      if (typeof window.sendExtensionMessage === 'function') {
        try {
          window.sendExtensionMessage('VERSION_CHECK', { version })
        } catch (err) {
          console.error('Error using sendExtensionMessage:', err)
        }
      }

      return true
    },
    args: [version]
  })
}

// ============================
// MESSAGE LISTENERS
// ============================

// Listen for runtime messages
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

// Handle version check response
function handleVersionCheckResponse (message, sendResponse) {
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
  if (activePanelPort) {
    console.log('Sending VERSION_STATUS_UPDATE through active panel port')
    safelySendThroughPort(activePanelPort, {
      action: 'VERSION_STATUS_UPDATE',
      data: message.data
    })
  } else {
    console.log('No active panel port available for VERSION_STATUS_UPDATE')
  }

  sendResponse({ received: true, status: 'processed' })
}

// Store incompatibility information
function storeIncompatibilityInfo (data) {
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
function clearIncompatibilityInfo () {
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
function handleStartScrapingMessage (message, sendResponse) {
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
function handleLogPanelState (message, sendResponse) {
  const isPanelActive = message.data?.isPanelActive === true
  const logMethod = isPanelActive ? console.log : console.warn

  logMethod(`Panel state updated: ${isPanelActive ? 'Active ✅' : 'Inactive ❌'}`)
  sendResponse({ received: true })
}

// Handle RESET_PANEL_STATE message
function handleResetPanelState (message, sendResponse) {
  console.log('Received request to reset panel state')

  try {
    // Reset the panel state
    sidePanelService.resetPanelState()
      .then(() => {
        console.log('Panel state reset completed')
        sendResponse({
          success: true,
          message: 'Panel state has been reset'
        })
      })
      .catch(err => {
        console.error('Error resetting panel state:', err)
        sendResponse({
          success: false,
          error: err.message || 'Unknown error resetting panel state'
        })
      })
  } catch (err) {
    console.error('Exception in RESET_PANEL_STATE handler:', err)
    sendResponse({
      success: false,
      error: err.message || 'Unknown error in reset handler'
    })
  }
}

// Handle CHECK_PANEL_STATE message
function handleCheckPanelState (message, sendResponse) {
  if (message.debug) {
    console.log('Received CHECK_PANEL_STATE request')
  }

  sendResponse({
    isPanelActive: panelOpen,
    timestamp: Date.now()
  })
}

// ============================
// INITIALIZATION
// ============================

// Initialize messaging service
messagingService.initialize({ debug: true })

// Register message handlers
function registerMessageHandlers () {
  messagingService.registerHandler(MessageType.VERSION_CHECK, handleVersionCheck)
  messagingService.registerHandler(MessageType.SIDE_PANEL_LOADED, handleSidePanelLoaded)
  messagingService.registerHandler('getBaseUrl', handleGetBaseUrl)
  messagingService.registerHandler(MessageType.SHOW_IN_JOBJOURNEY, handleShowInJobJourney)
  messagingService.registerHandler(MessageType.START_SCRAPING, handleStartScraping)
  messagingService.registerHandler('CHECK_PANEL_STATE', data => {
    return {
      isPanelActive: panelOpen,
      timestamp: Date.now()
    }
  })
}

// Initialize side panel
async function initializeSidePanel () {
  console.log('Initializing side panel')

  // Check if Side Panel API is available
  if (!chrome.sidePanel) {
    console.warn('Side Panel API is not available in this browser or extension context')
    console.log('Using fallback mechanisms for panel state tracking')

    // Still initialize the panel service for basic functionality
    await sidePanelService.initialize()
    return
  }

  // Side Panel API is available, proceed with setup
  try {
    // Register panel behavior if the method exists
    if (typeof chrome.sidePanel.setPanelBehavior === 'function') {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      console.log('Side panel behavior registered successfully')
    } else {
      console.warn('Side panel setPanelBehavior is not available')
    }

    // Initialize the panel service
    await sidePanelService.initialize()

    // Set up event listeners if they exist
    if (chrome.sidePanel.onShown && typeof chrome.sidePanel.onShown.addListener === 'function') {
      chrome.sidePanel.onShown.addListener(() => {
        console.log('Side panel shown')
        panelOpen = true
      })
      console.log('Side panel shown listener registered')
    } else {
      console.warn('Side panel onShown event is not available')
    }

    if (chrome.sidePanel.onHidden && typeof chrome.sidePanel.onHidden.addListener === 'function') {
      chrome.sidePanel.onHidden.addListener(() => {
        console.log('Side panel hidden')
        panelOpen = false
      })
      console.log('Side panel hidden listener registered')
    } else {
      console.warn('Side panel onHidden event is not available')
    }

    console.log('Side panel initialization completed')
  } catch (error) {
    console.error('Error in side panel initialization:', error)
    // Still initialize the panel service for basic functionality
    try {
      await sidePanelService.initialize()
    } catch (innerError) {
      console.error('Error initializing sidePanelService:', innerError)
    }
  }
}

// Setup extension icon click handler
function setupActionClickHandler () {
  // Listen for extension icon clicks (if action API is available)
  if (chrome.action && chrome.action.onClicked) {
    chrome.action.onClicked.addListener((tab) => {
      try {
        // Check if sidePanel API is available before trying to use it
        if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function') {
          chrome.sidePanel.open({ tabId: tab.id })
            .catch(err => console.error('Error opening side panel:', err))
        } else {
          console.warn('Side panel API not available for opening panel from action click')
        }
      } catch (e) {
        console.error('Error in action.onClicked handler:', e)
      }
    })
  } else {
    console.warn('chrome.action API not available - icon click handling disabled')
  }
}

// Initialize components
async function initialize () {
  try {
    registerMessageHandlers()
    await initializeSidePanel()
    setupActionClickHandler()
    console.log('Background script initialization complete')
  } catch (error) {
    console.error('Error initializing background script:', error)
  }
}

// Start initialization
initialize() 