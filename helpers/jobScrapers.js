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
            const baseDelay = 300 // Reduced from 500ms
            // const additionalDelay = 100
            const totalDelay = baseDelay // + additionalDelay
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
        const jobDetail = scrapeSeekJobDetailPanel()
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
            const jobDetail = scrapeSeekJobDetailPanel(basicInfo)

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
    scrapeJobDetail: () => {
      try {
        return scrapeSeekJobDetailPanel()
      } catch (error) {
        console.error('Error scraping SEEK job detail:', error)
        return null
      }
    }
  },
  indeed: {
    isMatch: (url) => url.includes('indeed.com'),
    scrapeJobList: async () => {
      console.group('Indeed - Job Scraping - Click & Scrape')

      // Add a delay before starting the scraping process
      const initialDelay = 4000 // 4 seconds
      console.log(`Indeed: Waiting ${initialDelay}ms before starting scrape...`)
      await new Promise(resolve => setTimeout(resolve, initialDelay))

      const jobs = []
      let nextUrl = null

      // More specific selector targeting the main job card container
      // Using `div.result` which often contains the job_seen_beacon andtextContent
      const jobCardSelector = 'div.result:not(.mosaic-zone) div.job_seen_beacon' // Try targeting beacon within result
      // Fallback if the above doesn't work well
      // const jobCardSelector = 'li div.cardOutline'
      // const jobCardSelector = 'div.jobsearch-SerpJobCard, div.result' // Alternative general selectors

      let jobNodes = document.querySelectorAll(jobCardSelector)

      // If the primary selector fails, try a broader one as fallback
      if (jobNodes.length === 0) {
        console.warn("Primary selector '" + jobCardSelector + "' found 0 nodes. Trying fallback...")
        const fallbackSelector = 'div.jobsearch-SerpJobCard, div.result, div.job_seen_beacon, li > div[class*="cardOutline"]'
        jobNodes = document.querySelectorAll(fallbackSelector)
        console.log('Fallback selector found nodes:', jobNodes.length)
      }

      console.log('Found Indeed job nodes:', jobNodes.length)

      // Check if we're already on a job details page
      const alreadyOnJobDetail = document.querySelector('div.fastviewjob') || document.querySelector('div.jobsearch-ViewJobLayout--embedded')

      // Function to wait for job details panel to load/update
      const waitForJobDetailsPanel = async () => {
        let attempts = 0
        const maxAttempts = 20
        let waitTime = 250 // Start with 250ms

        while (attempts < maxAttempts) {
          // Look for the main container and the description text
          const detailsPanel = document.querySelector('div.fastviewjob') || document.querySelector('div.jobsearch-ViewJobLayout--embedded')
          const descriptionLoaded = detailsPanel && detailsPanel.querySelector('#jobDescriptionText')

          if (detailsPanel && descriptionLoaded && descriptionLoaded.textContent.trim().length > 10) { // Check for non-empty description
            // Wait a bit more to ensure content is fully rendered
            await new Promise(r => setTimeout(r, 500))
            console.log('Indeed details panel detected.')
            return detailsPanel // Return the panel element
          }

          // Exponential backoff
          waitTime = Math.min(waitTime * 1.5, 1800)
          console.log(`Waiting ${waitTime}ms for Indeed job details panel (attempt ${attempts + 1}/${maxAttempts})`)
          await new Promise(r => setTimeout(r, waitTime))
          attempts++
        }
        console.log('Indeed details panel did not load in time.')
        return null // Return null if not found
      }

      // If we're on a standalone job detail page with no job cards
      if (alreadyOnJobDetail && jobNodes.length === 0) {
        console.log('On standalone Indeed job details page, scraping current job')
        const panelElement = await waitForJobDetailsPanel() // Ensure it's loaded
        if (panelElement) {
          const jobDetail = scrapeIndeedJobDetailPanel(panelElement)
          if (jobDetail) {
            jobs.push(jobDetail)
            console.log(`Scraped standalone job: ${jobDetail.title}`)
          }
        } else {
          console.warn('Could not find/load the details panel on standalone page.')
        }
        // Still check for next page even on detail view
        const nextPageLink = document.querySelector('a[data-testid="pagination-page-next"]')
        nextUrl = nextPageLink ? nextPageLink.href : null
        console.groupEnd()
        return { jobs, nextUrl }
      }

      // Process job cards using the click and scrape method
      for (let i = 0; i < Math.min(jobNodes.length, 25); i++) { // Limit to 25 to avoid issues
        const node = jobNodes[i]
        let basicInfo = {}
        let job = null

        try {
          console.log(`\nProcessing Indeed job card ${i + 1}/${Math.min(jobNodes.length, 25)}`)

          // --- 1. Extract Basic Info from Card (Fallback) ---
          const titleNode = node.querySelector([
            'h2.jobTitle a', 'h2 a[data-jk]', 'h2.jobTitle span[title]', 'a[data-jk] span[title]',
            '[class*="jobTitle"]', 'a[id^="job_"]'
          ].join(','))
          const companyNode = node.querySelector([
            'span[data-testid="company-name"]', 'span.css-1h7lukg[data-testid="company-name"]', 'span.companyName',
            '[data-testid="company-name"]', 'div[class*="company"] span', 'span[class*="companyName"]'
          ].join(','))
          const locationNode = node.querySelector([
            'div[data-testid="text-location"]', 'div.css-1restlb[data-testid="text-location"]', 'div.companyLocation',
            'div[class*="location"]', 'div[class*="workplace"]'
          ].join(','))
          const descriptionSnippetNode = node.querySelector([
            'div[data-testid="jobsnippet_footer"] ul li', '.job-snippet ul li', '.underShelfFooter .heading6 ul li'
          ].join(','))
          const postedDateNode = node.querySelector('span.date, span[class*="date"], .jobMetaDataGroup span') // Added more date selectors

          const metadataItems = Array.from(node.querySelectorAll([
            '.metadataContainer li .metadata div[data-testid="attribute_snippet_testid"]',
            '.metadataContainer li div[data-testid="attribute_snippet_testid"]',
            '.metadataContainer li div[data-testid^="attribute_snippet"]',
            '.heading6.tapItem-gutter.metadataContainer .metadata' // Broader metadata selector
          ].join(',')))
            .map(el => el?.textContent?.trim())
            .filter(text => text)


          const salaryText = metadataItems.find(text => text.includes('$') || text.match(/salary|pay/i)) || ''
          const jobTypeText = metadataItems.find(text =>
            /\b(Full-time|Part-time|Contract|Temporary|Internship|Casual|Contractor)\b/i.test(text)
          ) || ''
          const jobType = jobTypeText.match(/\b(Full-time|Part-time|Contract|Temporary|Internship|Casual|Contractor)\b/i)?.[0] || ''

          // Extract workplace type (Hybrid, Remote) if available on card
          const workplaceTypeCardText = metadataItems.find(text =>
            /\b(Hybrid|Remote)\b/i.test(text)
          ) || locationNode?.textContent?.match(/\b(Hybrid|Remote)\b/i)?.[0] || ''


          const descriptionSnippet = descriptionSnippetNode?.textContent?.trim().replace(/…$/, '').replace(/\s+/g, ' ').trim() || ''
          const companyLogoUrl = node.querySelector('img.companyAvatar, [data-testid="companyAvatar"] img')?.src || null // Added testid selector

          // Attempt to find job URL from various places
          let jobUrl = ''
          const titleLink = node.querySelector('h2.jobTitle a[data-jk], a.jcs-JobTitle[data-jk]')
          if (titleLink?.href) {
            jobUrl = titleLink.href
          } else {
            const cardLink = node.closest('a') || node.querySelector('a')
            if (cardLink?.href && cardLink.href.includes('/clk?')) {
              // Use data-jk attribute to construct a more stable URL if possible
              const jobKey = node.querySelector('[data-jk]')?.getAttribute('data-jk') || node.closest('[data-jk]')?.getAttribute('data-jk')
              if (jobKey) {
                jobUrl = `https://au.indeed.com/viewjob?jk=${jobKey}` // Adapt domain if needed
              } else {
                jobUrl = cardLink.href // Fallback to click URL
              }
            } else if (cardLink?.href) {
              jobUrl = cardLink.href // Fallback to any link href
            }
          }


          if (jobUrl && !jobUrl.startsWith('http')) {
            jobUrl = new URL(jobUrl, window.location.href).href // Make URL absolute
          }


          basicInfo = {
            title: titleNode?.textContent?.trim() || '',
            company: companyNode?.textContent?.trim() || '',
            location: locationNode?.textContent?.trim() || '',
            jobUrl: jobUrl,
            description: descriptionSnippet,
            salary: salaryText,
            postedDate: postedDateNode?.textContent?.trim().replace('Posted', '').trim() || '',
            companyLogoUrl: companyLogoUrl,
            jobType: jobType,
            workplaceType: workplaceTypeCardText,
            applicantCount: '' // Not usually on Indeed card
          }

          if (!basicInfo.title) {
            console.warn(`Skipping card ${i + 1} due to missing title.`)
            continue // Skip if essential info missing
          }

          console.log(`Basic info for card ${i + 1}: ${basicInfo.title} at ${basicInfo.company}`)

          // --- 2. Click Card to Load Details ---
          const clickableElement =
            node.querySelector('h2 a[data-jk], a.jcs-JobTitle[data-jk]') || // Specific title links
            node.querySelector('a[id^="sj_"]') || // Specific ID links
            node.closest('a') || // The whole card might be a link
            titleNode || // Fallback to title node itself
            node // Absolute fallback to the node

          if (!clickableElement) {
            console.warn(`Could not find clickable element for card ${i + 1}. Using basic info.`)
            job = Job.createFromIndeed(basicInfo)
            jobs.push(job)
            continue
          }

          console.log(`Clicking element for job ${i + 1}:`, clickableElement.tagName, clickableElement.className)
          clickableElement.click()

          // --- 3. Wait for and Scrape Details Panel ---
          const panelElement = await waitForJobDetailsPanel()

          if (panelElement) {
            console.log(`Panel loaded for job ${i + 1}. Scraping details...`)
            const jobDetail = scrapeIndeedJobDetailPanel(panelElement, basicInfo) // Pass basicInfo as fallback

            if (jobDetail && jobDetail.title) { // Ensure detail scraping was successful
              job = jobDetail
              console.log(`Successfully scraped detailed Indeed job: ${job.title}`)
            } else {
              console.warn(`Detailed scraping failed for job ${i + 1}. Using basic info.`)
              job = Job.createFromIndeed(basicInfo) // Fallback to basic
            }
          } else {
            console.warn(`Details panel did not load for job ${i + 1}. Using basic info.`)
            job = Job.createFromIndeed(basicInfo) // Fallback to basic
          }

          jobs.push(job)

          // --- 4. Delay ---
          const baseDelay = 300
          const totalDelay = baseDelay
          console.log(`Waiting ${totalDelay}ms before next Indeed job click...`)
          await new Promise(r => setTimeout(r, totalDelay))

        } catch (error) {
          console.error(`Error processing Indeed job ${i + 1}:`, error)
          if (basicInfo.title) { // If we got basic info, add it as a fallback
            console.log("Adding job with basic info due to error during processing.")
            job = Job.createFromIndeed(basicInfo)
            jobs.push(job)
          }
          // Add error recovery delay
          await new Promise(r => setTimeout(r, 1500))
        }
      }

      // Get next page URL (check after loop)
      const nextPageLink = document.querySelector('a[data-testid="pagination-page-next"]')
      nextUrl = nextPageLink ? nextPageLink.href : null

      console.log(`Scraped ${jobs.length} jobs from Indeed page`)
      console.log('Next Indeed page URL:', nextUrl)
      console.groupEnd()

      return {
        jobs,
        nextUrl
      }
    },
    scrapeJobDetail: () => {
      try {
        const panel = document.querySelector('div.fastviewjob') || document.querySelector('div.jobsearch-ViewJobLayout--embedded')
        if (panel) {
          return scrapeIndeedJobDetailPanel(panel)
        } else {
          console.warn("scrapeJobDetail called but no Indeed panel found.")
          return null
        }
      } catch (error) {
        console.error('Error in Indeed scrapeJobDetail:', error)
        return null
      }
    }
  }
}

// Export the objects to make them available in content.js
window.Job = Job
window.scrapers = scrapers

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
    const descriptionContainer = mainContainer.querySelector('div.description__text, .jobs-description-content__text, div#job-details, div[class*="jobs-box__html-content"]')
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

// Helper function to scrape the SEEK job detail panel
function scrapeSeekJobDetailPanel (basicInfo = {}) {
  try {
    // Job details panel
    const panel = document.querySelector('[data-automation="jobDetailsPage"]')
    if (!panel) {
      console.warn('SEEK job details panel not found')
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
    const description = descriptionElement ? descriptionElement.textContent.trim() : ''

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

// **** NEW HELPER FUNCTION for Indeed Details Panel ****
function scrapeIndeedJobDetailPanel (panelElement, basicInfo = {}) {
  console.log("Attempting to scrape Indeed detail panel...")
  if (!panelElement) {
    console.error("scrapeIndeedJobDetailPanel called with null panelElement.")
    return null
  }

  try {
    // --- Extractors based on provided detail HTML ---
    const titleElement = panelElement.querySelector('h2[data-testid="simpler-jobTitle"]')
    const companyElement = panelElement.querySelector('span.jobsearch-JobInfoHeader-companyNameSimple')
    const locationElement = panelElement.querySelector('div[data-testid="jobsearch-JobInfoHeader-companyLocation"] div:first-child') // Get the div containing location and maybe work type
    const descriptionElement = panelElement.querySelector('#jobDescriptionText')
    const jobDetailsContainer = panelElement.querySelector('#jobDetailsSection') // Container for salary, job type etc.

    // --- Basic Info ---
    const title = titleElement?.textContent?.trim() || basicInfo.title || ''
    const company = companyElement?.textContent?.trim() || basicInfo.company || ''
    const jobUrl = window.location.href.split('?')[0] || basicInfo.jobUrl || '' // Use current URL primarily

    // --- Location & Workplace Type ---
    let location = ''
    let workplaceType = ''
    if (locationElement) {
      const locationText = locationElement.textContent.trim()
      // Example: "Sydney NSW 2000 • Hybrid work" or just "Sydney NSW 2000" or "Remote"
      if (locationText.includes('Hybrid work')) {
        workplaceType = 'Hybrid'
        location = locationText.replace('• Hybrid work', '').trim()
      } else if (locationText.includes('Remote')) {
        workplaceType = 'Remote'
        location = locationText.replace('• Remote', '').trim() // Or just set location to 'Remote' if that's all there is
        if (location.toLowerCase() === 'remote') location = '' // Clear location if it was just 'Remote'
      } else {
        location = locationText // Assume it's just the location
        workplaceType = 'On-site' // Default assumption if not specified
      }
    }
    // Fallback from basic info if needed
    location = location || basicInfo.location || ''
    workplaceType = workplaceType || basicInfo.workplaceType || '' // Prioritize panel, then card

    // --- Salary & Job Type from Details Panel ---
    let salary = ''
    let jobType = ''
    if (jobDetailsContainer) {
      const payElement = jobDetailsContainer.querySelector('[aria-label="Pay"] [data-testid*="-tile"] span')
      const jobTypeElement = jobDetailsContainer.querySelector('[aria-label="Job type"] [data-testid*="-tile"] span')

      salary = payElement?.textContent?.trim() || ''
      jobType = jobTypeElement?.textContent?.trim() || ''

      // Refine job type extraction if it contains extra text
      const jobTypeMatch = jobType.match(/\b(Full-time|Part-time|Contract|Temporary|Internship|Casual|Contractor)\b/i)
      jobType = jobTypeMatch ? jobTypeMatch[0] : ''
    }
    // Fallback from basic info
    salary = salary || basicInfo.salary || ''
    jobType = jobType || basicInfo.jobType || ''


    // --- Description ---
    let description = ''
    if (descriptionElement) {
      // Use a similar cleaning approach as LinkedIn/SEEK
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = descriptionElement.innerHTML

      // Replace <p> and <br> with newlines
      tempDiv.querySelectorAll('p, br').forEach(el => el.replaceWith('\n'))
      // Handle lists
      tempDiv.querySelectorAll('li').forEach(li => {
        li.prepend(document.createTextNode('• '))
        li.appendChild(document.createTextNode('\n'))
      })
      // Handle bold
      tempDiv.querySelectorAll('b, strong').forEach(strong => {
        const boldText = strong.textContent.trim()
        if (boldText) {
          strong.replaceWith(document.createTextNode(`**${boldText}**`))
        } else {
          strong.remove() // Remove empty bold tags
        }
      })

      // Remove remaining HTML tags
      tempDiv.querySelectorAll(':not(p):not(br):not(li):not(b):not(strong)').forEach(el => {
        if (el.innerHTML) {
          el.replaceWith(...el.childNodes) // Replace tag with its content
        } else {
          el.remove() // Remove empty tags
        }
      })


      description = tempDiv.textContent || ''
      description = description.replace(/\n{3,}/g, '\n\n').trim() // Clean up excessive newlines
    }
    description = description || basicInfo.description || '' // Fallback to snippet


    // --- Other fields (less likely in panel, use basicInfo) ---
    const postedDate = basicInfo.postedDate || '' // Usually not in the detail panel view
    const companyLogoUrl = basicInfo.companyLogoUrl || null // Use logo from card
    const applicantCount = basicInfo.applicantCount || '' // N/A for Indeed typically

    if (!title || !company) {
      console.warn("Failed to extract essential details (title or company) from Indeed panel. Returning null.", { title, company })
      return null // Return null if essential details are missing
    }

    const job = Job.createFromIndeed({
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
      applicantCount,
    })

    console.log('Successfully scraped Indeed job detail from panel:', job)
    return job

  } catch (error) {
    console.error('Error scraping Indeed job details panel:', error)
    // Attempt to return basic info as a last resort if available
    if (basicInfo && basicInfo.title) {
      console.warn("Returning basic info due to error during panel scraping.")
      return Job.createFromIndeed(basicInfo)
    }
    return null
  }
} 