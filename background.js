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

      // Calculate position to ensure window is always visible
      const windowWidth = 800
      const windowHeight = 800
      const left = Math.min(Math.max(0, screenWidth - windowWidth), screenWidth - (windowWidth / 2))
      const top = Math.min(Math.max(0, 0), screenHeight - (windowHeight / 2))

      // Create a new popup window
      chrome.windows.create({
        url: 'popup.html',
        type: 'popup',
        width: windowWidth,
        height: windowHeight,
        focused: true,
        top: top,
        left: left
      }, (window) => {
        popupWindowId = window.id
        chrome.windows.update(popupWindowId, { focused: true }) // Ensure the window is focused
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