import tabService from './tabService.js'
import messagingService, { MessageType } from './messagingService.js'

let storedJobs = [] // Store jobs in memory for showInJobJourney function

// Function to send jobs to JobJourney
async function sendJobsToJobJourney (jobs) {
  try {
    const tab = await tabService.ensureJobJourneyWebsite(true)

    // Send jobs to the page using messaging service
    console.log('Sending jobs to JobJourney tab using messaging service...')
    return messagingService.sendToTab(tab.id, MessageType.JOBS_SCRAPED, { jobs })
  } catch (error) {
    console.error('Error sending jobs to JobJourney:', error)
    throw error
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
        timestamp: Date.now()
      }
    })

    console.log('Jobs sent to JobJourney through port')

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
  console.log('22222:')
  storedJobs = [...jobs]
  console.log(`Stored ${storedJobs.length} jobs for later use`)
  return storedJobs.length
}

// Function to get stored jobs
function getJobs () {
  return storedJobs
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
async function sendJobsAndShow (scrapedJobs, baseUrl, jobsAlreadySent = false) {
  const manifest = chrome.runtime.getManifest()
  const url = `${baseUrl}/job-market?source=extension&version=${manifest.version}`

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
      await sendJobsToJobJourney(scrapedJobs)
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
        version: chrome.runtime.getManifest().version
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
  clearJobs
} 