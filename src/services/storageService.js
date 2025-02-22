// Function to load last used location
async function loadLastLocation () {
  return new Promise((resolve) => {
    chrome.storage.local.get(['lastLocation', 'lastCountry'], (result) => {
      resolve(result.lastLocation || null)
    })
  })
}

// Function to save last used location
async function saveLastLocation (location) {
  const country = location.split(', ').pop() // Get country from full location
  return chrome.storage.local.set({
    lastLocation: location,
    lastCountry: country
  })
}

// Function to load last used country
async function loadLastCountry () {
  return new Promise((resolve) => {
    chrome.storage.local.get(['lastCountry'], (result) => {
      resolve(result.lastCountry || null)
    })
  })
}

// Function to load website settings
async function loadWebsiteSettings () {
  const settings = await chrome.storage.sync.get('websiteSettings')
  return settings.websiteSettings || {}
}

// Function to save website settings
async function saveWebsiteSettings (newSettings) {
  return chrome.storage.sync.set({ websiteSettings: newSettings })
}

// Function to update scraping state
async function updateScrapingState (isActive) {
  return chrome.storage.local.set({ isScrapingActive: isActive })
}

export default {
  loadLastLocation,
  saveLastLocation,
  loadLastCountry,
  loadWebsiteSettings,
  saveWebsiteSettings,
  updateScrapingState
} 