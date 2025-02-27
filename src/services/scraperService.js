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
function createJobSearchUrls (searchTerm, location) {
  const seekSearchTerm = searchTerm.toLowerCase().replace(/\s+/g, '-')
  const sites = []

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

  return sites
}

export default {
  waitForPageLoad,
  scrapeFromTab,
  scrapeWithPagination,
  removeDuplicateJobs,
  createJobSearchUrls
} 