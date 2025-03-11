// ============================
// IMPORTS AND INITIALIZATION
// ============================
import uiService from './src/services/uiService.js'
import eventHandlerService from './src/services/eventHandlerService.js'
import versionService from './src/services/versionService.js'
import tabService from './src/services/tabService.js'

// ============================
// STATE MANAGEMENT
// ============================
// Create a connection to the background script

const port = chrome.runtime.connect({ name: "panel" })

// Flag to track if we've already displayed a version message
let versionCheckCompleted = false

// ============================
// MESSAGE HANDLERS
// ============================

// Set up port message listener
port.onMessage.addListener((message) => {
  console.log('Panel received message:', message)

  // Handle version status updates
  if (message.action === "VERSION_STATUS_UPDATE") {
    handleVersionStatusUpdate(message)
  }
  // Handle scraping responses
  else if (message.action === "SCRAPING_STARTED") {
    console.log('Scraping started:', message.data)
    updateScrapingStatus(message.data)
  }
  else if (message.action === "SCRAPING_PROGRESS") {
    console.log('Scraping progress:', message.data)
    updateScrapingProgress(message.data)
  }
  else if (message.action === "SCRAPING_COMPLETED") {
    console.log('Scraping completed:', message.data)
    handleScrapingCompleted(message.data)
  }
  else if (message.action === "SCRAPING_ERROR") {
    console.error('Scraping error:', message.data)
    handleScrapingError(message.data)
  }
})

// Handle version status updates
function handleVersionStatusUpdate (message) {
  // Check if we've already processed a version message
  if (versionCheckCompleted) {
    console.log('Version check already completed, ignoring update')
    return
  }

  console.log('Received version status update:', message.data)

  // Mark that we've shown a version message
  versionCheckCompleted = true

  // Handle incompatible version if needed
  if (message.data && message.data.isCompatible === false) {
    versionService.showUpdateUI({
      currentVersion: message.data.currentVersion,
      minimumVersion: message.data.minimumVersion,
      message: message.data.message
    })
  }
}

// Set up runtime message listener for direct frontend-to-panel communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle CHECK_PANEL_STATE messages directly from frontend
  if (message.action === 'CHECK_PANEL_STATE') {
    // The panel is obviously active if this code is running
    if (message.debug) {
      console.log('Panel directly received CHECK_PANEL_STATE request')
    }

    // Send immediate response confirming panel is active
    sendResponse({
      isPanelActive: true,
      directFromPanel: true,
      timestamp: Date.now()
    })

    // Tell the background script the panel is active too
    notifyBackgroundOfPanelState(true)

    return true // Keep the message channel open
  }

  return false // Let other handlers process this message
})

// ============================
// PANEL STATE MANAGEMENT
// ============================

// Notify background script of panel state
function notifyBackgroundOfPanelState (isActive) {
  port.postMessage({
    action: 'PANEL_STATE_UPDATE',
    data: {
      isActive: isActive,
      timestamp: Date.now()
    }
  })
}

// ============================
// SCRAPING FUNCTIONALITY
// ============================

// Function to start scraping through port
function startScrapingWithPort (config) {
  console.log('Starting scraping with port:', config)

  return new Promise((resolve, reject) => {
    try {
      // Send the scraping request through the port
      port.postMessage({
        action: 'START_SCRAPING',
        data: config
      })

      // Resolve immediately since we'll get updates through the port listener
      resolve({
        success: true,
        message: 'Scraping request sent'
      })
    } catch (error) {
      console.error('Error sending scraping request:', error)
      reject(error)
    }
  })
}

// ============================
// WEB APP MANAGEMENT
// ============================

// Function to ensure the JobJourney web app is open
async function ensureJobJourneyWebAppOpen () {
  console.log('Ensuring JobJourney web app is open')
  try {
    // Use the tabService to open the JobJourney website if it's not already open
    const tab = await tabService.ensureJobJourneyWebsite(false) // false means don't focus popup
    console.log('JobJourney web app tab:', tab.id)
    return tab
  } catch (error) {
    console.error('Error opening JobJourney web app:', error)
    return null
  }
}

// ============================
// SCRAPING STATUS MANAGEMENT
// ============================

// Function to update scraping status in UI
function updateScrapingStatus (data) {
  // Check if we have status elements
  const statusElement = document.getElementById('scraping-status')
  if (statusElement) {
    statusElement.textContent = data.message || 'Processing...'
  }

  // Update detail if available
  const detailElement = document.getElementById('scraping-detail')
  if (detailElement && data.detail) {
    detailElement.textContent = data.detail
  }

  // Show the scraping section if not already visible
  const scrapingSection = document.getElementById('scraping-section')
  if (scrapingSection) {
    scrapingSection.style.display = 'block'
  }
}

// Function to update scraping progress in UI
function updateScrapingProgress (data) {
  // Update progress bar if available
  const progressBar = document.getElementById('scraping-progress')
  if (progressBar) {
    progressBar.value = data.overallProgress || 0
  }

  // Update platform-specific progress if needed
  const platformElement = document.getElementById(`platform-${data.platform}-progress`)
  if (platformElement) {
    platformElement.value = data.progress || 0
  }

  // Update status text
  const statusElement = document.getElementById('scraping-status')
  if (statusElement) {
    statusElement.textContent = `Scraping ${data.platform}: ${data.status} (${data.overallProgress}%)`
  }
}

// Function to handle completed scraping
function handleScrapingCompleted (data) {
  console.log(`Scraping completed, found ${data.count} jobs`)

  // Update status
  const statusElement = document.getElementById('scraping-status')
  if (statusElement) {
    statusElement.textContent = `Found ${data.count} jobs across ${data.platforms.length} platforms`
  }

  // Update progress to 100%
  const progressBar = document.getElementById('scraping-progress')
  if (progressBar) {
    progressBar.value = 100
  }

  // Display the jobs or notify the user they're available
  const jobsResultElement = document.getElementById('jobs-result')
  if (jobsResultElement) {
    jobsResultElement.textContent = `${data.count} jobs found. View in JobJourney.`
    jobsResultElement.style.display = 'block'

    // Optionally add a click handler to open the jobs in JobJourney
    jobsResultElement.onclick = () => {
      chrome.runtime.sendMessage({
        action: 'SHOW_IN_JOBJOURNEY',
        data: { jobs: data.jobs }
      })
    }
  }

  // Send jobs to JobJourney website for processing
  try {
    window.postMessage({
      type: 'JOBS_SCRAPED',
      source: 'JOBJOURNEY_EXTENSION',
      data: {
        jobs: data.jobs,
        query: data.query
      },
      timestamp: Date.now()
    }, '*')
  } catch (error) {
    console.error('Error sending scraped jobs to website:', error)
  }
}

// Function to handle scraping errors
function handleScrapingError (data) {
  // Update status to show error
  const statusElement = document.getElementById('scraping-status')
  if (statusElement) {
    statusElement.textContent = data.error || 'An error occurred during scraping'
    statusElement.classList.add('error')
  }

  // Show error details
  const detailElement = document.getElementById('scraping-detail')
  if (detailElement) {
    detailElement.textContent = `Error occurred while scraping ${data.platforms.join(', ')}`
    detailElement.classList.add('error')
  }
}

// ============================
// INITIALIZATION AND LIFECYCLE
// ============================

// Main initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🟢 Panel DOM loaded at:', new Date().toISOString())

  // Notify background that panel is active
  notifyBackgroundOfPanelState(true)

  // Initialize UI
  initializeUI()

  // Check version
  checkVersion()
})

// Initialize the UI elements
function initializeUI () {
  // Initialize UI using the service
  const elements = uiService.initializeUI(
    eventHandlerService.setupEventListeners,
    eventHandlerService.loadSavedPreferences
  )

  // Expose startScrapingWithPort to the window for messaging from website
  window.startScrapingWithPort = startScrapingWithPort
}

// Check the extension version
function checkVersion () {
  // Check version using port-based messaging
  versionService.checkVersionWithPort(port).then(versionResult => {
    console.log("111")
    // Check if we've already processed a version message
    if (versionCheckCompleted) {
      console.log('Version check already completed, ignoring duplicate result')
      return
    }

    // Mark that we've shown a version message
    versionCheckCompleted = true

    console.log('Version check completed with result:', versionResult.isCompatible ? 'Compatible ✅' : 'Update required ⚠️')

    // Handle incompatible version
    if (!versionResult.isCompatible) {
      versionService.showUpdateUI({
        currentVersion: versionResult.currentVersion,
        minimumVersion: versionResult.minimumVersion,
        message: versionResult.message
      })
    } else {
      // If version is compatible, ensure the JobJourney web app is open
      ensureJobJourneyWebAppOpen()
    }
  })
}

// Clean up when the window is about to unload
window.addEventListener('beforeunload', () => {
  console.log('Panel window unloading, cleaning up connections')

  // Notify background that panel is inactive
  try {
    notifyBackgroundOfPanelState(false)
  } catch (error) {
    // Ignore errors during shutdown
  }
})
