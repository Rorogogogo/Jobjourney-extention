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

// Function to scrape from a single tab, managing its window context
async function scrapeFromTab (tabId) {
  let windowId = null // Keep track of the window we create

  return new Promise(async (resolve) => {
    try {
      // Notify background: Scraping starting for this tab
      chrome.runtime.sendMessage({ action: 'SCRAPING_STATE_UPDATE', data: { tabId: tabId, isActive: true } })
      // Move the tab to a new focused window immediately
      const window = await chrome.windows.create({
        tabId: tabId,
        focused: true,
        type: 'normal'
      })
      windowId = window.id

      // Wait for the tab to finish loading in the new window
      await waitForPageLoad(tabId)

      // Set the zoom level to 0.8 (zoomed out) to ensure content is visible even in smaller windows
      try {
        await chrome.tabs.setZoom(tabId, 0.5)
        console.log('Set zoom level to 0.8 for better visibility')
      } catch (zoomError) {
        console.warn('Failed to set zoom level:', zoomError)
      }

      // Get the URL after loading (optional, for logging)
      const currentTab = await chrome.tabs.get(tabId) // Now safe to get details
      let currentUrl = currentTab.url
      console.log(`Initial scraping URL in new window:`, currentUrl)

      // Use a simple default platform - proper data will come from UI
      const platform = "Unknown"

      // Initialize scraping configuration for internal use only
      const scrapingConfig = {
        startTime: Date.now(),
        pagesScraped: 0,
        totalJobs: 0,
        uniqueJobs: 0,
        duration: 0
      }

      let allJobs = []
      let pageNum = 1
      const MAX_PAGES = 40 // Maximum pages to scrape

      // Show overlay - Removed shared state setting
      // await chrome.storage.local.set({ isScrapingActive: true })
      // Send message to the specific tabId to show overlay
      await chrome.tabs.sendMessage(tabId, { action: 'showScrapeOverlay' })

      // Start pagination loop
      while (currentUrl && pageNum <= MAX_PAGES) {
        console.log(`Processing page ${pageNum}, URL:`, currentUrl)
        scrapingConfig.pagesScraped = pageNum

        // Update tab URL if not first page
        if (pageNum > 1) {
          console.log("Updating tab URL to:", currentUrl)
          await chrome.tabs.update(tabId, { url: currentUrl })
          await waitForPageLoad(tabId)
        }

        // Scrape current page using tabId
        const response = await new Promise(innerResolve => {
          chrome.tabs.sendMessage(tabId, {
            action: 'scrapeJobs',
            maxPages: 1 // Tell content script to only scrape current page
          }, (response) => {
            if (chrome.runtime.lastError) {
              // console.error(`Error scraping page ${pageNum}:`, chrome.runtime.lastError)
              innerResolve({ success: false })
            } else {
              innerResolve(response)
            }
          })
        })

        if (!response || !response.success) {
          console.log(`Failed to scrape page ${pageNum}`)
          break
        }

        console.log(`Page ${pageNum} scraping response:`, response)

        // Add jobs from this page
        const pageJobs = response.data || []
        console.log(`Found ${pageJobs.length} jobs on page ${pageNum}`)
        allJobs.push(...pageJobs)
        scrapingConfig.totalJobs += pageJobs.length

        // Check if there's another page
        if (response.nextUrl) {
          currentUrl = response.nextUrl
          pageNum++

          // Small delay before next page
          await new Promise(r => setTimeout(r, 1000))
        } else {
          console.log('No more pages found')
          break
        }
      }

      // Clean up logic is moved to the finally block

      // Process and return jobs
      console.log('Total jobs before deduplication:', allJobs.length)
      const uniqueJobs = removeDuplicateJobs(allJobs)
      console.log('Total jobs after deduplication:', uniqueJobs.length)

      // Update final scraping statistics for internal tracking
      scrapingConfig.endTime = Date.now()
      scrapingConfig.duration = scrapingConfig.endTime - scrapingConfig.startTime
      scrapingConfig.uniqueJobs = uniqueJobs.length
      scrapingConfig.finalUrl = currentUrl

      console.log('Scraping completed:', scrapingConfig)

      // Return only the jobs and job count - configuration will be added from UI
      resolve({
        jobs: uniqueJobs,
        config: {
          uniqueJobs: uniqueJobs.length
        }
      })

    } catch (error) {
      console.log('Error in scrapeFromTab with pagination:', error)
      // Error handling remains similar, resolution happens in finally
      resolve({
        jobs: [],
        config: {
          error: error.toString()
        }
      })
    } finally {
      // --- Cleanup --- moved here
      console.log('Running finally block for scrapeFromTab')
      // Removed shared state clearing
      // await chrome.storage.local.set({ isScrapingActive: false })
      // Notify background: Scraping finished for this tab
      chrome.runtime.sendMessage({ action: 'SCRAPING_STATE_UPDATE', data: { tabId: tabId, isActive: false } })
      try {
        // Try removing overlay from the specific tab via message
        await chrome.tabs.sendMessage(tabId, { action: 'removeScrapeOverlay' })
      } catch (error) {
        console.log('Tab might be closed, cannot remove overlay:', error)
      }

      // Close the window this function created
      if (windowId) {
        try {
          console.log(`Attempting to close window: ${windowId}`)
          await chrome.windows.remove(windowId)
          console.log(`Window ${windowId} closed successfully.`)
        } catch (e) {
          // console.warn(`Could not remove window ${windowId} (may already be closed):`, e)
        }
      }
      // --- End Cleanup ---
    }
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

export default {
  waitForPageLoad,
  scrapeFromTab,
  removeDuplicateJobs,
  createJobSearchUrls
} 