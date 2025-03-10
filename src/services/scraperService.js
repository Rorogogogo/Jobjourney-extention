// Function to wait for page load
function waitForPageLoad (tabId) {
  return new Promise((resolve) => {
    function listener (updatedTabId, info) {
      if (updatedTabId === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener)
        // Give extra time for scripts to initialize
        setTimeout(resolve, 2000)
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
  })
}

// Function to scrape from a single tab
async function scrapeFromTab (tab) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { action: 'scrapeJobs' }, (response) => {
      console.group('Tab Scraping Debug')
      console.log('Tab URL:', tab.url)
      console.log('Initial response:', response)

      if (chrome.runtime.lastError) {
        console.error(`Error with tab ${tab.id}:`, chrome.runtime.lastError)
        console.groupEnd()
        resolve([])
      } else if (response && response.success) {
        console.log('response:', response)
        const jobs = response.data || []

        // Remove duplicates
        console.log('Total jobs before deduplication:', jobs.length)
        const uniqueJobs = removeDuplicateJobs(jobs)
        console.log('Total jobs after deduplication:', uniqueJobs.length)
        console.groupEnd()
        resolve(uniqueJobs)
      } else {
        console.groupEnd()
        resolve([])
      }
    })
  })
}

// Function to remove duplicate jobs
function removeDuplicateJobs (jobs) {
  const seen = new Set()
  return jobs.filter(job => {
    const key = `${job.title}-${job.company}-${job.location}`.toLowerCase()
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

// Function to handle pagination for any platform
async function scrapeWithPagination (tab, platform, progressCallback) {
  let allJobs = []
  let pageNum = 1

  try {
    // Get the current tab info to ensure we have the URL
    const currentTab = await chrome.tabs.get(tab.id)
    let currentUrl = currentTab.url
    console.log(`Initial ${platform} URL:`, currentUrl)

    // Show overlay and set scraping state at the start
    await chrome.storage.local.set({ isScrapingActive: true })
    await chrome.tabs.sendMessage(tab.id, { action: 'showScrapeOverlay' })

    while (currentUrl) {
      console.log(`${platform} - Processing page ${pageNum}, URL:`, currentUrl)

      // Check if tab still exists
      try {
        await chrome.tabs.get(tab.id)
      } catch (error) {
        console.log(`Tab was closed for ${platform}, returning collected jobs`)
        await chrome.storage.local.set({ isScrapingActive: false })
        return allJobs
      }

      // Update tab URL if not first page
      if (currentUrl !== currentTab.url) {
        console.log("Updating tab URL to:", currentUrl)
        await chrome.tabs.update(tab.id, { url: currentUrl })
        await waitForPageLoad(tab.id)
        // The overlay will be automatically restored by the content script
      }

      // Update progress with current page number
      progressCallback(pageNum)

      // Scrape current page
      const response = await new Promise(resolve => {
        chrome.tabs.sendMessage(tab.id, { action: 'scrapeJobs' }, (response) => {
          if (chrome.runtime.lastError) {
            // Tab was closed or errored
            resolve({ success: false, error: chrome.runtime.lastError })
          } else {
            resolve(response)
          }
        })
      })

      if (!response || !response.success) {
        console.log(`${platform} - Tab closed or error occurred`)
        break
      }

      console.log(`${platform} scraping response:`, response)
      console.log(`${platform} jobs found:`, response.data.length)
      console.log(`${platform} next URL:`, response.nextUrl)

      allJobs.push(...response.data)
      currentUrl = response.nextUrl
      pageNum++

      // Small delay before next page
      if (currentUrl) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  } catch (error) {
    console.log(`Error during ${platform} scraping:`, error)
    await chrome.storage.local.set({ isScrapingActive: false })
  } finally {
    // Clear scraping state and remove overlay
    await chrome.storage.local.set({ isScrapingActive: false })
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'removeScrapeOverlay' })
    } catch (error) {
      console.log('Tab might be closed, cannot remove overlay:', error)
    }
  }

  console.log(`Total ${platform} jobs before deduplication:`, allJobs.length)
  const uniqueJobs = removeDuplicateJobs(allJobs)
  console.log(`Total ${platform} jobs after deduplication:`, uniqueJobs.length)
  return uniqueJobs
}

// Function to create job search URLs
function createJobSearchUrls (searchTerm, location, platformFilter = null) {
  const seekSearchTerm = searchTerm.toLowerCase().replace(/\s+/g, '-')
  let sites = []

  // LinkedIn is available in all regions
  sites.push({
    id: 'linkedin',
    url: `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(searchTerm)}&location=${encodeURIComponent(location)}`,
    platform: 'LinkedIn',
    action: 'scrapeLinkedIn'
  })

  // Add region-specific Indeed
  let indeedPrefix = 'au'
  let indeedDomain = 'au.indeed.com'

  if (location.includes('United Kingdom')) {
    indeedPrefix = 'uk'
    indeedDomain = 'uk.indeed.com'
  } else if (location.includes('Canada')) {
    indeedPrefix = 'ca'
    indeedDomain = 'ca.indeed.com'
  } else if (location.includes('United States')) {
    indeedPrefix = 'us'
    indeedDomain = 'www.indeed.com'
  }

  sites.push({
    id: 'indeed',
    url: `https://${indeedDomain}/jobs?q=${encodeURIComponent(searchTerm)}&l=${encodeURIComponent(location.split(',')[0])}`,
    platform: `Indeed ${indeedPrefix.toUpperCase()}`,
    action: 'scrapeJobs'
  })

  // Add SEEK only for Australia
  if (location.includes('Australia')) {
    sites.push({
      id: 'seek',
      url: `https://www.seek.com.au/${seekSearchTerm}-jobs/in-${location.split(',')[0].toLowerCase().replace(/\s+/g, '-')}`,
      platform: 'SEEK',
      action: 'scrapeSEEK'
    })
  }
  // Add SEEK for New Zealand
  else if (location.includes('New Zealand')) {
    sites.push({
      id: 'seek',
      url: `https://www.seek.co.nz/${seekSearchTerm}-jobs/in-${location.split(',')[0].toLowerCase().replace(/\s+/g, '-')}`,
      platform: 'SEEK NZ',
      action: 'scrapeSEEK'
    })
  }

  // Filter sites by platform if specified
  if (platformFilter) {
    console.log(`Filtering URLs for platform:`, platformFilter)

    // Handle both string and array platformFilter
    if (Array.isArray(platformFilter)) {
      // If it's an array, keep sites that match any of the platforms in the array
      sites = sites.filter(site => {
        return platformFilter.some(platform => {
          // Skip if platform is not a string
          if (typeof platform !== 'string') {
            console.warn('Invalid platform filter item:', platform)
            return false
          }

          const platformLower = platform.toLowerCase()

          // Check for exact match on id first
          if (site.id.toLowerCase() === platformLower) {
            return true
          }

          // Check if platform name contains the filter
          if (site.platform.toLowerCase().includes(platformLower)) {
            return true
          }

          return false
        })
      })
    } else if (typeof platformFilter === 'string') {
      // Handle string platformFilter (original implementation)
      const platformLower = platformFilter.toLowerCase()

      sites = sites.filter(site => {
        // Check for exact match on id first
        if (site.id.toLowerCase() === platformLower) {
          return true
        }

        // Check if platform name contains the filter
        if (site.platform.toLowerCase().includes(platformLower)) {
          return true
        }

        return false
      })
    } else {
      console.warn('Invalid platformFilter type:', typeof platformFilter)
    }

    console.log(`After filtering, found ${sites.length} URLs for`, platformFilter)
  }

  return sites
}

// Function to scrape from a specific platform
async function scrapeFromPlatform (platform, jobTitle, city, country, progressCallback = () => { }) {
  console.log(`Starting scrape from platform: ${platform} for ${jobTitle} in ${city}, ${country}`)

  try {
    // Create search URLs based on platform
    const urlObjects = createJobSearchUrls(jobTitle, city, platform)

    if (!urlObjects || urlObjects.length === 0) {
      console.warn(`No URLs generated for platform: ${platform}`)
      return []
    }

    console.log(`Generated ${urlObjects.length} URLs for ${platform}:`, urlObjects)

    // Create tabs for each URL
    const allJobs = []
    let tabsProcessed = 0

    for (const urlObj of urlObjects) {
      progressCallback(Math.round((tabsProcessed / urlObjects.length) * 80), 'opening_tab')

      // Extract the URL string from the object
      const urlString = urlObj.url
      if (!urlString || typeof urlString !== 'string') {
        console.warn(`Invalid URL for ${platform}:`, urlObj)
        continue
      }

      console.log(`Opening URL: ${urlString}`)

      // Create a tab for this URL
      const tab = await chrome.tabs.create({ url: urlString, active: false })

      // Wait for page to load
      await waitForPageLoad(tab.id)

      // If platform supports pagination, use it
      if (['indeed', 'seek'].includes(platform)) {
        const paginatedJobs = await scrapeWithPagination(tab, platform, (progress) => {
          // Scale progress to fit within our 80% allocation for URL processing
          // This leaves 20% for post-processing
          const scaledProgress = Math.round(80 + (progress * 0.2))
          progressCallback(scaledProgress, 'scraping_pages')
        })

        allJobs.push(...paginatedJobs)
      } else {
        // Otherwise just scrape the single page
        const jobs = await scrapeFromTab(tab)
        allJobs.push(...jobs)
      }

      // Close the tab
      try {
        await chrome.tabs.remove(tab.id)
      } catch (err) {
        console.warn(`Error closing tab ${tab.id}:`, err)
      }

      tabsProcessed++
      progressCallback(Math.round((tabsProcessed / urlObjects.length) * 80), 'processing')
    }

    // Process all jobs (remove duplicates, etc.)
    progressCallback(90, 'processing_results')
    const uniqueJobs = removeDuplicateJobs(allJobs)

    // Add source information
    const processedJobs = uniqueJobs.map(job => ({
      ...job,
      source: platform,
      country: country
    }))

    progressCallback(100, 'completed')
    return processedJobs
  } catch (error) {
    console.error(`Error scraping from ${platform}:`, error)
    progressCallback(100, 'error')
    throw error
  }
}

export default {
  waitForPageLoad,
  scrapeFromTab,
  scrapeWithPagination,
  removeDuplicateJobs,
  createJobSearchUrls,
  scrapeFromPlatform
} 