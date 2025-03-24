import tabService from '../src/services/tabService.js'

// Find or create a JobJourney tab
export async function findOrCreateJobJourneyTab (version) {
  try {
    // Use tabService to find or create a JobJourney tab
    // Pass false to not focus the tab and pass the version
    const tab = await tabService.ensureJobJourneyWebsite(true, version)
    return tab
  } catch (error) {
    console.error("Error finding/creating JobJourney tab:", error)
    return null
  }
}

// Send version check message to tab instead of executing script
export function sendVersionCheckMessage (tab, version, requestId) {
  console.log('Sending version check message to tab:', tab.id, 'version:', version, 'requestId:', requestId)

  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tab.id, {
        action: 'VERSION_CHECK_REQUEST',
        data: {
          version,
          requestId
        }
      }, response => {
        if (chrome.runtime.lastError) {
          console.error("Error sending message to content script:", chrome.runtime.lastError)

          // Check if it's the "Receiving end does not exist" error
          if (chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
            console.log("Content script not ready. Refreshing the tab...")

            // Simply reload the tab to reinject content scripts
            chrome.tabs.reload(tab.id, {}, () => {
              console.log("Tab refreshed, content scripts should be reinjected")
              resolve({ success: true, refreshed: true })
            })
          } else {
            // Some other error
            resolve({ success: false, error: chrome.runtime.lastError.message })
          }
        } else {
          console.log("Message sent to content script, response:", response)
          resolve({ success: true, response })
        }
      })
    } catch (error) {
      console.error("Error in sendVersionCheckMessage:", error)
      reject(error)
    }
  })
} 