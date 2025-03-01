import config from './src/config/config.js'
import sidePanelService from './src/services/sidePanelService.js'

// Handle installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log('JobJourney Assistant installed')

  // Initialize side panel service
  sidePanelService.initialize()
})

// Register the side panel
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error))

// Listen for extension icon clicks to open the side panel
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id })
})

// Handle messages from popup/sidepanel
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
    const sites = []

    // LinkedIn works for all countries
    sites.push('https://www.linkedin.com/jobs/search?keywords=Full+Stack&location=' + encodeURIComponent(request.location))

    // Add country-specific job sites
    if (request.location.includes('Australia')) {
      sites.push('https://www.seek.com.au/full-stack-jobs/in-' + request.location.replace(/\s+/g, '-'))
      sites.push('https://au.indeed.com/jobs?q=Full+Stack&l=' + encodeURIComponent(request.location))
    } else if (request.location.includes('New Zealand')) {
      sites.push('https://www.seek.co.nz/full-stack-jobs/in-' + request.location.replace(/\s+/g, '-'))
      sites.push('https://nz.indeed.com/jobs?q=Full+Stack&l=' + encodeURIComponent(request.location))
    } else if (request.location.includes('United Kingdom')) {
      sites.push('https://uk.indeed.com/jobs?q=Full+Stack&l=' + encodeURIComponent(request.location))
    } else if (request.location.includes('Canada')) {
      sites.push('https://ca.indeed.com/jobs?q=Full+Stack&l=' + encodeURIComponent(request.location))
    } else if (request.location.includes('United States')) {
      sites.push('https://www.indeed.com/jobs?q=Full+Stack&l=' + encodeURIComponent(request.location))
    } else {
      // Default to generic Indeed
      sites.push('https://www.indeed.com/jobs?q=Full+Stack&l=' + encodeURIComponent(request.location))
    }

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