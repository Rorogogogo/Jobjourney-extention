import uiService from './uiService.js'
import jobService from './jobService.js'
import jobSearchService from './jobSearchService.js'
import storageService from './storageService.js'

/**
 * Set up all event listeners for UI elements
 * @param {Object} elements Object containing UI elements
 */
function setupEventListeners (elements) {
  const {
    countrySelect,
    searchBtn,
    clearBtn,
    showInJobJourneyBtn
  } = elements

  // Set up country change handler
  if (countrySelect) {
    console.log('Setting up country change handler')

    // Remove any existing event listeners to prevent duplicates
    countrySelect.removeEventListener('change', () => { })

    // Add new change event listener with logging
    countrySelect.addEventListener('change', (event) => {
      const selectedCountry = countrySelect.value
      console.log(`Country changed to: "${selectedCountry}"`)
      uiService.updateLocationOptions(elements, selectedCountry)
    })

    // Also trigger immediately if a country is already selected
    if (countrySelect.value) {
      console.log(`Initial country value: "${countrySelect.value}", triggering update`)
      uiService.updateLocationOptions(elements, countrySelect.value)
    }
  } else {
    console.warn('Country select element not found')
  }

  // Set up search button click handler
  if (searchBtn) {
    searchBtn.addEventListener('click', () => handleSearch(elements))
  }

  // Set up clear button handler
  if (clearBtn) {
    clearBtn.addEventListener('click', () => handleClear(elements))
  }

  // Set up show in JobJourney button
  if (showInJobJourneyBtn) {
    showInJobJourneyBtn.addEventListener('click', () => handleShowInJobJourney(elements))
  }

  // Set up website option checkboxes
  document.addEventListener('change', event => {
    if (event.target.type === 'checkbox' && event.target.closest('.website-option')) {
      handleCheckboxChange(event)
    }
  })
}

/**
 * Handle search button click
 * @param {Object} elements UI elements
 */
async function handleSearch (elements) {
  // Validate the form first
  const validation = uiService.validateSearchForm(elements)
  if (!validation.isValid) {
    return // Error message already shown by validateSearchForm
  }

  const { searchInputValue, countryValue, locationValue, selectedPlatforms } = validation.values

  // Show the progress UI
  uiService.showProgress(elements, true)

  try {
    // Create a progress callback function
    const progressCallback = (percent, text, detail) => {
      uiService.updateProgress(
        elements.progressFill,
        elements.progressText,
        elements.overlayText,
        elements.progressDetail,
        elements.overlayDetail,
        percent,
        text,
        detail
      )
    }

    // Use the jobSearchService to search for jobs
    const jobs = await jobSearchService.searchJobs(
      searchInputValue,
      locationValue,
      selectedPlatforms,
      progressCallback
    )

    // Display the jobs
    uiService.displayJobs(elements, jobs)

    // Show success message
    if (elements.statusMessage) {
      uiService.showMessage(
        elements.statusMessage,
        jobSearchService.generateSearchSummary(jobs, selectedPlatforms)
      )
    }

  } catch (error) {
    console.error('Error during job search:', error)
    if (elements.statusMessage) {
      uiService.showMessage(elements.statusMessage, `Error: ${error.message}`, true)
    }
  } finally {
    // Hide progress UI
    uiService.showProgress(elements, false)
  }
}

/**
 * Handle clear button click
 * @param {Object} elements UI elements
 */
function handleClear (elements) {
  const { searchInput, jobResults, resultCount, showInJobJourneyBtn } = elements

  // Clear search input
  if (searchInput) searchInput.value = ''

  // Clear job results
  if (jobResults) jobResults.innerHTML = ''

  // Update result count
  if (resultCount) resultCount.textContent = '0 jobs found'

  // Disable show in JobJourney button
  if (showInJobJourneyBtn) showInJobJourneyBtn.disabled = true

  // Clear jobs from service
  jobService.clearJobs()
}

/**
 * Handle show in JobJourney button click
 * @param {Object} elements UI elements
 */
async function handleShowInJobJourney (elements) {
  const { statusMessage } = elements

  try {
    await jobService.showInJobJourney()
    if (statusMessage) {
      uiService.showMessage(statusMessage, 'Jobs opened in JobJourney')
    }
  } catch (error) {
    console.error('Error showing jobs in JobJourney:', error)
    if (statusMessage) {
      uiService.showMessage(statusMessage, `Error: ${error.message}`, true)
    }
  }
}

/**
 * Handle checkbox change for website options
 * @param {Event} event Change event
 */
function handleCheckboxChange (event) {
  // Save website preferences
  const newSettings = {}
  document.querySelectorAll('.website-option input[type="checkbox"]').forEach(checkbox => {
    newSettings[checkbox.id] = checkbox.checked
  })

  // Save settings
  storageService.saveWebsiteSettings({ websitePreferences: newSettings })
}

/**
 * Load saved preferences from storage
 * @param {Object} elements UI elements
 */
async function loadSavedPreferences (elements) {
  const { countrySelect, locationSelect } = elements

  try {
    // Load country and location separately
    const [lastCountry, lastLocation, websiteSettings] = await Promise.all([
      storageService.loadLastCountry(),
      storageService.loadLastLocation(),
      storageService.loadWebsiteSettings()
    ])

    // Set country if saved
    if (lastCountry && countrySelect) {
      countrySelect.value = lastCountry
      // Trigger the change event to update location options
      const event = new Event('change')
      countrySelect.dispatchEvent(event)
    }

    // Set location if saved (after locations have been populated)
    if (lastLocation && locationSelect) {
      setTimeout(() => {
        locationSelect.value = lastLocation
      }, 100)
    }

    // Load website preferences
    if (websiteSettings.websitePreferences) {
      Object.entries(websiteSettings.websitePreferences).forEach(([id, checked]) => {
        const checkbox = document.getElementById(id)
        if (checkbox) checkbox.checked = checked
      })
    }
  } catch (error) {
    console.error('Error loading saved preferences:', error)
  }
}

export default {
  setupEventListeners,
  handleSearch,
  handleClear,
  handleShowInJobJourney,
  handleCheckboxChange,
  loadSavedPreferences
} 