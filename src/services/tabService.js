// Import config
import config from '../config/config.js'

/**
 * Find a JobJourney tab that matches our criteria
 * @returns {Promise<chrome.tabs.Tab|null>} The found tab or null
 */
async function findJobJourneyTab () {
  // Use a broader URL pattern similar to versionCheck.js
  const tabs = await chrome.tabs.query({
    url: [
      "*://jobjourney.me/job-market*",
      "http://localhost:5001/job-market*",
      "https://localhost:5001/job-market*"
    ]
  })

  return tabs.length > 0 ? tabs[0] : null
}

/**
 * Ensure a JobJourney website tab is open
 * @param {boolean} shouldFocusTab - Whether to focus the tab
 * @param {string} [version] - Optional version to include in URL
 * @returns {Promise<chrome.tabs.Tab>} The tab
 */
async function ensureJobJourneyWebsite (shouldFocusTab = true, version) {
  console.log("ensureJobJourneyWebsite, focus:", shouldFocusTab)

  try {
    // Try to find an existing tab
    const existingTab = await findJobJourneyTab()

    if (existingTab) {
      console.log("Using existing JobJourney tab:", existingTab.id)

      // Optionally focus the existing tab
      if (shouldFocusTab) {
        await chrome.tabs.update(existingTab.id, { active: true })
      }

      return existingTab
    }

    // No existing tab, create a new one
    console.log("No JobJourney tabs found, creating a new one")

    // Get base URL from config
    const baseUrl = await config.getBaseUrl()

    // Get version from parameter or manifest
    const versionToUse = version || chrome.runtime.getManifest().version

    const url = `${baseUrl}/job-market?source=extension&version=${versionToUse}`
    console.log("Opening JobJourney at:", url)

    // Create the tab
    const tab = await chrome.tabs.create({
      url: url,
      active: shouldFocusTab // Control whether tab is focused
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
    console.error("Error ensuring JobJourney website:", error)
    throw error
  }
}

export default {
  findJobJourneyTab,
  ensureJobJourneyWebsite
} 