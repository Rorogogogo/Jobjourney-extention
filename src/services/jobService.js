import tabService from './tabService.js'
import messagingService, { MessageType } from './messagingService.js'

let storedJobs = [] // Store jobs in memory for showInJobJourney function
let scrapingConfig = {} // Store scraping configuration for statistics

/**
 * Send jobs to JobJourney
 * @param {Array} jobs - The jobs to send
 * @param {Object} config - Configuration data from the scraping process
 * @returns {Promise} - Promise that resolves when the jobs have been sent
 */
async function sendJobsToJobJourney (jobs, config = {}) {
  try {
    const tab = await tabService.ensureJobJourneyWebsite(true)

    console.log('Config received from UI:', config)

    // Get UI configuration elements if available
    const uiConfig = await getUIConfiguration()

    // Create API compatible config by combining UI config with passed config
    const apiConfig = {
      platforms: Array.isArray(config.platforms) ? config.platforms :
        (config.platform ? [config.platform] : uiConfig.platforms || []),
      jobTitle: config.jobTitle || uiConfig.jobTitle || '',
      country: config.country || uiConfig.country || '',
      location: config.location || uiConfig.location || '',
      totalJobsFound: config.totalJobsFound || config.uniqueJobs || jobs.length
    }

    console.log('Final API config for backend:', apiConfig)

    // Prepare the data with jobs and scraping configuration
    const data = {
      jobs,
      scrapingConfig: apiConfig
    }

    // Send jobs to the page using messaging service
    console.log('Sending jobs to JobJourney tab using messaging service...', data)
    return messagingService.sendToTab(tab.id, MessageType.JOBS_SCRAPED, data)
  } catch (error) {
    console.error('Error sending jobs to JobJourney:', error)
    throw error
  }
}

// Function to get configuration from UI elements
async function getUIConfiguration () {
  try {
    // Default config with empty values
    const config = {
      platforms: [],
      jobTitle: '',
      country: '',
      location: ''
    }

    // Get platform selection
    const platformSelect = document.getElementById('platform-select')
    if (platformSelect && platformSelect.value) {
      config.platforms = [platformSelect.value]
    }

    // Get job title
    const jobTitleInput = document.getElementById('job-title-input')
    if (jobTitleInput && jobTitleInput.value) {
      config.jobTitle = jobTitleInput.value.trim()
    }

    // Get location
    const locationInput = document.getElementById('location-input')
    if (locationInput && locationInput.value) {
      const locationValue = locationInput.value.trim()

      // Try to extract country and location
      const locationParts = locationValue.split(',')
      if (locationParts.length > 1) {
        config.location = locationParts[0].trim()
        config.country = locationParts[locationParts.length - 1].trim()
      } else {
        config.location = locationValue
      }
    }

    console.log('Configuration from UI elements:', config)
    return config
  } catch (error) {
    console.error('Error getting UI configuration:', error)
    return {
      platforms: [],
      jobTitle: '',
      country: '',
      location: ''
    }
  }
}

// Function to show jobs in JobJourney website using port connection
async function showInJobJourney () {
  try {
    if (storedJobs.length === 0) {
      console.warn('No jobs to show in JobJourney')
      throw new Error('No jobs available to show in JobJourney')
    }

    console.log(`Showing ${storedJobs.length} jobs in JobJourney...`)

    // Connect to background script with port
    const port = chrome.runtime.connect({ name: "panel" })

    // Send the SHOW_IN_JOBJOURNEY message through the port
    port.postMessage({
      action: "SHOW_IN_JOBJOURNEY",
      data: {
        jobs: storedJobs,
        scrapingConfig: scrapingConfig,
        timestamp: Date.now()
      }
    })

    console.log('Jobs sent to JobJourney through port', storedJobs, scrapingConfig)

    // The background script will handle opening/finding the tab
    // and sending the jobs to the website
    return { success: true, message: 'Jobs sent to JobJourney' }
  } catch (error) {
    console.error('Error showing jobs in JobJourney:', error)
    throw error
  }
}

// Function to store jobs for later use
function setJobs (jobs) {
  storedJobs = [...jobs]
  console.log(`Stored ${storedJobs.length} jobs for later use`)
  return storedJobs.length
}

// Function to set scraping configuration
function setScrapingConfig (config) {
  scrapingConfig = { ...config }
  console.log('Stored scraping configuration:', scrapingConfig)
  return scrapingConfig
}

// Function to get stored jobs
function getJobs () {
  return storedJobs
}

// Function to get scraping configuration
function getScrapingConfig () {
  return scrapingConfig
}

// Function to clear stored jobs
function clearJobs () {
  const count = storedJobs.length
  storedJobs = []
  console.log(`Cleared ${count} stored jobs`)
  return count
}

// Function to find JobJourney job-market tab
async function findJobMarketTab () {
  const tabs = await chrome.tabs.query({})
  return tabs.find(tab =>
    tab.url && (
      tab.url.includes('jobjourney.me/job-market') ||
      tab.url.includes('localhost:5001/job-market')
    )
  )
}

// Function to send jobs and show in JobJourney
async function sendJobsAndShow (scrapedJobs, baseUrl, jobsAlreadySent = false, config = {}) {
  const manifest = chrome.runtime.getManifest()
  const url = `${baseUrl}/job-market?source=extension&version=${manifest.version}`

  // Store scraping configuration if provided
  if (Object.keys(config).length > 0) {
    setScrapingConfig(config)
  }

  // Find existing job-market tab
  const existingTab = await findJobMarketTab()

  // Create new tab if no job-market tab exists
  const tab = existingTab || await chrome.tabs.create({
    url: url,
    active: true
  })

  // Focus the window containing the tab
  await chrome.windows.update(tab.windowId, { focused: true })

  // Wait for page to load before sending import message
  await new Promise((resolve) => {
    chrome.tabs.onUpdated.addListener(function listener (tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener)
        setTimeout(resolve, 1000) // Give extra time for scripts to initialize
      }
    })
  })

  // Ensure tab is focused before sending jobs
  await chrome.tabs.update(tab.id, { active: true })
  await chrome.windows.update(tab.windowId, { focused: true })

  // Only send jobs if they haven't been sent already
  if (!jobsAlreadySent && scrapedJobs.length > 0) {
    try {
      await sendJobsToJobJourney(scrapedJobs, scrapingConfig)
    } catch (error) {
      console.error('Error sending jobs to JobJourney:', error)
    }
  }

  await chrome.tabs.update(tab.id, { active: true })
  await chrome.windows.update(tab.windowId, { focused: true })

  // Send message to trigger job import
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (message) => {
      console.log('Sending import trigger message:', message)
      window.postMessage(message, '*')
    },
    args: [{
      type: 'TRIGGER_JOB_IMPORT',
      data: {
        source: 'extension',
        version: chrome.runtime.getManifest().version,
        scrapingConfig: scrapingConfig
      }
    }]
  })

  // Final focus to ensure the tab stays active
  await chrome.tabs.update(tab.id, { active: true })
  await chrome.windows.update(tab.windowId, { focused: true })

  // Remove any remaining overlay
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const overlay = document.getElementById('jobjourney-scrape-overlay-container')
        if (overlay) overlay.remove()
      }
    })
  } catch (error) {
    console.error('Error removing overlay:', error)
  }

  return tab
}

export default {
  sendJobsToJobJourney,
  sendJobsAndShow,
  findJobMarketTab,
  showInJobJourney,
  setJobs,
  getJobs,
  clearJobs,
  setScrapingConfig,
  getScrapingConfig,
  getUIConfiguration
} 