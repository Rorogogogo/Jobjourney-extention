// Add this early in the content script to announce it's loaded
console.log('🔵 JobJourney content script loaded on:', window.location.href)

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

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request)

  if (request.action === 'showScrapeOverlay') {
    // Directly create overlay when message received
    createScrapeOverlay()
    sendResponse({ success: true })
    return true // Indicate async response potentially
  }

  if (request.action === 'removeScrapeOverlay') {
    // Directly remove overlay when message received
    removeScrapeOverlay()
    sendResponse({ success: true })
    return true // Indicate async response potentially
  }

  console.log('Current page URL:', window.location.href)
  console.log('Current page title:', document.title)
  console.log('Document ready state:', document.readyState)

  if (request.action === 'scrapeJobs') {
    const currentUrl = window.location.href
    console.log('=== Starting Job Scraping ===')
    console.log('Page URL:', currentUrl)

    // Determine the correct platform scraper
    let platformScraper = null
    if (window.linkedInScraper && window.linkedInScraper.isMatch(currentUrl)) {
      platformScraper = window.linkedInScraper
    } else if (window.seekScraper && window.seekScraper.isMatch(currentUrl)) {
      platformScraper = window.seekScraper
    } else if (window.indeedScraper && window.indeedScraper.isMatch(currentUrl)) {
      platformScraper = window.indeedScraper
    }

    if (platformScraper) {
      try {
        // Gather platform-specific metadata
        const platformInfo = {
          platform: determinePlatform(currentUrl),
          url: currentUrl,
          title: document.title,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          deviceType: determineDeviceType()
        }

        platformScraper.scrapeJobList().then(result => {
          console.log('Scraping result:', result)
          console.log(result.jobs)
          console.log('Next URL found:', result.nextUrl)
          sendResponse({
            success: true,
            data: result.jobs,
            nextUrl: result.nextUrl,
            platformInfo: platformInfo
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
})

// Function to determine current platform
function determinePlatform (url) {
  if (url.includes('linkedin.com')) {
    return 'LinkedIn'
  } else if (url.includes('seek.com.au')) {
    return 'SEEK AU'
  } else if (url.includes('seek.co.nz')) {
    return 'SEEK NZ'
  } else if (url.includes('indeed.com')) {
    const domain = new URL(url).hostname
    if (domain.startsWith('au.')) return 'Indeed AU'
    if (domain.startsWith('uk.')) return 'Indeed UK'
    if (domain.startsWith('ca.')) return 'Indeed CA'
    return 'Indeed'
  } else {
    return 'Unknown'
  }
}

// Function to determine device type
function determineDeviceType () {
  const ua = navigator.userAgent
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet'
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile'
  }
  return 'desktop'
}

// Listen for messages from the website
window.addEventListener('message', function (event) {
  // Make sure the message is from our website
  if (event.source !== window) return

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
})

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
    console.log('Content script: Received scraped jobs message', message.data)

    // Forward the jobs to the website
    window.postMessage({
      type: 'JOBS_SCRAPED',
      data: message.data,
      source: 'JOBJOURNEY_EXTENSION',
      timestamp: Date.now(),
      target: 'JOBJOURNEY_APP',
      protocolVersion: '1.0'
    }, '*')

    // Send response back to acknowledge receipt
    if (sendResponse) {
      sendResponse({ received: true, jobCount: message.data?.jobs?.length || 0 })
    }

    return true // Keep the message channel open for async response
  }

  // Handle download extension message
  if (message.action === 'DOWNLOAD_EXTENSION') {
    console.log('Forwarding download extension request to website:', message.data)

    // Forward the message to the website
    window.postMessage({
      type: 'DOWNLOAD_EXTENSION',
      data: message.data,
      source: 'JOBJOURNEY_EXTENSION',
      timestamp: Date.now(),
      target: 'JOBJOURNEY_APP',
      protocolVersion: '1.0'
    }, '*')

    // Send response back to extension
    sendResponse({ received: true, forwarded: true })
  }

  if (message.action === 'VERSION_CHECK_REQUEST') {
    console.log('Content script received version check request:', message.data)

    // Acknowledge receipt
    sendResponse({ received: true })

    // Forward to web page using postMessage
    window.postMessage({
      type: 'VERSION_CHECK',
      source: 'JOBJOURNEY_EXTENSION',
      data: message.data,
      timestamp: Date.now()
    }, '*')

    return true // Keep the message channel open
  }

  return true // Keep the message channel open for async response
})

// Listen for messages from the web page
window.addEventListener('message', (event) => {
  // Make sure message is from our page, not from extension
  if (event.source === window &&
    event.data.source === 'JOBJOURNEY_WEBSITE' &&
    event.data.type === 'VERSION_CHECK_RESPONSE') {

    console.log('Content script received response from web page:', event.data)

    // Forward to background script
    chrome.runtime.sendMessage({
      action: 'VERSION_CHECK_RESPONSE',
      data: {
        ...event.data.data,
        requestId: event.data.data.requestId || event.data.requestId
      }
    })
  }
});

