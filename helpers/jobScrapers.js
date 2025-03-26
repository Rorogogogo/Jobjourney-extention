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
    jobType = ''
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
      platform: 'LinkedIn'
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
      platform: 'SEEK'
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
      jobType: data.jobType
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

      // Process jobs using the new LinkedIn format
      if (jobNodes.length > 0) {
        console.log('Processing jobs using LinkedIn format')

        jobNodes.forEach(node => {
          try {
            // New format selectors based on the updated HTML structure
            const titleNode = node.querySelector('.artdeco-entity-lockup__title')
            const companyNode = node.querySelector('.artdeco-entity-lockup__subtitle div[dir="ltr"]')
            const locationNode = node.querySelector('.artdeco-entity-lockup__caption div[dir="ltr"]')
            const jobUrlNode = node.querySelector('a.job-card-job-posting-card-wrapper__card-link')
            const logoNode = node.querySelector('.ivm-view-attr__img--centered')

            // Extract job ID for reference
            const jobId = node.getAttribute('data-job-id')

            // Try to get posted date or application status
            const footerItems = Array.from(node.querySelectorAll('.job-card-job-posting-card-wrapper__footer-item'))
              .map(el => el.textContent.trim())
              .filter(text => text)

            if (titleNode && companyNode) {
              // Clean up the title
              let title = titleNode.textContent.trim()

              const job = Job.createFromLinkedIn({
                title: title,
                company: companyNode.textContent.trim(),
                location: locationNode?.textContent?.trim(),
                salary: '', // Salary information might not be available in the new format
                description: '', // Description is not directly available in the card
                postedDate: footerItems.join(' - '), // Use footer items as date/status information
                jobUrl: jobUrlNode?.href || window.location.href,
                companyLogoUrl: logoNode?.src
              })
              jobs.push(job)
            }
          } catch (error) {
            console.error('Error scraping LinkedIn job:', error)
          }
        })
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
                companyLogoUrl: logoNode?.src || null
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
        const title = document.querySelector('h1.top-card-layout__title')?.textContent.trim()
        const company = document.querySelector('a.topcard__org-name-link')?.textContent.trim()
        const location = document.querySelector('span.topcard__flavor--bullet')?.textContent.trim()
        const description = document.querySelector('div.description__text')?.textContent.trim()
        const logoUrl = document.querySelector('img.artdeco-entity-image')?.src
        const workplaceType = document.querySelector('span.workplace-type')?.textContent.trim()
        const employmentType = document.querySelector('span.job-type')?.textContent.trim()

        const job = {
          title,
          company,
          location,
          description,
          companyLogoUrl: logoUrl,
          jobUrl: window.location.href,
          platform: 'LinkedIn',
          workArrangement: workplaceType || '',
          employmentType: employmentType || ''
        }
        console.log('Scraped LinkedIn job detail:', job)
        return job
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
              companyLogoUrl: null
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
          salary: salary || ''
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
              jobType: jobType
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
          jobType: jobType || ''
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