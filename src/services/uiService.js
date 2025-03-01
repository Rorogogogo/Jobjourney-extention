// Function to show status message
function showMessage (statusMessage, message, isError = false) {
  statusMessage.textContent = message
  statusMessage.className = `status-message ${isError ? 'error' : 'success'}`
  statusMessage.style.display = 'block'
  setTimeout(() => {
    statusMessage.style.display = 'none'
  }, 2000)
}

// Function to show/hide overlay
function showOverlay (overlay, show) {
  overlay.style.display = show ? 'flex' : 'none'
  // Disable all interactive elements when overlay is shown
  const interactiveElements = document.querySelectorAll('button, input, select')
  interactiveElements.forEach(element => {
    element.disabled = show
  })
}

// Function to update progress indicators
function updateProgress (progressFill, progressText, overlayText, progressDetail, overlayDetail, percent, text, detail) {
  progressFill.style.width = `${percent}%`
  progressText.textContent = text
  if (detail) {
    progressDetail.textContent = detail
    overlayDetail.textContent = detail
  }
  overlayText.textContent = text
}

// Function to create job card
function createJobCard (job) {
  const card = document.createElement('div')
  card.className = 'job-card'

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
  viewBtn.textContent = 'View Job'
  viewBtn.style.width = '100%' // Make button take full width
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

// Function to update button states
function updateButtonStates (showInJobJourneyBtn, hasJobs) {
  showInJobJourneyBtn.disabled = !hasJobs
}

export default {
  showMessage,
  showOverlay,
  updateProgress,
  createJobCard,
  updateButtonStates
} 