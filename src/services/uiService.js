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

  const title = document.createElement('h3')
  title.textContent = job.title

  const company = document.createElement('p')
  company.textContent = `Company: ${job.company}`

  const location = document.createElement('p')
  location.textContent = `Location: ${job.location}`

  const platform = document.createElement('p')
  platform.textContent = `Platform: ${job.platform}`

  // Add job type if available
  const jobType = document.createElement('p')
  jobType.className = 'job-type'
  jobType.textContent = job.jobType ? `Job Type: ${job.jobType}` : ''
  jobType.style.display = job.jobType ? 'block' : 'none'

  // Add salary if available
  const salary = document.createElement('p')
  salary.className = 'salary'
  salary.textContent = job.salary ? `Salary: ${job.salary}` : ''
  salary.style.display = job.salary ? 'block' : 'none'

  // Add description if available
  const description = document.createElement('p')
  description.className = 'job-description'
  description.textContent = job.description ? `Description: ${job.description}` : ''
  description.style.display = job.description ? 'block' : 'none'

  // Add posted date if available
  const postedDate = document.createElement('p')
  postedDate.className = 'posted-date'
  postedDate.textContent = job.postedDate ? `Posted: ${job.postedDate}` : ''
  postedDate.style.display = job.postedDate ? 'block' : 'none'

  const actions = document.createElement('div')
  actions.className = 'job-actions'

  const viewBtn = document.createElement('button')
  viewBtn.textContent = 'View'
  viewBtn.onclick = () => {
    chrome.tabs.create({ url: job.jobUrl })
  }

  actions.appendChild(viewBtn)

  card.appendChild(title)
  card.appendChild(company)
  card.appendChild(location)
  card.appendChild(platform)
  card.appendChild(jobType)
  card.appendChild(salary)
  card.appendChild(description)
  card.appendChild(postedDate)
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