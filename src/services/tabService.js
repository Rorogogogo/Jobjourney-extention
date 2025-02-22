// Function to check if JobJourney tab exists and is ready
async function findJobJourneyTab () {
  const tabs = await chrome.tabs.query({})
  return tabs.find(tab =>
    tab.url && (
      tab.url.includes('jobjourney.me/job-market?source=extension') ||
      tab.url.includes('localhost:5001/job-market?source=extension')
    )
  )
}

// Function to ensure JobJourney website is open
async function ensureJobJourneyWebsite (shouldFocusPopup = true) {
  console.group('ensureJobJourneyWebsite')
  try {
    const existingTab = await findJobJourneyTab()
    console.log('Existing JobJourney tab:', existingTab)

    if (!existingTab) {
      console.log('No existing tab found, creating new tab')
      try {
        // Get base URL and open new tab
        const baseUrl = await chrome.runtime.sendMessage({ action: 'getBaseUrl' })
        console.log('Got base URL:', baseUrl)

        if (!baseUrl) {
          throw new Error('Failed to get JobJourney URL - base URL is undefined')
        }

        const manifest = chrome.runtime.getManifest()
        const url = `${baseUrl}/job-market?source=extension&version=${manifest.version}`
        console.log('Opening JobJourney URL:', url)

        const tab = await chrome.tabs.create({
          url: url,
          active: true
        })
        console.log('Created new tab:', tab)

        // Wait for tab to load
        console.log('Waiting for tab to load...')
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener)
            reject(new Error('Timeout waiting for tab to load'))
          }, 10000) // 10 second timeout

          const listener = function (tabId, info) {
            console.log('Tab update event:', { tabId, info })
            if (tabId === tab.id && info.status === 'complete') {
              console.log('Tab loaded successfully')
              chrome.tabs.onUpdated.removeListener(listener)
              clearTimeout(timeout)
              setTimeout(() => {
                if (shouldFocusPopup) {
                  // Get the popup window and focus it
                  chrome.windows.getCurrent(window => {
                    chrome.windows.update(window.id, { focused: true })
                  })
                }
                resolve(tab)
              }, 1000) // Give extra time for scripts to initialize
            }
          }
          chrome.tabs.onUpdated.addListener(listener)
        })
        console.log('Tab fully loaded')
        return tab
      } catch (error) {
        console.error('Error ensuring JobJourney website:', error)
        throw error // Re-throw to be handled by caller
      }
    }
    console.log('Using existing tab')
    return existingTab
  } finally {
    console.groupEnd()
  }
}

export default {
  findJobJourneyTab,
  ensureJobJourneyWebsite
} 