import tabService from './tabService.js'

// Function to send jobs to JobJourney
async function sendJobsToJobJourney (jobs) {
  try {
    const tab = await tabService.ensureJobJourneyWebsite()

    // Send jobs to the page using executeScript
    console.log('Sending jobs to JobJourney tab...')
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (message) => {
        console.log('Executing in JobJourney tab, sending jobs:', message)
        window.postMessage(message, '*')
      },
      args: [{
        type: 'sendJobs',
        data: {
          jobs: jobs
        }
      }]
    })

    // Wait for response
    const response = await new Promise((resolve) => {
      let timeoutId = setTimeout(() => {
        console.log('Send jobs timed out')
        resolve({ success: false, message: 'Send jobs timed out' })
      }, 5000)

      // Listen for response from both content script and background
      const messageListener = (message) => {
        if (message.action === 'JOBS_RECEIVED_RESPONSE') {
          console.log('Received jobs response in service:', message)
          clearTimeout(timeoutId)
          chrome.runtime.onMessage.removeListener(messageListener)
          resolve(message.data)
        }
      }
      chrome.runtime.onMessage.addListener(messageListener)

      // Also set up message listener in the JobJourney tab as backup
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return new Promise((resolve) => {
            const handler = (event) => {
              if (event.source !== window) return
              if (event.data.type === 'JOBS_RECEIVED_RESPONSE') {
                window.removeEventListener('message', handler)
                resolve(event.data)
              }
            }
            window.addEventListener('message', handler)
          })
        }
      }).then(([result]) => {
        if (result?.result?.data) {
          console.log('Jobs received response from content script:', result.result.data)
          clearTimeout(timeoutId)
          chrome.runtime.onMessage.removeListener(messageListener)
          resolve(result.result.data)
        }
      }).catch(error => {
        console.error('Error in send jobs script:', error)
        // Don't resolve here, let the message listener or timeout handle it
      })
    })

    if (response.success) {
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

      // Focus the tab and window
      await chrome.tabs.update(tab.id, { active: true })
      await chrome.windows.update(tab.windowId, { focused: true })
    }

    return response
  } catch (error) {
    console.error('Error sending jobs:', error)
    return { success: false, message: error.message }
  }
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
  if (!jobsAlreadySent) {
    // Send jobs to the JobJourney page
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (message) => {
        console.log('Sending jobs to JobJourney page:', message)
        window.postMessage(message, '*')
      },
      args: [{
        type: 'sendJobs',
        data: {
          jobs: scrapedJobs
        }
      }]
    })

    // Wait for jobs to be processed while keeping focus
    await new Promise(resolve => setTimeout(resolve, 1000))
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
  findJobMarketTab
} 