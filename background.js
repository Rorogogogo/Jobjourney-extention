import config from './src/config/config.js'

// Handle installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log('JobJourney Assistant installed')
})

// Store the popup window id
let popupWindowId = null

// Handle toolbar icon click
chrome.action.onClicked.addListener(async () => {
  // Check if popup window exists and is still open
  if (popupWindowId !== null) {
    try {
      const window = await new Promise(resolve => chrome.windows.get(popupWindowId, resolve))
      if (window) {
        // Focus the existing popup window
        chrome.windows.update(popupWindowId, { focused: true })
        return
      }
    } catch (error) {
      // Window doesn't exist anymore
      popupWindowId = null
    }
  }

  // Get current window to determine screen position
  chrome.windows.getAll({ windowTypes: ['normal'] }, (windows) => {
    // Get the current screen dimensions
    chrome.system.display.getInfo((displays) => {
      const primaryDisplay = displays[0] // Use primary display
      const screenWidth = primaryDisplay.bounds.width
      const screenHeight = primaryDisplay.bounds.height

      // Fixed minimum dimensions to ensure UI is usable
      const minWidth = Math.max(600, screenWidth * 0.5)  // At least 600px or 50% of screen width
      const minHeight = Math.max(700, screenHeight * 0.5) // At least 700px or 50% of screen height

      // Calculate window dimensions
      const windowWidth = Math.max(minWidth, Math.min(1024, screenWidth * 0.7))  // Between min and 1024px
      const windowHeight = Math.max(minHeight, Math.min(900, screenHeight * 0.8)) // Between min and 900px

      // Calculate position to center the window
      const left = Math.max(0, Math.floor((screenWidth - windowWidth) / 2))
      const top = Math.max(0, Math.floor((screenHeight - windowHeight) / 2))

      // Create a new popup window
      chrome.windows.create({
        url: 'popup.html',
        type: 'popup',
        width: Math.floor(windowWidth),
        height: Math.floor(windowHeight),
        left: left,
        top: top,
        focused: true
      }, (window) => {
        popupWindowId = window.id
        // Ensure the window is focused and properly sized
        chrome.windows.update(popupWindowId, {
          focused: true,
          width: Math.floor(windowWidth),
          height: Math.floor(windowHeight),
          left: left,
          top: top
        })
      })
    })
  })
})

// Handle window close
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupWindowId) {
    popupWindowId = null
  }
})

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message in background:', request.action, request)

  if (request.action === 'getBaseUrl') {
    console.log('Getting base URL')
    config.getBaseUrl().then(baseUrl => {
      console.log('Got base URL:', baseUrl)
      if (!baseUrl) {
        console.error('Base URL is undefined')
        sendResponse(null)
        return
      }
      // Remove any trailing slashes
      baseUrl = baseUrl.replace(/\/+$/, '')
      console.log('Sending base URL:', baseUrl)
      sendResponse(baseUrl)
    }).catch(error => {
      console.error('Error getting base URL:', error)
      // Default to production URL if there's an error
      const prodUrl = 'https://jobjourney.me'
      console.log('Defaulting to production URL:', prodUrl)
      sendResponse(prodUrl)
    })
    return true // Required for async response
  }

  if (request.action === 'openJobSites') {
    const sites = [
      'https://www.linkedin.com/jobs/search?keywords=Full+Stack&location=' + encodeURIComponent(request.location),
      'https://www.seek.com.au/full-stack-jobs/in-' + request.location.replace(/\s+/g, '-'),
      'https://au.indeed.com/jobs?q=Full+Stack&l=' + encodeURIComponent(request.location)
    ]

    sites.forEach(url => {
      chrome.tabs.create({ url, active: true })
    })

    sendResponse({ success: true })
  }

  if (request.action === 'startScraping') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'scrapeJobs' }, (response) => {
          sendResponse(response)
        })
      }
    })
    return true // Required for async response
  }

  if (request.action === 'scrapeJobDetail') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'scrapeJobDetail' }, (response) => {
          sendResponse(response)
        })
      }
    })
    return true // Required for async response
  }
}) 