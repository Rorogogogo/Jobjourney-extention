// Helper function to clean up empty tags and those that only contain comments
function cleanupEmptyTags (node) {
  if (!node) return

  const children = Array.from(node.childNodes)
  children.forEach(child => {
    if (child.nodeType === 8) { // Comment node
      child.remove()
    } else if (child.nodeType === 3 && !child.textContent.trim()) {
      child.remove()
    } else if (child.nodeType === 1) {
      cleanupEmptyTags(child)
    }
  })
}

// Helper function to clean and format content, preserving important formatting
function cleanAndFormatContent (node) {
  if (!node) return ''

  // Clone the node to avoid modifying the original
  const clone = node.cloneNode(true)

  // Remove all <!-- --> comments in text nodes
  const walker = document.createTreeWalker(
    clone,
    NodeFilter.SHOW_TEXT,
    null,
    false
  )

  const textNodes = []
  let currentNode
  while (currentNode = walker.nextNode()) {
    textNodes.push(currentNode)
  }

  textNodes.forEach(textNode => {
    textNode.textContent = textNode.textContent
      .replace(/<!--.*?-->/g, '')
      .replace(/^[ \t]*<!---->/g, '')
      .replace(/<!---->/g, '')
  })

  // Before removing tags, convert <strong> elements to actual bold markup
  // that our application can process properly
  const strongElements = clone.querySelectorAll('strong')
  strongElements.forEach(strong => {
    const boldText = strong.textContent.trim()
    if (boldText) {
      // Create a text node with the bold wrapper
      const textNode = document.createTextNode(`[BOLD]${boldText}[/BOLD]`)
      strong.parentNode.replaceChild(textNode, strong)
    }
  })

  // Properly handle lists by preserving their structure
  const listItems = clone.querySelectorAll('li')
  listItems.forEach(li => {
    // Add a special marker at the beginning of each list item
    li.innerHTML = '[LIST_ITEM]' + li.innerHTML
  })

  // Handle paragraphs and breaks by ensuring they create new lines
  const paragraphs = clone.querySelectorAll('p')
  paragraphs.forEach((p, index) => {
    if (index > 0) {
      // Add paragraph separator for all paragraphs except the first one
      p.innerHTML = '[PARAGRAPH]' + p.innerHTML
    }
  })

  // Mark all <br> elements
  const breaks = clone.querySelectorAll('br')
  breaks.forEach(br => {
    const marker = document.createTextNode('[BREAK]')
    br.parentNode.insertBefore(marker, br)
  })

  // Clean up LinkedIn's specific patterns
  let content = clone.innerHTML
    // Remove empty comments
    .replace(/<!---->/g, '')
    // Remove comments with content
    .replace(/<!--.*?-->/g, '')
    // Remove span tags but keep their content
    .replace(/<\/?span(?:\s+[^>]*)?>|<\/?div(?:\s+[^>]*)?>/g, '')
    // Remove paragraph tags (we've already marked them)
    .replace(/<p[^>]*>|<\/p>/g, '')
    // Remove list item tags (we've already marked them)
    .replace(/<li[^>]*>|<\/li>/g, '')
    // Remove ul/ol tags
    .replace(/<\/?ul[^>]*>|<\/?ol[^>]*>/g, '')
    // Remove all remaining HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove white-space-pre markers
    .replace(/\s*class="white-space-pre"\s*/g, ' ')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim()

  // Now convert our markers to proper formatting
  content = content
    // Convert our bold markers to plain text bold indicators
    .replace(/\[BOLD\](.*?)\[\/BOLD\]/g, '**$1**')
    // Convert list items to bullet points with line breaks
    .replace(/\[LIST_ITEM\]/g, '\n• ')
    // Convert paragraph markers to double line breaks
    .replace(/\[PARAGRAPH\]/g, '\n\n')
    // Convert break markers to single line breaks
    .replace(/\[BREAK\]/g, '\n')
    // Fix spacing around bullet points
    .replace(/\n• /g, '\n• ')
    // Clean up excessive newlines
    .replace(/\n{3,}/g, '\n\n')

  return content
}


// Helper function to scrape the current job detail page (when not on search results)
function scrapeCurrentJobDetail () {
  try {
    const mainContainer = document.querySelector('.job-view-layout') || document.body

    const title = mainContainer.querySelector('h1.t-24, .job-details-jobs-unified-top-card__job-title h1')?.textContent.trim()
    const companyLink = mainContainer.querySelector('a.topcard__org-name-link, .job-details-jobs-unified-top-card__company-name a')
    const company = companyLink?.textContent.trim()

    // --- Location, Posted Date, Applicant Count ---
    const metaContainer = mainContainer.querySelector('.jobs-unified-top-card__subtitle-primary-grouping, .job-details-jobs-unified-top-card__primary-description-container')
    let location = ''
    let postedDate = ''
    let applicantCount = ''

    if (metaContainer) {
      // Get all distinct text nodes within the container, preserving order
      const metaTexts = Array.from(metaContainer.querySelectorAll('span[class*="tvm__text"]'))
        .map(span => span.textContent.trim())
        .filter(text => text && text !== '·')

      if (metaTexts.length > 0) location = metaTexts[0] // Usually the first item
      // Find posted date (contains 'ago' or similar)
      postedDate = metaTexts.find(text => /\d+ (day|week|month|year)s? ago/i.test(text)) || ''
      // Find applicant count (contains 'applicant' or 'people clicked apply')
      applicantCount = metaTexts.find(text => /applicant|people clicked apply/i.test(text)) || ''

      // Fallback if specific spans weren't found - split by bullet
      if (!location && !postedDate && !applicantCount && metaContainer.textContent) {
        const parts = metaContainer.textContent.split('·').map(part => part.trim())
        if (parts.length >= 1) location = parts[0]
        if (parts.length >= 2 && parts[1].includes('ago')) postedDate = parts[1] // Basic check
        if (parts.length >= 3 && (parts[2].includes('applicant') || parts[2].includes('people clicked apply'))) applicantCount = parts[2] // Basic check
      }
    }

    // --- Description ---
    let description = ''
    const descriptionContainer = mainContainer.querySelector('div.description__text, .jobs-description-content__text, div#job-details, div[class*="jobs-box__html-content"]', 'job-description', 'job-description-container')
    if (descriptionContainer) {
      const contentDiv = descriptionContainer.querySelector('.mt4') || descriptionContainer // Try to exclude "About the job" header
      description = cleanAndFormatContent(contentDiv) // Use the improved cleaning function
    }

    // --- Company Logo ---
    const logoElement = mainContainer.querySelector('.jobs-unified-top-card__company-logo img, .artdeco-entity-lockup__image img, .evi-image')
    const companyLogoUrl = logoElement?.src

    // --- Job Type, Workplace Type, Salary from Pills/Specific Elements ---
    let workplaceType = ''
    let jobType = ''
    let salary = ''

    const pillElements = mainContainer.querySelectorAll('.job-details-preferences-and-skills__pill, .job-details-jobs-unified-top-card__job-insight, .job-details-jobs-unified-top-card__workplace-type')

    pillElements.forEach(pill => {
      const pillText = pill.textContent.trim()
      // Check for workplace type (prioritize specific element if exists)
      if (!workplaceType && pill.matches('.job-details-jobs-unified-top-card__workplace-type')) {
        workplaceType = pillText
      } else if (!workplaceType && (pillText.includes('Remote') || pillText.includes('Hybrid') || pillText.includes('On-site'))) {
        if (pillText.includes('Remote')) workplaceType = 'Remote'
        else if (pillText.includes('Hybrid')) workplaceType = 'Hybrid'
        else if (pillText.includes('On-site')) workplaceType = 'On-site'
      }

      // Check for job type
      if (!jobType && (pillText.includes('Full-time') || pillText.includes('Part-time') || pillText.includes('Contract') || pillText.includes('Temporary') || pillText.includes('Internship') || pillText.includes('Volunteer'))) {
        const jobTypeMatch = pillText.match(/\b(Full-time|Part-time|Contract|Temporary|Internship|Volunteer|Casual|Contractor)\b/i)
        if (jobTypeMatch) jobType = jobTypeMatch[0]
      }

      // Check for salary
      if (!salary && (pillText.match(/\$|€|£|¥|₹|Salary|salary|\/yr|\/hour|\/month|\/week|Bonus|bonus/i) || pillText.match(/\d+K/i))) {
        salary = pillText.replace(/See how you compare.*/i, '').trim() // Remove trailing text
      }
    })

    // Specific check for salary range element if not found in pills
    if (!salary) {
      const salaryContainer = mainContainer.querySelector('.compensation__salary-range, [class*="salary-"], .jobs-unified-top-card__salary-info') // Added one more selector
      if (salaryContainer) salary = salaryContainer.textContent.trim()
    }

    // --- Job URL (Prioritize title link, fallback to window.location) ---
    const titleLink = mainContainer.querySelector('h1.t-24 a, .job-details-jobs-unified-top-card__job-title h1 a')
    let jobUrl = window.location.href // Default to current window URL
    if (titleLink?.href) {
      try {
        jobUrl = new URL(titleLink.href, window.location.href).href // Make absolute
      } catch (e) {
        console.warn('Could not create absolute URL from title link:', titleLink.href, e)
        // Keep window.location.href as fallback
      }
    }
    // Clean URL? Optional: jobUrl = jobUrl.split('?')[0];

    // Validate essential fields before creating Job object
    if (!title || !company) {
      console.warn("Failed to extract essential details (title or company) from panel.", { title, company })
      return null // Return null if we couldn't get basic info
    }

    // Use the Job class static factory method
    const job = Job.createFromLinkedIn({
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
      applicantCount
    })

    console.log('Scraped LinkedIn job detail (standalone page):', job)
    return job
  } catch (error) {
    console.error('Error in scrapeCurrentJobDetail:', error)
    return null
  }
}

// Scrape detailed job information from the open panel (after clicking a job card)
const scrapeJobDetailFromPanel = () => {
  try {
    const panel = document.querySelector('.jobs-search__job-details--container, .scaffold-layout__detail') // Added alternative panel selector
    if (!panel) {
      console.warn('Job details panel not found for scraping.')
      return null
    }

    // --- Title ---
    // Try specific title element first, fallback to any h1/h2 in the panel header
    const titleElement = panel.querySelector('.job-details-jobs-unified-top-card__job-title h1, .t-24.job-details-jobs-unified-top-card__job-title')
    const title = titleElement?.textContent?.trim() || panel.querySelector('.jobs-details-top-card__job-title, .job-details-jobs-unified-top-card__job-title')?.textContent.trim() || ''


    // --- Company ---
    const companyLink = panel.querySelector('.job-details-jobs-unified-top-card__company-name a, .jobs-details-top-card__company-url')
    const company = companyLink?.textContent?.trim() || panel.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-details-top-card__company-info')?.textContent.trim() || ''


    // --- Location, Posted Date, Applicant Count ---
    const metaContainer = panel.querySelector('.job-details-jobs-unified-top-card__primary-description-container, .jobs-details-top-card__job-info')
    let location = ''
    let postedDate = ''
    let applicantCount = ''

    if (metaContainer) {
      // Get all distinct text nodes within the container, preserving order
      const metaTexts = Array.from(metaContainer.querySelectorAll('span[class*="tvm__text"], .job-details-jobs-unified-top-card__primary-description-container > div > span')) // Added alternative span selector
        .map(span => span.textContent.trim())
        .filter(text => text && text !== '·')

      if (metaTexts.length > 0) location = metaTexts[0] // Usually the first item
      // Find posted date (contains 'ago' or similar)
      postedDate = metaTexts.find(text => /\d+ (day|week|month|year)s? ago/i.test(text)) || ''
      // Find applicant count (contains 'applicant' or 'people clicked apply')
      applicantCount = metaTexts.find(text => /applicant|people clicked apply/i.test(text)) || ''

      // Fallback if specific spans weren't found - split by bullet
      if (!location && !postedDate && !applicantCount && metaContainer.textContent) {
        const parts = metaContainer.textContent.split('·').map(part => part.trim())
        if (parts.length >= 1) location = parts[0]
        if (parts.length >= 2 && parts[1].includes('ago')) postedDate = parts[1] // Basic check
        if (parts.length >= 3 && (parts[2].includes('applicant') || parts[2].includes('people clicked apply'))) applicantCount = parts[2] // Basic check
      }
    }

    // --- Description ---
    let description = ''
    // Prioritize the newer selector, fallback to others
    const descriptionContainer = panel.querySelector('.jobs-description__content .jobs-box__html-content, .jobs-description-content__text, div#job-details')
    if (descriptionContainer) {
      const contentDiv = descriptionContainer.querySelector('.mt4') || descriptionContainer // Try to exclude "About the job" header
      description = cleanAndFormatContent(contentDiv) // Use the improved cleaning function
    } else {
      console.warn("Could not find description container in panel.")
    }


    // --- Company Logo ---
    // Look in the standard top card location
    const logoElement = panel.querySelector('.jobs-unified-top-card__company-logo img, .artdeco-entity-lockup__image img, .evi-image')
    const companyLogoUrl = logoElement?.src


    // --- Job Type, Workplace Type, Salary from Pills/Specific Elements ---
    let workplaceType = ''
    let jobType = ''
    let salary = ''

    // Query all potential pill/insight elements within the panel
    const pillElements = panel.querySelectorAll('.job-details-preferences-and-skills__pill, .job-details-jobs-unified-top-card__job-insight, .job-details-jobs-unified-top-card__workplace-type')

    pillElements.forEach(pill => {
      const pillText = pill.textContent.trim()
      // Check for workplace type (prioritize specific element if exists)
      if (!workplaceType && pill.matches('.job-details-jobs-unified-top-card__workplace-type')) {
        workplaceType = pillText
      } else if (!workplaceType && (pillText.includes('Remote') || pillText.includes('Hybrid') || pillText.includes('On-site'))) {
        if (pillText.includes('Remote')) workplaceType = 'Remote'
        else if (pillText.includes('Hybrid')) workplaceType = 'Hybrid'
        else if (pillText.includes('On-site')) workplaceType = 'On-site'
      }

      // Check for job type
      if (!jobType && (pillText.includes('Full-time') || pillText.includes('Part-time') || pillText.includes('Contract') || pillText.includes('Temporary') || pillText.includes('Internship') || pillText.includes('Volunteer'))) {
        const jobTypeMatch = pillText.match(/\b(Full-time|Part-time|Contract|Temporary|Internship|Volunteer|Casual|Contractor)\b/i)
        if (jobTypeMatch) jobType = jobTypeMatch[0]
      }

      // Check for salary
      if (!salary && (pillText.match(/\$|€|£|¥|₹|Salary|salary|\/yr|\/hour|\/month|\/week|Bonus|bonus/i) || pillText.match(/\d+K/i))) {
        salary = pillText.replace(/See how you compare.*/i, '').trim() // Remove trailing text
      }
    })

    // Specific check for salary range element if not found in pills
    if (!salary) {
      const salaryContainer = panel.querySelector('.compensation__salary-range, [class*="salary-"], .jobs-unified-top-card__salary-info') // Added one more selector
      if (salaryContainer) salary = salaryContainer.textContent.trim()
    }

    // --- Job URL (Extract from title link within the panel if possible) ---
    let detailUrl = ''
    const titleLink = panel.querySelector('.job-details-jobs-unified-top-card__job-title h1 a, .t-24.job-details-jobs-unified-top-card__job-title a')
    if (titleLink?.href) {
      try {
        detailUrl = new URL(titleLink.href, window.location.href).href // Make absolute
      } catch (e) {
        console.warn('Could not create absolute URL from panel title link:', titleLink.href, e)
      }
    }

    // Validate essential fields before creating Job object
    if (!title || !company) {
      console.warn("Failed to extract essential details (title or company) from panel.", { title, company })
      return null // Return null if we couldn't get basic info
    }

    // Use the Job class static factory method
    const job = Job.createFromLinkedIn({
      title,
      company,
      location,
      jobUrl: detailUrl, // Return the URL found in the panel (might be empty string)
      description,
      salary,
      postedDate,
      companyLogoUrl,
      jobType,
      workplaceType,
      applicantCount
    })

    console.log('Scraped LinkedIn job detail from panel:', job)
    return job // Return the structured job object

  } catch (error) {
    console.error('Error scraping LinkedIn job details panel:', error)
    return null
  }
}


// LinkedIn scraper object
const linkedInScraper = {
  isMatch: (url) => url.includes('linkedin.com'),
  scrapeJobList: async () => {
    // Add a 1-second delay at the beginning of scraping each page
    console.log('Waiting 1 second after page load before starting LinkedIn scrape...')
    await new Promise(resolve => setTimeout(resolve, 1000))

    let jobs = []
    console.log('=== LinkedIn Scraping Started ===')
    console.log('Current URL:', window.location.href)

    // Only use the new job card selector for better performance
    const jobNodes = document.querySelectorAll('div.job-card-job-posting-card-wrapper, li.scaffold-layout__list-item[data-occludable-job-id]')
    console.log('Found LinkedIn job nodes:', jobNodes.length)

    // Check if we're already on a job details page with no job cards
    const alreadyOnJobDetail = document.querySelector('.jobs-search__job-details--container') ||
      document.querySelector('.jobs-details__main-content')
    const detailsAlreadyOpen = !!alreadyOnJobDetail

    // If we're on a standalone job detail page with no job cards
    if (detailsAlreadyOpen && jobNodes.length === 0) {
      console.log('On standalone job details page, scraping current job')
      const jobDetail = await scrapeCurrentJobDetail() // Use await here
      if (jobDetail) {
        jobs.push(jobDetail)
      }
      return { jobs, nextUrl: null }
    }

    // Process jobs using the enhanced method - click on each job card to view details
    if (jobNodes.length > 0) {
      console.log('Processing jobs using click and scrape method')

      // Function to check if job details panel is fully loaded with exponential backoff
      const waitForJobDetailsPanel = async () => {
        let attempts = 0
        const maxAttempts = 25  // Increased from 20
        let waitTime = 200  // Start with 200ms

        while (attempts < maxAttempts) {
          const detailsPanel = document.querySelector('.jobs-search__job-details--container')
          const loadingSpinner = document.querySelector('.jobs-search__job-details--loading')
          const detailContent = document.querySelector('.jobs-details__main-content')

          // Also check for error messages that might indicate rate limiting
          const errorMsg = document.querySelector('.artdeco-inline-feedback--error')

          if (errorMsg && errorMsg.textContent.includes('429')) {
            console.warn('Detected rate limiting (429 error). Waiting longer before retry...')
            // Wait for 5 seconds before continuing if we detect a 429 error
            await new Promise(r => setTimeout(r, 5000))
            return false
          }

          if (detailsPanel && detailContent && !loadingSpinner) {
            // Wait a bit more to ensure content is fully rendered
            await new Promise(r => setTimeout(r, 500))  // Increased from 300ms
            return true
          }

          // Exponential backoff - double the wait time after each attempt, with a max of 1.5 seconds
          waitTime = Math.min(waitTime * 1.5, 1500)
          console.log(`Waiting ${waitTime}ms for job details panel (attempt ${attempts + 1}/${maxAttempts})`)
          await new Promise(r => setTimeout(r, waitTime))
          attempts++
        }

        return false
      }

      // If a job detail is already open, scrape it first before moving to other jobs
      if (detailsAlreadyOpen) {
        console.log('Job details panel already open, scraping it first')
        const currentJobDetail = scrapeJobDetailFromPanel()
        if (currentJobDetail && Object.keys(currentJobDetail).length > 0) {
          const job = Job.createFromLinkedIn({
            title: currentJobDetail.title || '',
            company: currentJobDetail.company || '',
            location: currentJobDetail.location || '',
            salary: currentJobDetail.salary || '',
            description: currentJobDetail.description || '',
            postedDate: currentJobDetail.postedDate || '',
            jobUrl: currentJobDetail.jobUrl || window.location.href,
            companyLogoUrl: currentJobDetail.companyLogoUrl || null,
            jobType: currentJobDetail.jobType || '',
            workplaceType: currentJobDetail.workplaceType || '',
            applicantCount: currentJobDetail.applicantCount || ''
          })
          jobs.push(job)
          console.log(`Successfully scraped initially open job detail: ${job.title}`)
        }
      }

      // Get the currently selected job card if any
      const selectedJobCard = document.querySelector('div.job-card-job-posting-card-wrapper.artdeco-entity-lockup--selected')
      let startIndex = 0

      // Process each job node one by one, skipping the already selected one
      for (let i = 0; i < Math.min(jobNodes.length, 30); i++) {
        try {
          const node = jobNodes[i]

          // Skip the node if it's already selected (we scraped it above)
          if (selectedJobCard && node === selectedJobCard && i === 0 && detailsAlreadyOpen) {
            console.log('Skipping already selected job card')
            continue
          }

          // Extract basic info from the card before clicking
          const titleNode = node.querySelector('.artdeco-entity-lockup__title')
          const companyNode = node.querySelector('.artdeco-entity-lockup__subtitle div[dir="ltr"]')
          const jobUrlNode = node.querySelector('a.job-card-job-posting-card-wrapper__card-link')
          const jobUrl = jobUrlNode?.href || ''

          // Basic info for fallback
          const basicInfo = {
            title: titleNode?.textContent?.trim() || '',
            company: companyNode?.textContent?.trim() || '',
            jobUrl: jobUrl
          }

          console.log(`Clicking job ${i + 1}/${Math.min(jobNodes.length, 30)}: ${basicInfo.title}`)

          // Find the proper clickable element - try the anchor element first as it's more reliable
          const clickableElement =
            // First try to find the anchor link which is the most reliable element to click
            node.querySelector('a.job-card-job-posting-card-wrapper__card-link') ||
            // Or try to find another clickable element inside
            node.querySelector('.artdeco-entity-lockup__title') ||
            // Or try to find another clickable element inside
            node.querySelector('.job-card-container--clickable') ||
            // Finally fall back to the node itself
            node

          console.log('Clicking element: ', clickableElement.tagName)

          // Click on the job card to show details - use the anchor link when available
          clickableElement.click()

          // Wait for job details panel to load or update with exponential backoff
          const detailsLoaded = await waitForJobDetailsPanel()

          if (detailsLoaded) {
            // Scrape the detailed job information
            const jobDetail = scrapeJobDetailFromPanel()

            if (jobDetail && Object.keys(jobDetail).length > 0) {
              // Create job with detailed info
              const job = Job.createFromLinkedIn({
                title: jobDetail.title || basicInfo.title,
                company: jobDetail.company || basicInfo.company,
                location: jobDetail.location || '',
                salary: jobDetail.salary || '',
                description: jobDetail.description || '',
                postedDate: jobDetail.postedDate || '',
                jobUrl: jobDetail.jobUrl || basicInfo.jobUrl,
                companyLogoUrl: jobDetail.companyLogoUrl || null,
                jobType: jobDetail.jobType || '',
                workplaceType: jobDetail.workplaceType || '',
                applicantCount: jobDetail.applicantCount || ''
              })

              jobs.push(job)
              console.log(`Successfully scraped detailed job: ${job.title}`)
            } else {
              // Fallback to basic info if detailed scraping failed
              console.log(`Failed to get details, using basic info for job ${i + 1}`)
              const job = Job.createFromLinkedIn(basicInfo)
              jobs.push(job)
            }
          } else {
            // Fallback to basic info if panel didn't load
            console.log(`Job details panel didn't load for job ${i + 1}, using basic info`)
            const job = Job.createFromLinkedIn(basicInfo)
            jobs.push(job)
          }

          // Add a longer, randomized delay between job clicks to avoid rate limiting
          const baseDelay = 300 // Increased base delay
          const randomDelay = Math.random() * 800 // Random component up to 700ms
          const totalDelay = baseDelay + randomDelay
          console.log(`Waiting ${totalDelay.toFixed(0)}ms before next job click to avoid rate limiting...`)
          await new Promise(r => setTimeout(r, totalDelay))

        } catch (error) {
          console.error(`Error processing job ${i + 1}:`, error)
          // Add error recovery delay
          await new Promise(r => setTimeout(r, 2000))
        }
      }
    }
    // Fallback to data-job-id as a direct approach if no jobs found
    else {
      console.log('No job cards found, falling back to data-job-id selector')

      // Look for elements with data-job-id attribute for a faster direct approach
      const jobElements = document.querySelectorAll('[data-job-id]')
      console.log('Found elements with data-job-id:', jobElements.length)

      jobElements.forEach(node => {
        try {
          // Extract job ID
          const jobId = node.getAttribute('data-job-id')

          // Direct selectors for the best performance
          const cardLink = node.querySelector('a[href*="jobs"]')
          const titleNode = node.querySelector('[class*="title"], strong, h3')
          const companyNode = node.querySelector('[class*="subtitle"] div, [class*="company"]')
          const locationNode = node.querySelector('[class*="caption"] div, [class*="location"]')
          const logoNode = node.querySelector('img')

          // If we have the minimum required information, create a job
          if ((titleNode && companyNode) || jobId) {
            // Default title and company if we couldn't find the elements
            const title = titleNode?.textContent?.trim() || `LinkedIn Job #${jobId}`
            const company = companyNode?.textContent?.trim() || 'Unknown Company'

            const job = Job.createFromLinkedIn({
              title: title,
              company: company,
              location: locationNode?.textContent?.trim() || '',
              jobUrl: cardLink?.href || `https://www.linkedin.com/jobs/view/${jobId}`,
              companyLogoUrl: logoNode?.src || null,
              workplaceType: '',
              applicantCount: ''
            })
            jobs.push(job)
          }
        } catch (error) {
          console.error('Error scraping LinkedIn job (fallback):', error)
        }
      })
    }

    // Add a longer, randomized delay before checking for the next page
    const baseFinalDelay = 1000 // 2 seconds base
    const randomFinalDelay = Math.random() * 1000 // Random component up to 2 seconds
    const finalDelay = baseFinalDelay + randomFinalDelay
    console.log(`Waiting ${finalDelay.toFixed(0)}ms after processing all jobs on this page before checking for next...`)
    await new Promise(r => setTimeout(r, finalDelay))


    // Check for next page with specific LinkedIn next button selector
    const nextButton = document.querySelector([
      'button.jobs-search-pagination__button--next',
      'button.artdeco-button--icon-right[aria-label="View next page"]',
      'button.artdeco-button[data-test-pagination-page-btn]'
    ].join(','))

    let nextUrl = null
    if (nextButton && !nextButton.disabled && nextButton.getAttribute('aria-disabled') !== 'true') {
      // Get current page number from URL or default to 1
      const currentUrl = new URL(window.location.href)
      const currentStart = parseInt(currentUrl.searchParams.get('start') || '0')
      const pageSize = 25 // LinkedIn's default page size

      // Create next page URL
      currentUrl.searchParams.set('start', (currentStart + pageSize).toString())
      nextUrl = currentUrl.toString()
    }

    console.log(`=== LinkedIn Scraping Complete: ${jobs.length} jobs found ===`)
    console.log('Next URL:', nextUrl)

    return {
      jobs,
      nextUrl
    }
  },
  scrapeJobDetail: async () => { // Make async to match scrapeJobList
    try {
      // Check if we are on a search page or a standalone detail page
      const isOnSearchResults = document.querySelector('div.job-card-job-posting-card-wrapper') || document.querySelector('[data-job-id]')
      const detailsPanel = document.querySelector('.jobs-search__job-details--container, .scaffold-layout__detail')

      if (isOnSearchResults && detailsPanel) {
        // On search results page, scrape the panel
        console.log("LinkedIn scrapeJobDetail: Scraping from panel on search results page.")
        return scrapeJobDetailFromPanel()
      } else if (!isOnSearchResults) {
        // On standalone detail page
        console.log("LinkedIn scrapeJobDetail: Scraping from standalone detail page.")
        // Wait for potential dynamic loading on standalone page
        await new Promise(r => setTimeout(r, 500)) // Small delay
        return scrapeCurrentJobDetail()
      } else {
        console.warn("LinkedIn scrapeJobDetail: Could not determine context (search vs standalone) or find panel.")
        return null
      }
    } catch (error) {
      console.error('Error scraping LinkedIn job detail:', error)
      return null
    }
  }
}

// Assign to window object for global access
window.linkedInScraper = linkedInScraper;

