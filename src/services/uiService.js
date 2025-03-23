// Import required services if needed
import storageService from './storageService.js'
import jobService from './jobService.js'
import scraperService from './scraperService.js'
import messagingService, { MessageType } from './messagingService.js'

/**
 * Show a status message to the user
 * @param {HTMLElement} statusMessage Status message element
 * @param {string} message Message to show
 * @param {boolean} isError Whether the message is an error
 */
function showMessage (statusMessage, message, isError = false) {
  statusMessage.textContent = message
  statusMessage.className = `status-message ${isError ? 'error' : 'success'}`
  statusMessage.style.display = 'block'
  setTimeout(() => {
    statusMessage.style.display = 'none'
  }, 2000)
}

/**
 * Show or hide an overlay
 * @param {HTMLElement} overlay Overlay element
 * @param {boolean} show Whether to show or hide the overlay
 */
function showOverlay (overlay, show) {
  overlay.style.display = show ? 'flex' : 'none'
  // Disable all interactive elements when overlay is shown
  const interactiveElements = document.querySelectorAll('button, input, select')
  interactiveElements.forEach(element => {
    element.disabled = show
  })
}

/**
 * Update progress indicators
 * @param {HTMLElement} progressFill Progress bar fill element
 * @param {HTMLElement} progressText Progress text element
 * @param {HTMLElement} overlayText Overlay text element
 * @param {HTMLElement} progressDetail Progress detail element 
 * @param {HTMLElement} overlayDetail Overlay detail element
 * @param {number} percent Progress percentage (0-100)
 * @param {string} text Progress text
 * @param {string} detail Optional detail text
 */
function updateProgress (progressFill, progressText, overlayText, progressDetail, overlayDetail, percent, text, detail) {
  progressFill.style.width = `${percent}%`
  progressText.textContent = text
  if (detail) {
    progressDetail.textContent = detail
    overlayDetail.textContent = detail
  }
  overlayText.textContent = text
}

/**
 * Populate the country selector dropdown with available countries
 * @param {HTMLSelectElement} countrySelect The country select element
 */
function populateCountrySelector (countrySelect) {
  if (!countrySelect) {
    console.warn('Cannot populate country selector - element not found')
    return
  }

  console.log('Populating country selector')

  // Add default option
  countrySelect.innerHTML = '<option value="">Select Country</option>'

  // Add countries
  const countries = [
    'Australia',
    'Canada',
    'New Zealand',
    'United Kingdom',
    'United States'
  ]

  countries.forEach(country => {
    const option = document.createElement('option')
    option.value = country
    option.textContent = country
    countrySelect.appendChild(option)
  })

  console.log(`Country selector populated with ${countries.length} options`)
}

/**
 * Get all UI elements needed for the panel
 * @returns {Object} Object containing all UI element references
 */
function getUIElements () {
  const elements = {
    searchForm: document.getElementById('searchForm'),
    searchInput: document.getElementById('searchInput'),
    countrySelect: document.getElementById('country'),
    locationSelect: document.getElementById('location'),
    websiteOptions: document.getElementById('websiteOptions'),
    searchBtn: document.getElementById('searchBtn'),
    clearBtn: document.getElementById('clearBtn'),
    showInJobJourneyBtn: document.getElementById('showInJobJourneyBtn'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    progressDetail: document.getElementById('progressDetail'),
    scrapingOverlay: document.getElementById('overlay'),
    overlayText: document.getElementById('overlayText'),
    overlayDetail: document.getElementById('overlayDetail'),
    jobResults: document.getElementById('jobList'),
    statusMessage: document.getElementById('statusMessage'),
    resultCount: document.getElementById('resultCount'),
    progressSection: document.getElementById('progressSection')
  }

  // Add debug logging to check if elements were found
  console.log('UI Elements found:', {
    countrySelect: !!elements.countrySelect,
    locationSelect: !!elements.locationSelect,
    websiteOptions: !!elements.websiteOptions
  })

  return elements
}

/**
 * Initialize all UI elements
 * @param {Function} setupEventListenersCallback Function to set up event listeners with UI elements
 * @param {Function} loadSavedPreferencesCallback Function to load saved preferences
 * @returns {Object} UI elements
 */
function initializeUI (setupEventListenersCallback, loadSavedPreferencesCallback) {
  console.log('Initializing UI')

  // Get UI elements
  const elements = getUIElements()

  // Check if critical elements were found
  const criticalElements = ['countrySelect', 'locationSelect', 'websiteOptions']
  const missingElements = criticalElements.filter(elementName => !elements[elementName])

  if (missingElements.length > 0) {
    console.error(`Missing critical UI elements: ${missingElements.join(', ')}`)
    console.warn('UI initialization may not work correctly')
  }

  // Set up event listeners using the provided callback
  if (setupEventListenersCallback) {
    setupEventListenersCallback(elements)
  }

  // Initialize country selector
  populateCountrySelector(elements.countrySelect)

  // Show default website options even if no country is selected
  updateWebsiteOptions(elements, '')

  // Load any saved preferences
  if (loadSavedPreferencesCallback) {
    loadSavedPreferencesCallback(elements)
  }

  // Initialize jobs display
  refreshJobDisplay(elements)

  console.log('UI initialization completed')

  return elements
}

/**
 * Update location options based on selected country
 * @param {Object} elements UI elements
 * @param {string} country Selected country
 */
function updateLocationOptions (elements, country) {
  const { locationSelect, websiteOptions } = elements

  console.log(`Updating locations for country: "${country}"`)

  if (!locationSelect) {
    console.warn('locationSelect not found')
    return
  }

  // Clear existing options
  locationSelect.innerHTML = '<option value="">Select Location</option>'
  locationSelect.disabled = true // Start disabled, enable if we find options

  if (!country) {
    console.log('No country selected, locations remain disabled')
    // Still update website options with empty country
    updateWebsiteOptions(elements, country)
    return
  }

  // Map country names to template IDs
  const templateMap = {
    'United States': 'usLocations',
    'Australia': 'australiaLocations',
    'United Kingdom': 'ukLocations',
    'Canada': 'canadaLocations',
    'New Zealand': 'newzealandLocations'
  }

  const templateId = templateMap[country]
  console.log(`Looking for template with ID: ${templateId}`)

  if (templateId) {
    const template = document.getElementById(templateId)
    if (template) {
      console.log(`Template found for ${country}`)
      const options = template.content.cloneNode(true)
      locationSelect.appendChild(options)
      locationSelect.disabled = false
    } else {
      console.warn(`Template not found for ID: ${templateId}`)
    }
  } else {
    console.warn(`No template mapping for country: ${country}`)
  }

  // Always update website options when country changes
  console.log(`Updating website options for country: ${country}`)
  updateWebsiteOptions(elements, country)
}

/**
 * Update website options based on selected country
 * @param {Object} elements UI elements
 * @param {string} country Selected country
 */
function updateWebsiteOptions (elements, country) {
  const { websiteOptions } = elements

  if (!websiteOptions) {
    console.warn('Cannot update website options - websiteOptions not found')
    return
  }

  websiteOptions.innerHTML = '' // Clear current options

  // Always show these platforms regardless of country selection

  // LinkedIn is always available
  addWebsiteOption(websiteOptions, 'linkedin', 'LinkedIn', true)

  // Indeed is always available (with or without country specification)
  addWebsiteOption(websiteOptions, 'indeed', `Indeed ${country ? `(${country})` : ''}`, true)

  // Only show country-specific platforms when a country is selected
  if (country) {
    // SEEK is available for Australia and New Zealand
    if (country === 'Australia' || country === 'New Zealand') {
      addWebsiteOption(websiteOptions, 'seek', `SEEK ${country}`, true)
    }

    // Reed is removed per client request
  }
}

/**
 * Add a website checkbox option to the container
 * @param {HTMLElement} container Container element
 * @param {string} id Website ID
 * @param {string} label Website label
 * @param {boolean} checked Whether it should be checked by default
 */
function addWebsiteOption (container, id, label, checked = false) {
  const websiteDiv = document.createElement('div')
  websiteDiv.className = 'website-option'
  websiteDiv.innerHTML = `
    <label>
      <input type="checkbox" 
             id="${id}" 
             ${checked ? 'checked' : ''}>
      ${label}
    </label>
  `
  container.appendChild(websiteDiv)
}

/**
 * Display jobs in the results section
 * @param {Object} elements UI elements 
 * @param {Array} jobs Array of job objects
 */
function displayJobs (elements, jobs) {
  const { jobResults, resultCount, showInJobJourneyBtn } = elements

  if (!jobResults) return

  // Clear existing results
  jobResults.innerHTML = ''

  // Update count
  if (resultCount) {
    resultCount.textContent = `${jobs.length} jobs found`
  }

  // Update button state
  updateButtonStates(showInJobJourneyBtn, jobs.length > 0)

  // Store jobs in jobService for later use with showInJobJourney
  jobService.setJobs(jobs)

  // Display jobs
  if (jobs.length === 0) {
    showEmptyState(jobResults)
  } else {
    jobs.forEach(job => {
      const jobCard = createJobCard(job)
      jobResults.appendChild(jobCard)
    })
  }
}

/**
 * Show empty state when no jobs are found
 * @param {HTMLElement} jobList The job list container
 * @param {string} message Main message
 * @param {string} subMessage Submessage
 */
function showEmptyState (jobList, message = 'No jobs found', subMessage = 'Try adjusting your search criteria or select different job platforms') {
  // Create empty state container
  const emptyState = document.createElement('div')
  emptyState.className = 'empty-state'

  // Add icon
  const icon = document.createElement('div')
  icon.className = 'empty-state-icon'
  icon.textContent = '🔍'

  // Add main text
  const text = document.createElement('div')
  text.className = 'empty-state-text'
  text.textContent = message

  // Add subtext
  const subtext = document.createElement('div')
  subtext.className = 'empty-state-subtext'
  subtext.textContent = subMessage

  // Assemble the empty state
  emptyState.appendChild(icon)
  emptyState.appendChild(text)
  emptyState.appendChild(subtext)

  // Add to job list
  jobList.appendChild(emptyState)
}

/**
 * Refresh job display with jobs from the job service
 * @param {Object} elements UI elements
 */
function refreshJobDisplay (elements) {
  const jobs = jobService.getJobs()
  displayJobs(elements, jobs)
}

/**
 * Create a job card element
 * @param {Object} job Job object
 * @returns {HTMLElement} Job card element
 */
function createJobCard (job) {
  // Create job card
  const card = document.createElement('div')
  card.className = 'job-card'
  card.dataset.jobId = job.id || Math.random().toString(36).substring(2, 15)

  // Create header section with title and platform badge
  const header = document.createElement('div')
  header.style.display = 'flex'
  header.style.justifyContent = 'space-between'
  header.style.alignItems = 'flex-start'
  header.style.marginBottom = '12px'

  const title = document.createElement('h3')
  title.textContent = job.title
  title.style.marginRight = '8px'
  title.style.flex = '1'

  const platformBadge = document.createElement('span')
  platformBadge.textContent = job.platform
  platformBadge.style.fontSize = '12px'
  platformBadge.style.padding = '4px 8px'
  platformBadge.style.borderRadius = '12px'
  platformBadge.style.backgroundColor = 'rgba(67, 97, 238, 0.1)'
  platformBadge.style.color = '#4361ee'
  platformBadge.style.fontWeight = '500'
  platformBadge.style.whiteSpace = 'nowrap'

  header.appendChild(title)
  header.appendChild(platformBadge)

  // Create company and location section
  const companySection = document.createElement('div')
  companySection.style.marginBottom = '12px'

  const company = document.createElement('p')
  company.innerHTML = `<strong>${job.company}</strong>`
  company.style.marginBottom = '4px'

  const location = document.createElement('p')
  location.textContent = job.location
  location.style.color = 'var(--text-secondary)'
  location.style.fontSize = '14px'

  companySection.appendChild(company)
  companySection.appendChild(location)

  // Create metadata section for job type and salary
  const metaSection = document.createElement('div')
  metaSection.className = 'job-meta'
  metaSection.style.marginBottom = '12px'

  // Add job type if available
  if (job.jobType) {
    const jobType = document.createElement('span')
    jobType.className = 'job-type'
    jobType.textContent = job.jobType
    metaSection.appendChild(jobType)
  }

  // Add salary if available
  if (job.salary) {
    const salary = document.createElement('span')
    salary.className = 'salary'
    salary.textContent = job.salary
    metaSection.appendChild(salary)
  }

  // Add description if available
  let description
  if (job.description) {
    description = document.createElement('p')
    description.className = 'job-description'
    description.textContent = job.description
  }

  // Add posted date if available
  let postedDate
  if (job.postedDate) {
    postedDate = document.createElement('p')
    postedDate.className = 'posted-date'
    postedDate.textContent = job.postedDate
  }

  // Create actions section
  const actions = document.createElement('div')
  actions.className = 'job-actions'

  const viewBtn = document.createElement('button')
  viewBtn.className = 'view-btn'
  viewBtn.style.width = '100%' // Make button take full width
  viewBtn.textContent = 'View Job'
  viewBtn.onclick = () => {
    chrome.tabs.create({ url: job.jobUrl })
  }

  actions.appendChild(viewBtn)

  // Assemble the card
  card.appendChild(header)
  card.appendChild(companySection)
  card.appendChild(metaSection)

  if (description) card.appendChild(description)
  if (postedDate) card.appendChild(postedDate)

  card.appendChild(actions)

  return card
}

/**
 * Update button states
 * @param {HTMLButtonElement} showInJobJourneyBtn Show in JobJourney button
 * @param {boolean} hasJobs Whether there are jobs
 */
function updateButtonStates (showInJobJourneyBtn, hasJobs) {
  showInJobJourneyBtn.disabled = !hasJobs
}

/**
 * Validate the search form
 * @param {Object} elements Form elements
 * @param {boolean} showErrors Whether to show errors
 * @returns {Object} Validation result and form values
 */
function validateSearchForm (elements, showErrors = true) {
  const { searchInput, countrySelect, locationSelect, statusMessage } = elements

  // Get form values
  const searchInputValue = searchInput ? searchInput.value.trim() : ''
  const countryValue = countrySelect ? countrySelect.value : ''
  const locationValue = locationSelect ? locationSelect.value : ''

  let isValid = true
  let errorMessage = ''

  // Validate inputs
  if (!searchInputValue) {
    isValid = false
    errorMessage = 'Please enter a job title'
  } else if (!countryValue) {
    isValid = false
    errorMessage = 'Please select a country'
  } else if (!locationValue) {
    isValid = false
    errorMessage = 'Please select a location'
  }

  // Get selected platforms
  const selectedPlatforms = []
  const checkboxes = document.querySelectorAll('.website-option input[type="checkbox"]:checked')
  checkboxes.forEach(checkbox => {
    selectedPlatforms.push(checkbox.id)
  })

  if (selectedPlatforms.length === 0) {
    isValid = false
    errorMessage = 'Please select at least one job platform'
  }

  // Show error message if needed
  if (!isValid && showErrors && statusMessage) {
    showMessage(statusMessage, errorMessage, true)
  }

  return {
    isValid,
    errorMessage,
    values: {
      searchInputValue,
      countryValue,
      locationValue,
      selectedPlatforms
    }
  }
}

// Show UI to inform user that extension needs update
function showUpdateUI ({ currentVersion, minimumVersion, message }) {
  console.log('Showing update UI')

  // Create UI elements
  const overlay = document.createElement('div')
  overlay.style.position = 'fixed'
  overlay.style.top = '0'
  overlay.style.left = '0'
  overlay.style.width = '100%'
  overlay.style.height = '100%'
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)'
  overlay.style.display = 'flex'
  overlay.style.flexDirection = 'column'
  overlay.style.alignItems = 'center'
  overlay.style.justifyContent = 'center'
  overlay.style.zIndex = '9999'
  overlay.style.color = 'white'
  overlay.style.fontFamily = 'system-ui, sans-serif'
  overlay.style.textAlign = 'center'
  overlay.style.padding = '20px'
  overlay.style.boxSizing = 'border-box'

  const container = document.createElement('div')
  container.style.backgroundColor = 'rgba(40, 44, 52, 0.95)'
  container.style.borderRadius = '8px'
  container.style.padding = '20px 30px'
  container.style.maxWidth = '480px'
  container.style.width = '100%'
  container.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.5)'
  container.style.backdropFilter = 'blur(10px)'
  container.style.border = '1px solid rgba(255, 255, 255, 0.2)'

  const icon = document.createElement('div')
  icon.innerHTML = '⚠️' // Warning icon
  icon.style.fontSize = '48px'
  icon.style.marginBottom = '15px'

  const title = document.createElement('h2')
  title.textContent = 'Extension Update Required'
  title.style.fontSize = '24px'
  title.style.fontWeight = 'bold'
  title.style.marginBottom = '15px'
  title.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
  title.style.color = '#FFD700' // Gold/yellow color for better visibility
  title.style.textShadow = '0px 1px 2px rgba(0, 0, 0, 0.5)' // Add shadow for better contrast

  const description = document.createElement('p')
  description.innerHTML = message || `Your extension version (${currentVersion}) is no longer compatible with JobJourney. Please update to version ${minimumVersion} or higher.`
  description.style.fontSize = '16px'
  description.style.lineHeight = '1.5'
  description.style.marginBottom = '20px'
  description.style.color = 'rgba(255, 255, 255, 1)' // Brighter white for better readability

  const updateBtn = document.createElement('button')
  updateBtn.textContent = 'Update Extension'
  updateBtn.style.backgroundColor = '#4361ee'
  updateBtn.style.color = 'white'
  updateBtn.style.border = 'none'
  updateBtn.style.borderRadius = '4px'
  updateBtn.style.padding = '12px 20px'
  updateBtn.style.fontSize = '16px'
  updateBtn.style.fontWeight = 'bold'
  updateBtn.style.cursor = 'pointer'
  updateBtn.style.marginTop = '10px'
  updateBtn.style.transition = 'background-color 0.2s'
  updateBtn.style.width = '100%'
  updateBtn.style.maxWidth = '250px'
  updateBtn.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)'

  updateBtn.addEventListener('mouseover', () => {
    updateBtn.style.backgroundColor = '#2845e0'
  })

  updateBtn.addEventListener('mouseout', () => {
    updateBtn.style.backgroundColor = '#4361ee'
  })

  updateBtn.addEventListener('click', () => {
    triggerExtensionDownload()
  })


  // Assemble the UI
  container.appendChild(icon)
  container.appendChild(title)
  container.appendChild(description)
  container.appendChild(updateBtn)
  overlay.appendChild(container)

  // Add to the page
  document.body.appendChild(overlay)

  return {
    overlay,
    container,
    updateBtn,
    closeBtn
  }
}

// Update the showVersionOverlay function to make incompatibility more noticeable
function showVersionOverlay (versionInfo) {
  console.log('Showing version overlay with info:', versionInfo)

  // Create UI elements
  const overlay = document.createElement('div')
  overlay.style.position = 'fixed'
  overlay.style.top = '0'
  overlay.style.left = '0'
  overlay.style.width = '100%'
  overlay.style.height = '100%'
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)'
  overlay.style.display = 'flex'
  overlay.style.flexDirection = 'column'
  overlay.style.alignItems = 'center'
  overlay.style.justifyContent = 'center'
  overlay.style.zIndex = '9999'
  overlay.style.color = 'white'
  overlay.style.fontFamily = 'system-ui, sans-serif'
  overlay.style.textAlign = 'center'
  overlay.style.padding = '20px'
  overlay.style.boxSizing = 'border-box'

  const container = document.createElement('div')
  container.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
  container.style.borderRadius = '8px'
  container.style.padding = '20px 30px'
  container.style.maxWidth = '480px'
  container.style.width = '100%'
  container.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.2)'
  container.style.backdropFilter = 'blur(10px)'

  const icon = document.createElement('div')
  icon.innerHTML = '⚠️' // Warning icon
  icon.style.fontSize = '48px'
  icon.style.marginBottom = '15px'

  const title = document.createElement('h2')
  title.textContent = 'Extension Compatibility Issue'
  title.style.fontSize = '22px'
  title.style.marginBottom = '15px'
  title.style.color = 'white'

  const messageElement = document.createElement('p')
  messageElement.innerHTML = versionInfo.message || 'Your extension version is not compatible with the website.'
  messageElement.style.fontSize = '16px'
  messageElement.style.lineHeight = '1.5'
  messageElement.style.marginBottom = '20px'
  messageElement.style.color = 'rgba(255, 255, 255, 0.85)'

  // If incompatible, make the overlay more noticeable
  if (versionInfo && versionInfo.isCompatible === false) {
    overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.1)'
    messageElement.style.color = 'red'
    messageElement.style.fontWeight = 'bold'
  }

  // Add elements to container
  container.appendChild(icon)
  container.appendChild(title)
  container.appendChild(messageElement)

  // Add to overlay
  overlay.appendChild(container)

  // Add to document
  document.body.appendChild(overlay)

  return overlay
}

/**
 * Show progress UI for job search
 * @param {Object} elements UI elements
 * @param {boolean} show Whether to show or hide
 */
function showProgress (elements, show) {
  const { scrapingOverlay, progressSection } = elements

  if (scrapingOverlay) {
    showOverlay(scrapingOverlay, show)
  }

  if (progressSection) {
    progressSection.style.display = show ? 'block' : 'none'
  }
}

/**
 * Trigger sending the DOWNLOAD_EXTENSION message to the website
 * This will cause the website to open the extension download page
 */
function triggerExtensionDownload () {
  console.log('Triggering extension download via port message')
  const port = chrome.runtime.connect({ name: "panel" })
  port.postMessage({
    action: "DOWNLOAD_EXTENSION",
    data: {
      success: true,
      message: "Please download the extension"
    }
  })
}

export default {
  showMessage,
  showOverlay,
  updateProgress,
  createJobCard,
  updateButtonStates,
  getUIElements,
  updateLocationOptions,
  updateWebsiteOptions,
  displayJobs,
  refreshJobDisplay,
  populateCountrySelector,
  showEmptyState,
  validateSearchForm,
  showProgress,
  initializeUI,
  showUpdateUI,
  showVersionOverlay,
  triggerExtensionDownload
} 