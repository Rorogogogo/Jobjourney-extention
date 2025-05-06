// Helper function to scrape the SEEK job detail panel
async function scrapeSeekJobDetailPanel (basicInfo = {}) {
  try {
    // Job details panel
    let panel = document.querySelector('[data-automation="jobDetailsPage"]')

    if (!panel) {
      console.log('SEEK job details panel not found on first attempt. Retrying after 0.5s...')
      await new Promise(resolve => setTimeout(resolve, 500)) // Wait for 0.5 seconds
      panel = document.querySelector('[data-automation="jobDetailsPage"]') // Try selecting again
    }

    if (!panel) {
      console.warn('SEEK job details panel not found after retry')
      return null
    }

    // Title
    const titleElement = panel.querySelector('[data-automation="job-detail-title"], h1')
    const title = titleElement ? titleElement.textContent.trim() : basicInfo.title || ''

    // Company name
    const companyElement = panel.querySelector('[data-automation="advertiser-name"]')
    const company = companyElement ? companyElement.textContent.trim() : basicInfo.company || ''

    // Location
    const locationElement = panel.querySelector('[data-automation="job-detail-location"]')
    const location = locationElement ? locationElement.textContent.trim() : basicInfo.location || ''

    // Job URL - use the current URL or the one from the basic info
    const jobUrl = window.location.href.split('?')[0] || basicInfo.jobUrl

    // Work type (Full-time/Part-time)
    const workTypeElement = panel.querySelector('[data-automation="job-detail-work-type"]')
    const jobType = workTypeElement ? workTypeElement.textContent.trim() : ''

    // Workplace type (Remote/Hybrid/On-site) - from basic info or try to extract from detail
    let workplaceType = basicInfo.workplaceType || ''
    if (!workplaceType) {
      // Try to find it in the location section, which sometimes contains (Remote) or (Hybrid)
      const locationText = locationElement?.textContent || ''
      if (locationText.includes('Remote')) workplaceType = 'Remote'
      else if (locationText.includes('Hybrid')) workplaceType = 'Hybrid'
      else if (locationText.includes('On-site')) workplaceType = 'On-site'
    }

    // Salary info
    const salaryElement = panel.querySelector('[data-automation="job-detail-salary"]')
    const salary = salaryElement ? salaryElement.textContent.trim() : ''

    // Posted date - find elements that might contain the posted date
    let postedDate = ''
    const dateElements = panel.querySelectorAll('span.gg45di0')
    for (const el of dateElements) {
      if (el.textContent.includes('Posted')) {
        postedDate = el.textContent.replace('Posted', '').trim()
        break
      }
    }

    // Job description
    const descriptionElement = panel.querySelector('[data-automation="jobAdDetails"]')
    // Clean SEEK description - remove excessive newlines and trim
    const description = descriptionElement ? descriptionElement.innerText.replace(/\n{3,}/g, '\n\n').trim() : ''

    // Company logo
    const logoElement = panel.querySelector('[data-testid="bx-logo-image"] img, [data-automation="advertiser-logo"] img')
    const companyLogoUrl = logoElement ? logoElement.src : null

    // Create the job object
    const job = Job.createFromSEEK({
      title,
      company,
      location,
      jobUrl,
      description,
      salary,
      postedDate,
      companyLogoUrl,
      jobType,
      workplaceType,
      applicantCount: ''
    })

    console.log('Scraped SEEK job detail from panel:', job)
    return job
  } catch (error) {
    console.error('Error scraping SEEK job details panel:', error)
    return null
  }
}

// SEEK scraper object
const seekScraper = {
  isMatch: (url) => url.includes('seek.com.au') || url.includes('seek.co.nz'),
  scrapeJobList: async () => {
    const jobs = []
    console.log('=== SEEK Scraping Started ===')
    console.log('Current URL:', window.location.href)

    // Try multiple possible selectors for job cards
    const selectors = [
      '[data-testid="job-card"]',
      'article[data-card-type="JobCard"]',
      'article[role="article"]',
      'a[data-testid="job-card-title"]',
      '[data-automation="job-card"]'
    ]

    let jobNodes = []
    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector)
      if (nodes.length > 0) {
        jobNodes = nodes
        console.log('Using selector:', selector)
        break
      }
    }

    console.log('Found SEEK job nodes:', jobNodes.length)

    // Check if we're already on a job details page
    const alreadyOnJobDetail = document.querySelector('[data-automation="jobDetailsPage"]')

    // If we're on a standalone job detail page with no job cards
    if (alreadyOnJobDetail && jobNodes.length === 0) {
      console.log('On standalone job details page, scraping current job')
      const jobDetail = await scrapeSeekJobDetailPanel()
      if (jobDetail) {
        jobs.push(jobDetail)
      }
      return { jobs, nextUrl: null }
    }

    // Function to wait for job details panel to load
    const waitForJobDetailsPanel = async () => {
      let attempts = 0
      const maxAttempts = 20
      let waitTime = 200  // Start with 200ms

      while (attempts < maxAttempts) {
        const detailsPanel = document.querySelector('[data-automation="jobDetailsPage"]')
        const loadingIndicator = document.querySelector('[data-automation="loading-spinner"]')

        if (detailsPanel && !loadingIndicator) {
          // Wait a bit more to ensure content is fully rendered
          await new Promise(r => setTimeout(r, 500))
          return true
        }

        // Exponential backoff - double the wait time after each attempt
        waitTime = Math.min(waitTime * 1.5, 1500)
        console.log(`Waiting ${waitTime}ms for job details panel (attempt ${attempts + 1}/${maxAttempts})`)
        await new Promise(r => setTimeout(r, waitTime))
        attempts++
      }

      return false
    }

    // Process each job card one by one
    for (let i = 0; i < Math.min(jobNodes.length, 30); i++) {
      try {
        const node = jobNodes[i]

        // Extract basic info from the card before clicking
        const titleNode = node.querySelector('[data-testid="job-card-title"], a[data-automation="jobTitle"]')
        const companyNode = node.querySelector('[data-automation="jobCompany"], span[class*="companyName"]')
        const locationNode = node.querySelector('[data-testid="jobCardLocation"], [data-automation="jobCardLocation"]')
        const jobUrlNode = titleNode?.closest('a')
        const jobUrl = jobUrlNode?.href || window.location.href

        // Extract the work arrangement (Remote/Hybrid/etc) from the job card if available
        const workArrangementNode = node.querySelector('[data-testid="work-arrangement"]')
        let workplaceType = ''
        if (workArrangementNode) {
          const text = workArrangementNode.textContent.replace(/[()]/g, '').trim()
          if (text.includes('Remote') || text.includes('Hybrid') || text.includes('On-site')) {
            workplaceType = text
          }
        }

        // Basic info for fallback
        const basicInfo = {
          title: titleNode?.textContent?.trim() || '',
          company: companyNode?.textContent?.trim() || '',
          location: locationNode?.textContent?.trim() || '',
          jobUrl: jobUrl,
          workplaceType: workplaceType
        }

        console.log(`Clicking job ${i + 1}/${Math.min(jobNodes.length, 30)}: ${basicInfo.title}`)

        // Find a suitable clickable element
        const clickableElement =
          titleNode ||
          node.querySelector('a[data-automation="job-list-item-link-overlay"]') ||
          node.querySelector('a[href*="job"]') ||
          node

        console.log('Clicking element: ', clickableElement.tagName)

        // Click on the job card to show details
        clickableElement.click()

        // Wait for job details panel to load
        const detailsLoaded = await waitForJobDetailsPanel()

        if (detailsLoaded) {
          // Scrape the detailed job information from the panel
          const jobDetail = await scrapeSeekJobDetailPanel(basicInfo)

          if (jobDetail && Object.keys(jobDetail).length > 0) {
            // Create job with detailed info
            jobs.push(jobDetail)
            console.log(`Successfully scraped detailed job: ${jobDetail.title}`)
          } else {
            // Fallback to basic info if detailed scraping failed
            console.log(`Failed to get details, using basic info for job ${i + 1}`)
            const job = Job.createFromSEEK(basicInfo)
            jobs.push(job)
          }
        } else {
          // Fallback to basic info if panel didn't load
          console.log(`Job details panel didn't load for job ${i + 1}, using basic info`)
          const job = Job.createFromSEEK(basicInfo)
          jobs.push(job)
        }

        // Add a delay between job clicks to avoid rate limiting
        const baseDelay = 300
        // const additionalDelay = 100
        const totalDelay = baseDelay
        console.log(`Waiting ${totalDelay}ms before next job click...`)
        await new Promise(r => setTimeout(r, totalDelay))

      } catch (error) {
        console.error(`Error processing job ${i + 1}:`, error)
        // Add error recovery delay
        await new Promise(r => setTimeout(r, 1500))
      }
    }

    // Check for next page - using valid CSS selectors that target the last "Next" button
    const nextButton = document.querySelector([
      'li:last-child a[rel*="next"][aria-hidden="false"]',
      'li:last-child a[data-automation^="page-"]:not([aria-current])'
    ].join(','))

    const nextUrl = nextButton && nextButton.getAttribute('aria-hidden') !== 'true'
      ? nextButton.href
      : null

    console.log(`=== SEEK Scraping Complete: ${jobs.length} jobs found ===`)
    console.log('Next URL:', nextUrl)

    return {
      jobs,
      nextUrl
    }
  },
  scrapeJobDetail: async () => {
    try {
      return await scrapeSeekJobDetailPanel()
    } catch (error) {
      console.error('Error scraping SEEK job detail:', error)
      return null
    }
  }
}

// Assign to window object for global access
window.seekScraper = seekScraper;

