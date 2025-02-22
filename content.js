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
        sendResponse({ success: false, error: error.message })
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

  console.log('Content script received message from website:', event.data)

  // Handle START_SCRAPING message
  if (event.data.type === 'START_SCRAPING') {
    console.log('Forwarding START_SCRAPING message to extension:', event.data)

    // Forward the message to the extension's background script
    chrome.runtime.sendMessage({
      action: 'START_SCRAPING',
      data: event.data.data
    }, response => {
      console.log('Received response from extension:', response)
      // Send response back to website
      window.postMessage({
        type: 'SCRAPING_RESPONSE',
        data: response
      }, '*')
    })
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

// Notify website that extension is available
window.postMessage({ type: 'EXTENSION_AVAILABLE' }, '*');

