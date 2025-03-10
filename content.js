// Add this early in the content script to announce it's loaded
console.log('🔵 JobJourney content script loaded on:', window.location.href)

// No longer checking panel state on content script load
// The EXTENSION_PING mechanism will be used instead to determine panel state
// when the website needs to check if the panel is active

// Add test function
function testScraping () {
  const currentUrl = window.location.href
  console.log('Testing scraping on URL:', currentUrl)

  // Test selectors
  if (currentUrl.includes('linkedin.com')) {
    console.log('Testing LinkedIn selectors:')
    console.log('Job cards:', document.querySelectorAll('div.base-card.base-card--link.job-search-card').length)
    console.log('First job title:', document.querySelector('h3.base-search-card__title')?.textContent.trim())
    console.log('First company:', document.querySelector('h4.base-search-card__subtitle a')?.textContent.trim())
  }
  else if (currentUrl.includes('seek.com.au')) {
    console.log('Testing SEEK selectors:')
    console.log('Job cards:', document.querySelectorAll('article[data-card-type="JobCard"]').length)
    console.log('First job title:', document.querySelector('[data-automation="job-title"]')?.textContent.trim())
    console.log('First company:', document.querySelector('[data-automation="job-company-name"]')?.textContent.trim())
  }
  else if (currentUrl.includes('indeed.com')) {
    console.log('Testing Indeed selectors:')
    console.log('Job cards:', document.querySelectorAll('div.job_seen_beacon').length)
    console.log('First job title:', document.querySelector('h2.jobTitle a')?.textContent.trim())
    console.log('First company:', document.querySelector('span.companyName')?.textContent.trim())
  }
  1
  // Test actual scraping
  const platform = Object.values(scrapers).find(s => s.isMatch(currentUrl))
  if (platform) {
    console.log('Testing scraping function:')
    const jobs = platform.scrapeJobList()
    console.log('Scraped jobs:', jobs)
    return jobs
  }
  return null
}

// Add overlay functionality
function createScrapeOverlay () {
  // Remove existing overlay if any
  removeScrapeOverlay()

  // Create overlay in a shadow DOM to isolate styles
  const overlayContainer = document.createElement('div')
  overlayContainer.id = 'jobjourney-scrape-overlay-container'
  overlayContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2147483647;
    pointer-events: all;
  `

  // Create shadow DOM
  const shadow = overlayContainer.attachShadow({ mode: 'closed' })

  // Add styles to shadow DOM
  const style = document.createElement('style')
  style.textContent = `
    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: Arial, sans-serif;
    }

    .content {
      background: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #0073b1;
      border-radius: 50%;
      margin: 0 auto 15px;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    h3 {
      margin: 0 0 10px 0;
      color: #333;
      font-size: 18px;
    }

    p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }
  `

  // Create overlay structure
  const overlay = document.createElement('div')
  overlay.className = 'overlay'

  const content = document.createElement('div')
  content.className = 'content'

  const spinner = document.createElement('div')
  spinner.className = 'spinner'

  const message = document.createElement('h3')
  message.textContent = 'JobJourney Scraping in Progress'

  const subMessage = document.createElement('p')
  subMessage.textContent = 'Please do not close this tab or interact with the page until scraping is complete.'

  // Assemble the overlay
  content.appendChild(spinner)
  content.appendChild(message)
  content.appendChild(subMessage)
  overlay.appendChild(content)

  // Add everything to shadow DOM
  shadow.appendChild(style)
  shadow.appendChild(overlay)

  // Add to document
  document.documentElement.appendChild(overlayContainer)
}

function removeScrapeOverlay () {
  const overlay = document.getElementById('jobjourney-scrape-overlay-container')
  if (overlay) {
    overlay.remove()
  }
}

// Add state management
let isScrapingActive = false

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request)

  if (request.action === 'showScrapeOverlay') {
    isScrapingActive = true
    createScrapeOverlay()
    // Store the scraping state
    chrome.storage.local.set({ isScrapingActive: true })
    sendResponse({ success: true })
    return true
  }

  if (request.action === 'removeScrapeOverlay') {
    isScrapingActive = false
    removeScrapeOverlay()
    // Clear the scraping state
    chrome.storage.local.set({ isScrapingActive: false })
    sendResponse({ success: true })
    return true
  }

  console.log('Received message:', request)
  console.log('Current page URL:', window.location.href)
  console.log('Current page title:', document.title)
  console.log('Document ready state:', document.readyState)

  if (request.action === 'scrapeJobs') {
    const currentUrl = window.location.href
    console.log('=== Starting Job Scraping ===')
    console.log('Page URL:', currentUrl)

    // Define website structures for different platforms
    const websiteStructures = {
      linkedin: {
        jobCards: 'div.base-card.base-card--link.job-search-card',
        jobTitle: 'h3.base-search-card__title',
        company: 'h4.base-search-card__subtitle a'
      },
      seekAustralia: {
        jobCards: 'article[data-card-type="JobCard"]',
        jobTitle: '[data-automation="job-title"]',
        company: '[data-automation="job-company-name"]'
      },
      seekNewZealand: {
        jobCards: 'article[data-card-type="JobCard"]',
        jobTitle: '[data-automation="job-title"]',
        company: '[data-automation="job-company-name"]'
      }
    }

    let websiteStructure = null
    if (currentUrl.includes('linkedin.com/jobs')) {
      websiteStructure = websiteStructures.linkedin
    }
    else if (currentUrl.includes('seek.com.au')) {
      websiteStructure = websiteStructures.seekAustralia
    }
    else if (currentUrl.includes('seek.co.nz')) {
      websiteStructure = websiteStructures.seekNewZealand || websiteStructures.seekAustralia // Fall back to Australia if NZ not defined
    }

    const platform = Object.values(scrapers).find(s => s.isMatch(currentUrl))
    if (platform) {
      try {
        platform.scrapeJobList().then(result => {
          console.log('Scraping result:', result)
          console.log(result.jobs)
          console.log('Next URL found:', result.nextUrl)
          sendResponse({
            success: true,
            data: result.jobs,
            nextUrl: result.nextUrl
          })
        })
        return true // Keep message channel open
      } catch (error) {
        console.error('Error during scraping:', error)
      }
    } else {
      sendResponse({ success: false, error: 'Unsupported platform' })
    }
    return true
  }

  if (request.action === 'scrapeJobDetail') {
    const currentUrl = window.location.href
    console.log('Current URL:', currentUrl)

    const platform = Object.values(scrapers).find(s => s.isMatch(currentUrl))
    console.log('Matched platform:', platform?.constructor.name)

    if (platform) {
      try {
        const jobDetail = platform.scrapeJobDetail()
        console.log('Scraped job detail:', jobDetail)
        sendResponse({ success: true, data: jobDetail })
      } catch (error) {
        console.error('Error during detail scraping:', error)
        sendResponse({ success: false, error: error.message })
      }
    } else {
      console.log('No matching platform found')
      sendResponse({ success: false, error: 'Unsupported platform' })
    }
  }

  if (request.action === 'START_SCRAPING') {
    console.log('Content script received START_SCRAPING message:', request)

    // First check if panel is active
    chrome.runtime.sendMessage({
      action: 'CHECK_PANEL_ACTIVE',
      data: {}
    }, backgroundResponse => {
      console.log('🟢 Background responded to panel check:', backgroundResponse)

      // Add debug logging to see the exact structure of the response
      console.log('Response structure check:', {
        directAccess: backgroundResponse?.data?.connected,
        successCheck: backgroundResponse?.success,
        responseType: typeof backgroundResponse,
        hasDataProperty: 'data' in backgroundResponse,
        fullResponse: JSON.stringify(backgroundResponse)
      })

      // Get panel active status from background response - try multiple ways to accommodate
      // both old and new response structures
      const isPanelActive =
        backgroundResponse?.data?.connected === true || // New structure
        backgroundResponse?.isPanelActive === true ||   // Legacy structure
        (backgroundResponse?.success === true && backgroundResponse?.data !== undefined) // Fallback for success without explicit inactive status

      if (!isPanelActive) {
        console.error('🔴 Panel is not active, cannot start scraping')

        sendResponse({
          success: false,
          status: 'error',
          message: 'Extension panel is not open. Please click on the extension icon and keep the panel open to start scraping.',
          code: 'PANEL_NOT_ACTIVE',
          data: null
        })

        return
      }

      // Send an immediate acknowledgment response to the website
      const ackResponse = {
        type: 'START_SCRAPING_RESPONSE',
        data: {
          success: true,
          message: 'Scraping request received'
        },
        messageId: request.data.messageId,
        originalMessageId: request.data.messageId,
        source: 'JOBJOURNEY_EXTENSION',
        isResponse: true,
        timestamp: Date.now(),
        target: 'JOBJOURNEY_APP',
        protocolVersion: '1.0'
      }

      console.log('Sending immediate acknowledgment:', ackResponse)
      window.postMessage(ackResponse, '*')

      // Forward the message to the extension's background script
      chrome.runtime.sendMessage({
        action: 'START_SCRAPING',
        data: request.data.data,
        messageId: request.data.messageId
      }, response => {
        console.log('Received response from background script:', response)

        // Forward the full response back to the website if needed
        if (response && response.sendToWebsite) {
          window.postMessage({
            type: 'SCRAPING_STATUS',
            data: response.data,
            source: 'JOBJOURNEY_EXTENSION',
            timestamp: Date.now(),
            target: 'JOBJOURNEY_APP',
            protocolVersion: '1.0'
          }, '*')
        }
      })
    })
  }

  // Send back a response
  if (request.action === 'OPEN_SCRAPE_OVERLAY') {
    createScrapeOverlay()
    sendResponse({ success: true })
  } else if (request.action === 'CLOSE_SCRAPE_OVERLAY') {
    removeScrapeOverlay()
    sendResponse({ success: true })
  } else if (request.action === 'SCRAPE_TEST') {
    const result = testScraping()
    sendResponse({ success: true, data: result })
  } else if (request.action === 'UPDATE_SCRAPE_STATUS') {
    updateScrapeStatus(request.data)
    sendResponse({ success: true })
  }

  // Required for async response
  return true
})

// Check scraping state on page load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const result = await chrome.storage.local.get('isScrapingActive')
    if (result.isScrapingActive) {
      createScrapeOverlay()
    }
  } catch (error) {
    console.error('Error checking scraping state:', error)
  }
})

// Also check immediately in case DOMContentLoaded already fired
chrome.storage.local.get('isScrapingActive', (result) => {
  if (result.isScrapingActive) {
    createScrapeOverlay()
  }
})

// Ensure overlay persists after dynamic page updates
const observer = new MutationObserver(() => {
  if (isScrapingActive && !document.getElementById('jobjourney-scrape-overlay-container')) {
    createScrapeOverlay()
  }
})

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
})

// Listen for messages from the website
window.addEventListener('message', function (event) {
  // Make sure the message is from our website
  if (event.source !== window) return

  // More detailed logging - add emoji to make it stand out in console
  // Skip logging EXTENSION_PING messages to reduce noise
  if (event.data && event.data.type && event.data.type !== 'EXTENSION_PING') {
    console.log(`🔵 Content script received message (${event.data.type}) from website:`, event.data)
  } else if (!event.data.type) {
    console.log('🔵 Content script received non-typed message from website:', event.data)
  }

  // Handle EXTENSION_PING message
  if (event.data.type === 'EXTENSION_PING') {
    // Just return a simple success response without checking panel status
    window.postMessage({
      type: 'EXTENSION_PING_RESPONSE',
      source: 'JOBJOURNEY_EXTENSION',
      data: {
        success: true,
        version: chrome.runtime.getManifest().version
      },
      timestamp: Date.now(),
      target: 'JOBJOURNEY_APP'
    }, '*')

    return
  }

  // Handle VERSION_CHECK_RESPONSE message
  if (event.data.type === 'VERSION_CHECK_RESPONSE') {
    console.log('Received VERSION_CHECK_RESPONSE:', event.data)

    // Forward the response to any listeners in the extension
    // This ensures the extension's versionService receives the compatibility information
    chrome.runtime.sendMessage({
      action: 'VERSION_CHECK_RESPONSE',
      data: event.data.data
    }, (response) => {
      // Make sure we handle response or lack thereof properly to avoid "message channel closed" error
      if (chrome.runtime.lastError) {
        console.warn('Error sending VERSION_CHECK_RESPONSE to background:', chrome.runtime.lastError.message)
      } else if (response) {
        console.log('Background acknowledged VERSION_CHECK_RESPONSE:', response)
      }
    })

    // Also post it to the window in case local listeners are waiting
    window.postMessage({
      type: 'VERSION_CHECK_RESPONSE_INTERNAL',
      source: 'JOBJOURNEY_EXTENSION',
      data: event.data.data,
      timestamp: Date.now()
    }, '*')

    return
  }

  // Handle sendJobs response
  if (event.data.type === 'SEND_JOBS_RESPONSE') {
    console.log('Received jobs response:', event.data)
    // Forward the response back to the extension
    chrome.runtime.sendMessage({
      action: 'JOBS_RECEIVED_RESPONSE',
      data: {
        success: event.data.data.isSuccess || event.data.data.success,
        message: event.data.data.message,
        totalJobs: event.data.data.totalCount,
        jobs: event.data.data.items
      }
    })
  }

  // Handle START_SCRAPING message
  if (event.data.type === 'START_SCRAPING') {
    console.log('Received START_SCRAPING from website:', event.data)

    // Send an immediate acknowledgment response to the website
    const ackResponse = {
      type: 'START_SCRAPING_RESPONSE',
      data: {
        success: true,
        message: 'Scraping request received'
      },
      messageId: event.data.messageId,
      originalMessageId: event.data.messageId,
      source: 'JOBJOURNEY_EXTENSION',
      isResponse: true,
      timestamp: Date.now(),
      target: 'JOBJOURNEY_APP',
      protocolVersion: '1.0'
    }

    console.log('Sending immediate acknowledgment:', ackResponse)
    window.postMessage(ackResponse, '*')

    // Forward the message to the extension's background script
    chrome.runtime.sendMessage({
      action: 'START_SCRAPING',
      data: event.data.data,
      messageId: event.data.messageId
    }, response => {
      console.log('Received response from background script:', response)

      // Forward the full response back to the website if needed
      if (response && response.sendToWebsite) {
        window.postMessage({
          type: 'SCRAPING_STATUS',
          data: response.data,
          source: 'JOBJOURNEY_EXTENSION',
          timestamp: Date.now(),
          target: 'JOBJOURNEY_APP',
          protocolVersion: '1.0'
        }, '*')
      }
    })
  }
})

// Notify website that extension is available
// This is replaced by the EXTENSION_PING mechanism which checks panel state
// window.postMessage({ type: 'EXTENSION_AVAILABLE' }, '*')

// Add listener for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received from background script:', message)

  // Handle scraping status updates
  if (message.action === 'SCRAPING_STATUS_UPDATE') {
    console.log('Forwarding scraping status update to website:', message.data)

    // Forward the status update to the website
    window.postMessage({
      type: 'SCRAPING_STATUS',
      data: message.data,
      source: 'JOBJOURNEY_EXTENSION',
      timestamp: Date.now(),
      target: 'JOBJOURNEY_APP',
      protocolVersion: '1.0'
    }, '*')
  }

  // Handle scraped jobs
  if (message.action === 'JOBS_SCRAPED') {
    console.log('Forwarding scraped jobs to website:', message.data)

    // Forward the jobs to the website
    window.postMessage({
      type: 'JOBS_SCRAPED',
      data: message.data,
      source: 'JOBJOURNEY_EXTENSION',
      timestamp: Date.now(),
      target: 'JOBJOURNEY_APP',
      protocolVersion: '1.0'
    }, '*')
  }

  return true // Keep the message channel open for async response
})

// ============================
// PANEL STATE MANAGEMENT
// ============================

// Flag to track panel state
let lastPanelStateCheck = 0
let cachedPanelState = false

// Function to expose extension panel state to the website
function exposeExtensionPanelState (debug = false, forceCheck = false) {
  const now = Date.now()

  // If we've checked recently (within 30 seconds) and not forcing a check, use cached result
  if (!forceCheck && (now - lastPanelStateCheck < 30000) && lastPanelStateCheck > 0) {
    if (debug) console.log('Using cached panel state from within last 30 seconds')
    return Promise.resolve(cachedPanelState)
  }

  // Otherwise, do a fresh check
  return new Promise((resolve) => {
    // Try direct panel communication first (more accurate)
    chrome.runtime.sendMessage({
      action: 'CHECK_PANEL_STATE',
      debug: debug,
      directPanelCheck: true
    }, (response) => {
      if (chrome.runtime.lastError) {
        if (debug) console.log('No direct panel response, falling back to background check:', chrome.runtime.lastError.message)
        // Fall back to messaging the background script
        fallbackToBgStateCheck(debug, resolve)
        return
      }

      // If we got a response directly from the panel
      if (response && response.directFromPanel) {
        // Panel is definitely active if it responded directly
        processStateResponse(response, debug, 'Direct from panel')
        lastPanelStateCheck = now
        cachedPanelState = true
        resolve(true)
      } else {
        // Otherwise use the standard background response
        processStateResponse(response, debug, 'From background')
        lastPanelStateCheck = now
        cachedPanelState = (response && response.isPanelActive === true)
        resolve(cachedPanelState)
      }
    })
  })
}

// Helper to fall back to background check when direct panel check fails
function fallbackToBgStateCheck (debug, resolve = null) {
  chrome.runtime.sendMessage({
    action: 'CHECK_PANEL_STATE',
    debug: debug,
    directPanelCheck: false
  }, (response) => {
    if (chrome.runtime.lastError) {
      if (debug) console.error('Error checking panel state from background:', chrome.runtime.lastError)
      // Default to inactive if there's an error
      window.extensionPanelActive = false
      lastPanelStateCheck = Date.now()
      cachedPanelState = false
      if (resolve) resolve(false)
      return
    }

    processStateResponse(response, debug, 'Fallback')
    lastPanelStateCheck = Date.now()
    cachedPanelState = (response && response.isPanelActive === true)
    if (resolve) resolve(cachedPanelState)
  })
}

// Process and update the panel state based on response
function processStateResponse (response, debug, source) {
  // Only log if debug is enabled or the panel state has changed
  const newState = response && response.isPanelActive === true
  const stateChanged = window.extensionPanelActive !== newState

  if (debug || stateChanged) {
    console.log(`Extension panel state (${source}):`, newState ? 'active' : 'inactive')
  }

  // Update window property with the panel state
  window.extensionPanelActive = newState

  // Only send message if the state has changed to reduce spam
  if (stateChanged) {
    // Notify the website about the panel state
    window.postMessage({
      type: 'EXTENSION_PANEL_STATE',
      source: 'JOBJOURNEY_EXTENSION',
      data: {
        isPanelActive: window.extensionPanelActive,
        stateSource: source
      },
      timestamp: Date.now()
    }, '*')
  }
}

// Set up panel state monitoring only once at startup
function setupPanelStateMonitoring () {
  // Initial check with debug enabled to establish the first state
  exposeExtensionPanelState(true, true).then(isActive => {
    console.log(`Initial panel state check: ${isActive ? 'Active' : 'Inactive'}`)
  })
}

// ============================
// SCRAPING FUNCTIONALITY
// ============================

// Function to expose scraping functionality to the website
function exposeScrapingFunction () {
  // Define the scraping function that will be exposed to the website
  window.startScrapingWithPort = function (config) {
    console.log('Website called startScrapingWithPort:', config)

    return new Promise((resolve, reject) => {
      // First check if panel is active (force a fresh check)
      exposeExtensionPanelState(true, true).then(isPanelActive => {
        // Only proceed if panel is active
        if (!isPanelActive) {
          console.error('Cannot start scraping - panel is not active')
          reject(new Error('Extension panel is not active. Please open the JobJourney panel first.'))
          return
        }

        // Send the request to the extension
        chrome.runtime.sendMessage({
          action: 'START_SCRAPING',
          data: config
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending scraping request:', chrome.runtime.lastError)
            reject(new Error('Failed to send scraping request: ' + chrome.runtime.lastError.message))
            return
          }

          console.log('Scraping request sent successfully, response:', response)
          resolve(response)
        })
      }).catch(error => {
        console.error('Error checking panel state:', error)
        reject(new Error('Failed to check panel state: ' + error.message))
      })
    })
  }

  console.log('Exposed startScrapingWithPort function to website')
}

// ============================
// INITIALIZATION
// ============================

// Initialize content script
function initialize () {
  console.log('JobJourney extension content script initialized')

  // Set up initial panel state
  setupPanelStateMonitoring()

  // Expose scraping functionality
  exposeScrapingFunction()
}

// Start initialization
initialize();

