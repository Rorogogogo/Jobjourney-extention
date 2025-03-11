import tabService from '../src/services/tabService.js'

// Find or create a JobJourney tab
export async function findOrCreateJobJourneyTab (version) {
  try {
    // Use tabService to find or create a JobJourney tab
    // Pass false to not focus the tab and pass the version
    const tab = await tabService.ensureJobJourneyWebsite(false, version)
    return tab
  } catch (error) {
    console.error("Error finding/creating JobJourney tab:", error)
    return null
  }
}

// Execute version check script in tab
export function executeVersionCheck (tab, version) {
  return chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (version) => {
      console.log('Sending version check from page context, version:', version)



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