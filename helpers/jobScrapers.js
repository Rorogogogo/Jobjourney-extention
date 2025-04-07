class Job {
  constructor({
    title,
    company,
    location,
    jobUrl,
    description = '',
    salary = '',
    postedDate = '',
    companyLogoUrl = null,
    platform,
    jobType = '',
    workplaceType = '',
    applicantCount = ''
  }) {
    this.title = title?.trim() || ''
    this.company = company?.trim() || ''
    this.location = location?.trim() || ''
    this.jobUrl = jobUrl || ''
    this.description = description?.trim() || ''
    this.salary = salary?.trim() || ''
    this.postedDate = postedDate?.trim() || ''
    this.companyLogoUrl = companyLogoUrl || null
    this.platform = platform || ''
    this.jobType = jobType?.trim() || ''
    this.workplaceType = workplaceType?.trim() || ''
    this.applicantCount = applicantCount?.trim() || ''
  }

  static createFromLinkedIn (data) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'LinkedIn',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || ''
    })
  }

  static createFromSEEK (data) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'SEEK',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || ''
    })
  }

  static createFromIndeed (data) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'Indeed',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || ''
    })
  }
}

// Job scraping functions for different platforms
const scrapers = {
  linkedin: {
    isMatch: (url) => url.includes('linkedin.com'),
    scrapeJobList: async () => {
      let jobs = []
      console.log('=== LinkedIn Scraping Started ===')
      console.log('Current URL:', window.location.href)

      // Only use the new job card selector for better performance
      const jobNodes = document.querySelectorAll('div.job-card-job-posting-card-wrapper')
      console.log('Found LinkedIn job nodes:', jobNodes.length)

      // Check if we're already on a job details page with no job cards
      const alreadyOnJobDetail = document.querySelector('.jobs-search__job-details--container') ||
        document.querySelector('.jobs-details__main-content')
      const detailsAlreadyOpen = !!alreadyOnJobDetail

      // If we're on a standalone job detail page with no job cards
      if (detailsAlreadyOpen && jobNodes.length === 0) {
        console.log('On standalone job details page, scraping current job')
        const jobDetail = await scrapeCurrentJobDetail()
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

            // Add a longer delay between job clicks to avoid rate limiting
            // Use an increasing delay as we process more jobs (starts at 1s, increases by 200ms each time)
            const baseDelay = 500
            const additionalDelay = i * 200
            const totalDelay = baseDelay + additionalDelay
            console.log(`Waiting ${totalDelay}ms before next job click to avoid rate limiting...`)
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
    scrapeJobDetail: () => {
      try {
        return scrapeCurrentJobDetail()
      } catch (error) {
        console.error('Error scraping LinkedIn job detail:', error)
        return null
      }
    }
  },
  seek: {
    isMatch: (url) => url.includes('seek.com.au') || url.includes('seek.co.nz'),
    scrapeJobList: async () => {
      const jobs = []
      console.log('=== SEEK Scraping Started ===')
      console.log('Current URL:', window.location.href)

      // Try multiple possible selectors
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

      jobNodes.forEach(node => {
        try {
          console.log(`\nProcessing SEEK job:`)

          const titleNode =
            node.querySelector('[data-testid="job-card-title"]') ||
            node.querySelector('a[data-automation="jobTitle"]') ||
            node.querySelector('a[class*="job-title"]') ||
            node.querySelector('a[id^="job-title"]')

          const companyNode =
            node.querySelector('[data-automation="jobCompany"]') ||
            node.querySelector('span[class*="l1r1184z"] a[data-automation="jobCompany"]') ||
            node.querySelector('div.snwpn00 a[data-automation="jobCompany"]') ||
            node.querySelector('span._1l99f880 a[data-type="company"]')

          const locationNode =
            node.querySelector('span[data-automation="jobCardLocation"]') ||
            node.querySelector('a[data-automation="jobLocation"]') ||
            node.querySelector('span[data-type="location"]')

          const descriptionNode = node.querySelector('span[data-testid="job-card-teaser"]')
          const salaryNode = node.querySelector('span[data-automation="jobSalary"]')
          const postedDateNode = node.querySelector('span[data-automation="jobListingDate"] div._1kme6z20')

          if (titleNode && companyNode) {
            const job = Job.createFromSEEK({
              title: titleNode.textContent.trim(),
              company: companyNode.textContent.trim(),
              location: locationNode?.textContent?.trim(),
              jobUrl: titleNode.href || window.location.href,
              description: descriptionNode?.textContent?.trim(),
              salary: salaryNode?.textContent?.trim(),
              postedDate: postedDateNode?.textContent?.trim(),
              companyLogoUrl: null,
              jobType: '',
              workplaceType: '',
              applicantCount: ''
            })
            console.log('Successfully scraped SEEK job:', job)
            jobs.push(job)
          }
        } catch (error) {
          console.error('Error scraping SEEK job:', error)
        }
      })

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
    scrapeJobDetail: () => {
      try {
        const title = document.querySelector('[data-automation="job-detail-title"]')?.textContent.trim()
        const company = document.querySelector('[data-automation="advertiser-name"]')?.textContent.trim()
        const location = document.querySelector('[data-automation="job-location"]')?.textContent.trim()
        const description = document.querySelector('[data-automation="jobDescription"]')?.textContent.trim()
        const logoUrl = document.querySelector('[data-automation="advertiser-logo"] img')?.src
        const workType = document.querySelector('[data-automation="job-work-type"]')?.textContent.trim()
        const salary = document.querySelector('[data-automation="job-salary"]')?.textContent.trim()

        const job = {
          title,
          company,
          location,
          description,
          companyLogoUrl: logoUrl,
          jobUrl: window.location.href,
          platform: 'SEEK',
          workType: workType || '',
          salary: salary || '',
          workplaceType: '',
          applicantCount: ''
        }
        console.log('Scraped SEEK job detail:', job)
        return job
      } catch (error) {
        console.error('Error scraping SEEK job detail:', error)
        return null
      }
    }
  },
  indeed: {
    isMatch: (url) => url.includes('indeed.com'),
    scrapeJobList: async () => {
      console.group('Indeed - Job Scraping')
      const jobs = []

      const jobNodes = document.querySelectorAll([
        'div.job_seen_beacon',
        'div[class*="job_seen_"]',
        'div[class*="cardOutline"]',
        'div.resultContent',
        'div[data-testid="job-card"]',
        'td.resultContent'
      ].join(','))

      console.log('Found Indeed job nodes:', jobNodes.length)

      // Scrape current page
      jobNodes.forEach((node, index) => {
        try {
          console.log(`\nProcessing Indeed job ${index + 1}:`)

          const titleNode = node.querySelector([
            'h2.jobTitle a',
            'h2 a[data-jk]',
            'h2.jobTitle span[title]',
            'a[data-jk] span[title]',
            '[class*="jobTitle"]',
            'a[id^="job_"]'
          ].join(','))

          const companyNode = node.querySelector([
            'span[data-testid="company-name"]',
            'span.css-1h7lukg[data-testid="company-name"]',
            'span.companyName',
            '[data-testid="company-name"]',
            'div[class*="company"] span',
            'span[class*="companyName"]'
          ].join(','))

          const locationNode = node.querySelector([
            'div[data-testid="text-location"]',
            'div.css-1restlb[data-testid="text-location"]',
            'div.companyLocation',
            'div[class*="location"]',
            'div[class*="workplace"]'
          ].join(','))

          const descriptionNode = node.querySelector([
            'div[data-testid="jobsnippet_footer"] ul li',
            '.job-snippet',
            '.underShelfFooter .heading6 ul li'
          ].join(','))

          const postedDateNode = node.querySelector('span.date')

          // Get all metadata items and clean up text content
          const metadataItems = Array.from(node.querySelectorAll([
            '.metadataContainer li .metadata div[data-testid="attribute_snippet_testid"]',
            '.metadataContainer li div[data-testid="attribute_snippet_testid"]',
            '.metadataContainer li div[data-testid^="attribute_snippet"]'
          ].join(',')))
            .map(el => {
              const textContent = Array.from(el.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent.trim())
                .join(' ')
                .split('+')[0]
                .trim()

              return textContent || el.textContent.trim().split('+')[0].trim()
            })
            .filter(text => text)

          const salaryText = metadataItems.find(text => text.includes('$'))
          const jobTypeText = metadataItems.find(text =>
            /\b(Full-time|Part-time|Contract|Temporary|Internship|Casual|Contractor)\b/i.test(text)
          )
          const jobType = jobTypeText?.match(/\b(Full-time|Part-time|Contract|Temporary|Internship|Casual|Contractor)\b/i)?.[0] || ''

          const description = descriptionNode?.textContent?.trim()
            .replace(/…$/, '')
            .replace(/\s+/g, ' ')
            .trim()

          if (titleNode && companyNode) {
            let jobUrl = ''
            if (titleNode.href) {
              jobUrl = titleNode.href
            } else if (titleNode.closest('a')?.href) {
              jobUrl = titleNode.closest('a').href
            } else if (node.querySelector('a[data-jk]')?.href) {
              jobUrl = node.querySelector('a[data-jk]').href
            }

            if (!jobUrl.startsWith('http')) {
              jobUrl = 'https://indeed.com' + jobUrl
            }

            const job = Job.createFromIndeed({
              title: titleNode.textContent.trim(),
              company: companyNode.textContent.trim(),
              location: locationNode?.textContent?.trim(),
              jobUrl: jobUrl,
              description: description,
              salary: salaryText || '',
              postedDate: postedDateNode?.textContent?.trim(),
              companyLogoUrl: node.querySelector('img.companyAvatar')?.src || null,
              jobType: jobType,
              workplaceType: '',
              applicantCount: ''
            })

            console.log('Successfully scraped Indeed job:', job)
            jobs.push(job)
          }
        } catch (error) {
          console.error('Error scraping Indeed job:', error)
        }
      })

      // Get next page URL
      const nextPageLink = document.querySelector('a[data-testid="pagination-page-next"]')
      const nextUrl = nextPageLink ? nextPageLink.href : null

      console.log(`Scraped ${jobs.length} jobs from current page`)
      console.log('Next page URL:', nextUrl)
      console.groupEnd()

      return {
        jobs,
        nextUrl
      }
    },
    scrapeJobDetail: () => {
      try {
        const title = document.querySelector('h1.jobsearch-JobInfoHeader-title')?.textContent.trim()
        const company = document.querySelector('div.jobsearch-CompanyInfoContainer a')?.textContent.trim()
        const location = document.querySelector('div.jobsearch-JobInfoHeader-subtitle div')?.textContent.trim()
        const description = document.querySelector('div#jobDescriptionText')?.textContent.trim()
        const logoUrl = document.querySelector('img.jobsearch-CompanyAvatar-image')?.src
        const salary = document.querySelector('div[data-testid="attribute_snippet_compensation"]')?.textContent.trim()
        const jobType = document.querySelector('div[data-testid="attribute_snippet_job_type"]')?.textContent.trim()

        const job = {
          title,
          company,
          location,
          description,
          companyLogoUrl: logoUrl,
          jobUrl: window.location.href,
          platform: 'Indeed',
          salary: salary || '',
          jobType: jobType || '',
          workplaceType: '',
          applicantCount: ''
        }
        console.log('Scraped Indeed job detail:', job)
        return job
      } catch (error) {
        console.error('Error scraping Indeed job detail:', error)
        return null
      }
    }
  }
}

// Export the objects to make them available in content.js
window.Job = Job
window.scrapers = scrapers

// Helper function to scrape the current job detail page
function scrapeCurrentJobDetail () {
  try {
    const title = document.querySelector('h1.top-card-layout__title, .job-details-jobs-unified-top-card__job-title')?.textContent.trim()
    const company = document.querySelector('a.topcard__org-name-link, .job-details-jobs-unified-top-card__company-name')?.textContent.trim()

    // Get the combined location, posted date, and applicant count
    const metaInfo = document.querySelector('.jobs-unified-top-card__subtitle-primary-grouping, .job-details-jobs-unified-top-card__primary-description-container')?.textContent.trim()

    // Parse location, posted date and applicant count from the combined text
    let location = ''
    let postedDate = ''
    let applicantCount = ''

    if (metaInfo) {
      // Split by bullet character to separate the different pieces of information
      const parts = metaInfo.split('·').map(part => part.trim())

      if (parts.length >= 1) {
        // First part is typically the location
        location = parts[0]
      }

      if (parts.length >= 2) {
        // Second part is typically the posted date
        postedDate = parts[1]
      }

      if (parts.length >= 3) {
        // Third part is typically the applicant count
        applicantCount = parts[2]
      }
    }

    // Get detailed description - extract and clean the content
    let description = ''
    const descriptionContainer = document.querySelector('div.description__text, .jobs-description-content__text, div#job-details, div[class*="jobs-box__html-content"]')

    if (descriptionContainer) {
      // First try to get the actual job description content, excluding the "About the job" heading
      const contentDiv = descriptionContainer.querySelector('.mt4') || descriptionContainer
      if (contentDiv) {
        // Create a temporary div to help with cleaning
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = contentDiv.innerHTML

        // Remove all HTML comments
        const commentNodes = tempDiv.querySelectorAll('*')
        commentNodes.forEach(node => {
          for (let i = 0; i < node.childNodes.length; i++) {
            if (node.childNodes[i].nodeType === 8) { // Comment node
              node.removeChild(node.childNodes[i])
              i--
            }
          }
        })

        // Clean up empty spans and other tags that only contain comments
        cleanupEmptyTags(tempDiv)

        // Get the cleaned content with only the text and minimal formatting
        description = cleanAndFormatContent(tempDiv)
      }
    }

    // Get company logo
    const logoUrl = document.querySelector('img.artdeco-entity-image, .ivm-view-attr__img--centered')?.src

    // Extract job labels (workplace type, job type) from the UI pills
    let workplaceType = ''
    let jobType = ''
    let salary = ''

    // Get all pill elements that might contain job metadata
    const pillElements = document.querySelectorAll('.job-details-preferences-and-skills__pill, .ui-label')

    pillElements.forEach(pill => {
      const pillText = pill.textContent.trim()

      // Check for workplace type
      if (pillText.includes('Remote') || pillText.includes('Hybrid') || pillText.includes('On-site')) {
        if (pillText.includes('Remote')) workplaceType = 'Remote'
        else if (pillText.includes('Hybrid')) workplaceType = 'Hybrid'
        else if (pillText.includes('On-site')) workplaceType = 'On-site'
      }

      // Check for job type
      else if (pillText.includes('Full-time') || pillText.includes('Part-time') ||
        pillText.includes('Contract') || pillText.includes('Temporary') ||
        pillText.includes('Internship') || pillText.includes('Volunteer')) {
        // Extract just the job type from the text
        const jobTypeMatch = pillText.match(/\b(Full-time|Part-time|Contract|Temporary|Internship|Casual|Contractor)\b/)
        if (jobTypeMatch) jobType = jobTypeMatch[0]
      }

      // Check for salary - usually contains currency symbols or ranges
      else if (pillText.match(/\$|\€|\£|\¥|\₹|\/yr|\/hour|\/month|\/week/) || pillText.match(/\d+K|salary/i)) {
        salary = pillText.replace(/[^a-zA-Z0-9$€£¥₹\-.,\/\s]/g, '').trim()
      }
    })

    // Fallback to existing methods if nothing found in pills
    if (!salary) {
      const salaryContainer = document.querySelector('.compensation__salary-range, [class*="salary"]')
      if (salaryContainer) salary = salaryContainer.textContent.trim()
    }

    // Get work type information from existing place as fallback
    if (!jobType) {
      const employmentLabels = Array.from(document.querySelectorAll('.ui-label.ui-label--accent-3.text-body-small'))
        .map(el => el.textContent.trim())
        .join(', ')

      if (employmentLabels) {
        const jobTypeMatch = employmentLabels.match(/\b(Full-time|Part-time|Contract|Temporary|Internship|Volunteer)\b/)
        if (jobTypeMatch) jobType = jobTypeMatch[0]
      }
    }

    const job = {
      title,
      company,
      location,
      description,
      companyLogoUrl: logoUrl,
      jobUrl: window.location.href,
      platform: 'LinkedIn',
      jobType,
      workplaceType,
      postedDate,
      salary,
      applicantCount
    }

    console.log('Scraped LinkedIn job detail:', job)
    return job
  } catch (error) {
    console.error('Error in scrapeCurrentJobDetail:', error)
    return null
  }
}

// Scrape detailed job information from the open panel
const scrapeJobDetailFromPanel = () => {
  try {
    // Job details panel
    const panel = document.querySelector('.jobs-search__job-details--container')
    if (!panel) {
      console.warn('Job details panel not found')
      return null
    }

    // Title
    const titleElement = panel.querySelector('h2')
    const title = titleElement ? titleElement.textContent.trim() : ''

    // Company name
    const companyElement = panel.querySelector('.jobs-unified-top-card__company-name')
    const company = companyElement ? companyElement.textContent.trim() : ''

    // Location and metadata text
    const metadataElement = panel.querySelector('.jobs-unified-top-card__primary-description')
    let location = ''
    let postedDate = ''
    let applicantCount = ''

    if (metadataElement) {
      const metadataText = metadataElement.textContent.trim()

      // Parse location, posted date, and applicant count from the metadata
      const parts = metadataText.split('·').map(part => part.trim())

      if (parts.length > 0) {
        location = parts[0]
      }

      if (parts.length > 1) {
        // Check if this part contains "ago" which indicates it's the posted date
        if (parts[1].includes('ago')) {
          postedDate = parts[1]
        }
      }

      // Look for the applicant count (format: "XX applicants")
      const applicantPart = parts.find(part => part.includes('applicant'))
      if (applicantPart) {
        applicantCount = applicantPart
      }
    }

    // Job type (Remote, On-site, Hybrid)
    const workplaceTypeElement = panel.querySelector('.jobs-unified-top-card__workplace-type')
    const workplaceType = workplaceTypeElement ? workplaceTypeElement.textContent.trim() : ''

    // Job Type (Full-time, Part-time, Contract)
    const jobTypeElement = panel.querySelector('.jobs-unified-top-card__job-insight:nth-child(1)')
    const jobType = jobTypeElement ? jobTypeElement.textContent.trim() : ''

    // Salary info (if available)
    const salaryElement = panel.querySelector('.jobs-unified-top-card__salary-details, .jobs-unified-top-card__job-insight:nth-child(2)')
    const salary = salaryElement && salaryElement.textContent.includes('$') ? salaryElement.textContent.trim() : ''

    // Company logo URL
    const logoElement = panel.querySelector('.jobs-unified-top-card__company-logo')
    const companyLogoUrl = logoElement ? logoElement.src : null

    // Get job URL from URL bar as it's the most reliable way
    const jobUrl = window.location.href.split('?')[0] // Remove any query parameters

    // Description - this part needs enhanced handling for <br> tags
    const descriptionElement = panel.querySelector('.jobs-description-content__text, .jobs-box__html-content')

    let description = ''
    if (descriptionElement) {
      // First try to use innerText which should handle most formatting naturally
      description = descriptionElement.innerText

      // If innerText failed or produced poor results, try a more advanced approach
      if (!description || description.trim() === '') {
        // Clone the element to avoid modifying the actual DOM
        const clone = descriptionElement.cloneNode(true)

        // Replace all <br> and <p> tags with newlines before getting text
        // This handles both standalone <br> and nested <br> tags
        const allBrTags = clone.querySelectorAll('br')
        allBrTags.forEach(br => {
          br.replaceWith('\n')
        })

        // Also handle paragraph breaks
        const allPTags = clone.querySelectorAll('p')
        allPTags.forEach(p => {
          p.appendChild(document.createTextNode('\n\n'))
        })

        // Handle list items
        const allLiTags = clone.querySelectorAll('li')
        allLiTags.forEach(li => {
          li.prepend(document.createTextNode('• '))
          li.appendChild(document.createTextNode('\n'))
        })

        // Get the text and clean it up
        description = clone.textContent || clone.innerText || ''

        // Clean up excessive whitespace while preserving paragraph breaks
        description = description.replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
          .trim()
      }
    }

    return {
      title,
      company,
      location,
      salary,
      description,
      postedDate,
      jobUrl,
      companyLogoUrl,
      workplaceType,
      jobType,
      applicantCount
    }
  } catch (error) {
    console.error('Error scraping job details:', error)
    return null
  }
}

// Helper function to clean up empty tags and those that only contain comments

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