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

      // Remove remaining HTML tags (Simplified removal - might need refinement)
      // Replace remaining tags with their text content to avoid data loss
      Array.from(tempDiv.querySelectorAll('*:not(p):not(br):not(li):not(b):not(strong)')).forEach(el => {
        if (el.parentNode) { // Ensure element is still in the DOM
          el.replaceWith(...el.childNodes) // Replace tag with its content
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

// Indeed scraper object
const indeedScraper = {
  isMatch: (url) => url.includes('indeed.com'),
  scrapeJobList: async () => {
    console.group('Indeed - Job Scraping - Click & Scrape')

    // Add a delay before starting the scraping process
    const initialDelay = 5000 // 4 seconds
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
      const maxAttempts = 10
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

// Assign to window object for global access
window.indeedScraper = indeedScraper;

