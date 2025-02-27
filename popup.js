import { supportedWebsites } from './websites.js'
import versionService from './src/services/versionService.js'
import tabService from './src/services/tabService.js'
import jobService from './src/services/jobService.js'
import scraperService from './src/services/scraperService.js'
import uiService from './src/services/uiService.js'
import storageService from './src/services/storageService.js'

// Move checkbox change handler outside DOMContentLoaded
const handleCheckboxChange = async (e) => {
  if (e.target.type === 'checkbox' && e.target.closest('.website-option')) {
    const newSettings = {}
    supportedWebsites.forEach(website => {
      const checkbox = document.getElementById(website.id)
      if (checkbox) {
        newSettings[website.id] = checkbox.checked
      }
    })
    await storageService.saveWebsiteSettings(newSettings)
    const statusMessage = document.getElementById('statusMessage')
    if (statusMessage) {
      uiService.showMessage(statusMessage, 'Settings saved')
    }
  }
}

// Function to update location options based on country selection
function updateLocationOptions (country) {
  const locationSelect = document.getElementById('location')
  const templateId = {
    'United States': 'usLocations',
    'Australia': 'australiaLocations',
    'United Kingdom': 'ukLocations',
    'Canada': 'canadaLocations',
    'New Zealand': 'newZealandLocations'
  }[country]

  // Clear current options except the first one
  while (locationSelect.options.length > 1) {
    locationSelect.remove(1)
  }

  if (templateId) {
    const template = document.getElementById(templateId)
    const options = template.content.cloneNode(true)
    locationSelect.appendChild(options)
    locationSelect.disabled = false
  } else {
    locationSelect.disabled = true
  }

  // Update website options based on country
  const websiteOptions = document.getElementById('websiteOptions')
  websiteOptions.innerHTML = '' // Clear current options

  // LinkedIn is always available
  const linkedinDiv = document.createElement('div')
  linkedinDiv.className = 'website-option'
  linkedinDiv.innerHTML = `
    <label>
      <input type="checkbox" 
             id="linkedin" 
             checked>
      LinkedIn
    </label>
  `
  websiteOptions.appendChild(linkedinDiv)

  // Indeed is always available
  const indeedDiv = document.createElement('div')
  indeedDiv.className = 'website-option'
  indeedDiv.innerHTML = `
    <label>
      <input type="checkbox" 
             id="indeed" 
             checked>
      Indeed ${country ? `(${country})` : ''}
    </label>
  `
  websiteOptions.appendChild(indeedDiv)

  // SEEK is available for Australia and New Zealand
  if (country === 'Australia' || country === 'New Zealand') {
    const seekDiv = document.createElement('div')
    seekDiv.className = 'website-option'
    seekDiv.innerHTML = `
      <label>
        <input type="checkbox" 
               id="seek" 
               checked>
        SEEK ${country === 'New Zealand' ? 'NZ' : ''}
      </label>
    `
    websiteOptions.appendChild(seekDiv)
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM Content Loaded')

  // Check version immediately when popup opens
  const versionCheck = await versionService.checkVersion(false)
  if (!versionCheck.isCompatible || versionCheck.requireUpdate) {
    versionService.showUpdateUI({
      currentVersion: versionCheck.currentVersion,
      minimumVersion: versionCheck.minimumVersion,
      message: versionCheck.message
    })
    return // Stop further initialization if version is incompatible
  }

  const locationInput = document.getElementById('location')
  const searchBtn = document.getElementById('searchBtn')
  const scrapeBtn = document.getElementById('scrapeBtn')
  const showInJobJourneyBtn = document.getElementById('showInJobJourneyBtn')
  const jobList = document.getElementById('jobList')
  const statusMessage = document.getElementById('statusMessage')
  const progressSection = document.getElementById('progressSection')
  const progressFill = document.getElementById('progressFill')
  const progressText = document.getElementById('progressText')
  const progressDetail = document.getElementById('progressDetail')
  const overlay = document.getElementById('overlay')
  const overlayText = document.getElementById('overlayText')
  const overlayDetail = document.getElementById('overlayDetail')
  const websiteOptions = document.getElementById('websiteOptions')
  const countrySelect = document.getElementById('country')
  const locationSelect = document.getElementById('location')

  console.log('websiteOptions element:', websiteOptions)
  console.log('supportedWebsites:', supportedWebsites)

  let scrapedJobs = []

  // Add country change handler
  countrySelect.addEventListener('change', (e) => {
    const country = e.target.value
    updateLocationOptions(country)
    // Save the country selection
    if (country) {
      storageService.saveLastCountry(country)
    }
  })

  // Load last used country and location
  const [lastCountry, lastLocation] = await Promise.all([
    storageService.loadLastCountry(),
    storageService.loadLastLocation()
  ])

  // First set the country and update location options
  if (lastCountry) {
    countrySelect.value = lastCountry
    updateLocationOptions(lastCountry)
  } else {
    // If no country is selected, initialize with empty website options
    updateLocationOptions('')
  }

  // Then set the location if it exists
  if (lastLocation) {
    locationSelect.value = lastLocation
  }

  // Load saved settings
  const savedSettings = await storageService.loadWebsiteSettings()
  console.log('savedSettings:', savedSettings)

  // Add the change event listener to the websiteOptions container
  if (websiteOptions) {
    websiteOptions.addEventListener('change', handleCheckboxChange)
  }

  // Update show in JobJourney button handler
  showInJobJourneyBtn.addEventListener('click', async () => {
    console.log('Show in JobJourney button clicked')
    console.log('Jobs to send:', scrapedJobs)

    try {
      const response = await jobService.sendJobsToJobJourney(scrapedJobs)
      console.log('Response from sendJobsToJobJourney:', response)

      if (response && response.success) {
        uiService.showMessage(statusMessage, 'Jobs sent to JobJourney successfully')

        // Get base URL and show jobs
        const baseUrl = await chrome.runtime.sendMessage({ action: 'getBaseUrl' })
        if (!baseUrl) {
          throw new Error('Failed to get JobJourney URL')
        }

        await jobService.sendJobsAndShow(scrapedJobs, baseUrl)
      } else {
        uiService.showMessage(statusMessage, response.message || 'Failed to send jobs to JobJourney', true)
        console.error('Failed to send jobs to JobJourney:', response)
      }
    } catch (error) {
      console.error('Error sending jobs to JobJourney:', error)
      uiService.showMessage(statusMessage, 'Error sending jobs to JobJourney', true)
    }
  })

  // Update search button click handler
  searchBtn.addEventListener('click', async () => {
    const locationSelect = document.getElementById('location')
    const searchInput = document.getElementById('searchInput')
    const countrySelect = document.getElementById('country')
    const location = locationSelect.value.trim()
    const searchTerm = searchInput.value.trim()
    const country = countrySelect.value.trim()

    // Get the current extension window
    const currentWindow = await chrome.windows.getCurrent()

    if (!location) {
      uiService.showMessage(statusMessage, 'Please select a location', true)
      return
    }

    if (!searchTerm) {
      uiService.showMessage(statusMessage, 'Please enter search keywords', true)
      return
    }

    console.log('=== Starting Job Search ===')
    console.log('Search Term:', searchTerm)
    console.log('Location:', location)
    console.log('Country:', country)

    // Send scraping started message to frontend
    await tabService.ensureJobJourneyWebsite().then(tab => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (message) => {
          window.postMessage(message, '*')
        },
        args: [{
          type: 'SCRAPING_STATUS',
          data: {
            status: 'started',
            message: 'Started scraping jobs'
          }
        }]
      })
    })

    // Show overlay and disable interaction
    uiService.showOverlay(overlay, true)

    // Save location and country to storage
    await Promise.all([
      storageService.saveLastLocation(location),
      storageService.saveLastCountry(country)
    ])

    // Reset state
    scrapedJobs = []
    jobList.innerHTML = ''

    // Show progress section
    progressSection.style.display = 'block'
    uiService.updateProgress(progressFill, progressText, overlayText, progressDetail, overlayDetail, 0, 'Starting job search...')

    try {
      // Clear any existing scraping state at the start
      await storageService.updateScrapingState(false)

      // Get current website settings
      const savedSettings = await storageService.loadWebsiteSettings()
      console.log('Current website settings:', savedSettings)

      // Get sites to scrape based on checkbox selection
      const sites = scraperService.createJobSearchUrls(searchTerm, location)
        .filter(site => {
          const checkbox = document.getElementById(site.id)
          return checkbox && checkbox.checked
        })

      if (sites.length === 0) {
        uiService.showMessage(statusMessage, 'Please select at least one website', true)
        progressSection.style.display = 'none'
        uiService.showOverlay(overlay, false)
        return
      }

      console.log('Sites to scrape after filtering:', sites)
      let completedSites = 0
      const totalSites = sites.length

      // Get all windows to find the main browser window
      const windows = await chrome.windows.getAll({ windowTypes: ['normal'] })
      console.log('Found browser windows:', windows.length)

      const mainWindow = windows.find(w => w.type === 'normal')
      if (!mainWindow) {
        throw new Error('Could not find main browser window')
      }

      for (const site of sites) {
        console.log(`\n=== Processing ${site.platform} ===`)
        const progress = (completedSites / totalSites) * 100
        uiService.updateProgress(
          progressFill,
          progressText,
          overlayText,
          progressDetail,
          overlayDetail,
          progress,
          `Scraping ${site.platform}...`,
          `Starting scrape for ${site.platform}`
        )

        const tab = await chrome.tabs.create({
          url: site.url,
          windowId: mainWindow.id,
          active: true
        })

        // Add tab close listener
        const tabClosedPromise = new Promise(resolve => {
          const listener = (tabId) => {
            if (tabId === tab.id) {
              chrome.tabs.onRemoved.removeListener(listener)
              resolve()
            }
          }
          chrome.tabs.onRemoved.addListener(listener)
        })

        try {
          await scraperService.waitForPageLoad(tab.id)

          // Race between scraping and tab closure
          const jobs = await Promise.race([
            scraperService.scrapeWithPagination(tab, site.platform, (currentPage) => {
              uiService.updateProgress(
                progressFill,
                progressText,
                overlayText,
                progressDetail,
                overlayDetail,
                progress,
                `Scraping ${site.platform}...`,
                `Processing page ${currentPage} in ${site.platform}`
              )
            }),
            tabClosedPromise.then(async () => {
              console.log(`Tab closed for ${site.platform}`)
              // Clear scraping state if tab is closed
              await storageService.updateScrapingState(false)
              return [] // Return empty array if tab was closed
            })
          ])

          scrapedJobs.push(...jobs)
          completedSites++
          const progressPercent = (completedSites / totalSites) * 100
          uiService.updateProgress(
            progressFill,
            progressText,
            overlayText,
            progressDetail,
            overlayDetail,
            progressPercent,
            `Completed ${site.platform}`,
            `Found ${jobs.length} jobs from ${site.platform}`
          )
          uiService.showMessage(statusMessage, `Scraped ${jobs.length} jobs from ${site.platform}`)

          // Update UI
          jobList.innerHTML = ''
          scrapedJobs.forEach(job => {
            jobList.appendChild(uiService.createJobCard(job))
          })
        } catch (error) {
          console.error(`Error processing ${site.platform}:`, error)
          // Clear scraping state on error
          await storageService.updateScrapingState(false)
          completedSites++
        }
      }

      console.log('=== Scraping Complete ===')
      console.log('Total jobs scraped:', scrapedJobs.length)
      uiService.updateProgress(
        progressFill,
        progressText,
        overlayText,
        progressDetail,
        overlayDetail,
        100,
        `Scraping Complete!`,
        `Found ${scrapedJobs.length} jobs from ${totalSites} sites`
      )
      uiService.showMessage(statusMessage, `Successfully scraped ${scrapedJobs.length} jobs!`)
      uiService.updateButtonStates(showInJobJourneyBtn, scrapedJobs.length > 0)

      // Send scraping completed message to frontend
      await tabService.ensureJobJourneyWebsite().then(tab => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (message) => {
            window.postMessage(message, '*')
          },
          args: [{
            type: 'SCRAPING_STATUS',
            data: {
              status: 'completed',
              message: `Found ${scrapedJobs.length} jobs`,
              totalJobs: scrapedJobs.length
            }
          }]
        })
      })

      // Automatically trigger show in JobJourney if jobs were found
      if (scrapedJobs.length > 0) {
        try {
          const response = await jobService.sendJobsToJobJourney(scrapedJobs)
          console.log('Auto-sending jobs to JobJourney:', response)

          if (response && response.success) {
            uiService.showMessage(statusMessage, 'Jobs sent to JobJourney successfully')
            // No need to get base URL or show jobs again since they're already sent and shown
          } else {
            console.error('Failed to auto-send jobs to JobJourney:', {
              success: response?.success,
              message: response?.message,
              fullResponse: JSON.stringify(response, null, 2)
            })
            uiService.showMessage(statusMessage, `Failed to send jobs: ${response?.message || 'Unknown error'}`, true)
          }
        } catch (error) {
          console.error('Error auto-sending jobs to JobJourney:', {
            message: error.message,
            stack: error.stack,
            fullError: JSON.stringify(error, null, 2)
          })
          uiService.showMessage(statusMessage, `Error sending jobs: ${error.message || 'Unknown error'}`, true)
        }
      }

    } catch (error) {
      console.error('Error during scraping:', error)
      uiService.showMessage(statusMessage, 'An error occurred during scraping', true)
      uiService.updateProgress(progressFill, progressText, overlayText, progressDetail, overlayDetail, 0, 'Scraping failed', error.message)
    } finally {
      // Clear scraping state and clean up
      await storageService.updateScrapingState(false)
      uiService.showOverlay(overlay, false)
      // Focus back on the extension window at the end
      chrome.windows.update(currentWindow.id, { focused: true })
    }
  })
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Popup received message:', request)

  if (request.action === 'START_SCRAPING') {
    const data = request.data

    // Set search input
    const searchInput = document.getElementById('searchInput')
    if (searchInput) searchInput.value = data.jobTitle

    // Set country
    console.log('Setting country:', data.country)
    const countrySelect = document.getElementById('country')
    if (countrySelect) {
      countrySelect.value = data.country
      // Trigger change event to update location options
      countrySelect.dispatchEvent(new Event('change'))
    }

    // Wait for location options to update
    setTimeout(() => {
      // Set location
      const locationSelect = document.getElementById('location')
      if (locationSelect) locationSelect.value = `${data.city}`

      // First uncheck all checkboxes
      const checkboxes = document.querySelectorAll('.website-option input[type="checkbox"]')
      checkboxes.forEach(checkbox => {
        checkbox.checked = false
      })

      // Then only check the platforms we want
      console.log('Setting platforms:', data.platforms)
      data.platforms.forEach(platform => {
        const checkbox = document.getElementById(platform.toLowerCase())
        console.log('Setting checkbox for platform:', platform, checkbox)
        if (checkbox) checkbox.checked = true
      })

      // Trigger search button click
      const searchBtn = document.getElementById('searchBtn')
      if (searchBtn) searchBtn.click()

      sendResponse({ success: true })
    }, 500)

    return true // Keep the message channel open for the async response
  }

  // Remove the auto-send trigger for JOBS_RECEIVED_RESPONSE since it's just a confirmation
  if (request.action === 'JOBS_RECEIVED_RESPONSE') {
    console.log('Received jobs response confirmation:', request.data)
    return true
  }
})

// Update message listener in content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request)

  if (request.action === 'getNextPageUrl') {
    const platform = Object.values(scrapers).find(s => s.isMatch(window.location.href))
    if (platform && platform.getNextPageUrl) {
      const nextUrl = platform.getNextPageUrl()
      sendResponse({ nextUrl })
    } else {
      sendResponse({ nextUrl: null })
    }
    return true
  }

  // ... existing message handling code ...
}) 
