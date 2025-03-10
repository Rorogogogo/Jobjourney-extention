// Find or create a JobJourney tab
export async function findOrCreateJobJourneyTab (version) {
  try {
    // Try to find an existing tab
    const tabs = await chrome.tabs.query({
      url: [
        "*://jobjourney.me/job-market*",
        "http://localhost:5001/job-market*",
        "https://localhost:5001/job-market*"
      ]
    })

    if (tabs && tabs.length > 0) {
      console.log("Using existing JobJourney tab:", tabs[0].id)
      return tabs[0]
    }

    // Create a new tab
    console.log("No JobJourney tabs found, creating a new one")
    const baseUrl = getBaseUrl()
    const url = `${baseUrl}/job-market?source=extension&version=${version}`
    console.log("Opening JobJourney at:", url)

    const tab = await chrome.tabs.create({
      url: url,
      active: false // Don't focus it
    })

    // Wait for tab to load
    await new Promise((resolve) => {
      const listener = function (tabId, changeInfo) {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener)
          resolve()
        }
      }
      chrome.tabs.onUpdated.addListener(listener)
    })

    console.log("JobJourney tab loaded successfully:", tab.id)
    return tab
  } catch (error) {
    console.error("Error finding/creating JobJourney tab:", error)
    return null
  }
}

// Get base URL for JobJourney
function getBaseUrl () {
  return 'http://localhost:5001'
}

// Execute version check script in tab
export function executeVersionCheck (tab, version) {
  return chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (version) => {
      console.log('Sending version check from page context, version:', version)

      // Track version check in the page context
      if (typeof window._jobJourneyVersionCheckSent !== 'undefined') {
        console.log('Version check already sent, skipping duplicate')
        return true
      }

      // Mark that we've sent the check
      window._jobJourneyVersionCheckSent = true

      // Send message directly to window
      window.postMessage({
        type: 'VERSION_CHECK',
        source: 'JOBJOURNEY_EXTENSION',
        data: { version },
        timestamp: Date.now()
      }, '*')

      // Also try sendExtensionMessage if available
      if (typeof window.sendExtensionMessage === 'function') {
        try {
          window.sendExtensionMessage('VERSION_CHECK', { version })
        } catch (err) {
          console.error('Error using sendExtensionMessage:', err)
        }
      }

      return true
    },
    args: [version]
  })
} 