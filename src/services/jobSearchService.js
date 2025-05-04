import scraperService from './scraperService.js'
import storageService from './storageService.js'
import jobService from './jobService.js'

/**
 * Search for jobs with the given parameters
 * @param {string} searchInputValue Job title to search for
 * @param {string} locationValue Location to search in
 * @param {Array<string>} selectedPlatforms List of platforms to search on
 * @param {Function} progressCallback Callback function to update progress (percent, text, detail)
 * @returns {Promise<Array>} Array of job objects
 */
async function searchJobs (searchInputValue, locationValue, selectedPlatforms, progressCallback) {
  try {
    // Save the location for future use
    if (locationValue) {
      await storageService.saveLastLocation(locationValue)
    }

    // Update progress to show we're starting
    if (progressCallback) {
      progressCallback(0, 'Starting search...', '')
    }

    // Get job search URLs based on selected platforms
    const searchSites = scraperService.createJobSearchUrls(
      searchInputValue,
      locationValue,
      selectedPlatforms
    )

    console.log('Search sites:', searchSites)

    let allJobs = []
    let completedSites = 0
    const totalSites = searchSites.length

    // Prepare the combined scraping config
    const combinedScrapingConfig = {
      query: searchInputValue,
      location: locationValue,
      platforms: [],
      startTime: Date.now(),
      totalPagesScraped: 0,
      totalJobsFound: 0,
      totalUniqueJobs: 0,
      platformResults: [],
      searchSites: searchSites.map(site => ({
        platform: site.platform,
        url: site.url
      }))
    }

    // Function to scrape a single site and update progress
    const scrapeSite = async (site) => {
      if (progressCallback) {
        // Initial progress for starting this site (optional, could be noisy)
        // progressCallback(/*...*/); 
      }

      let platformJobs = []
      let platformConfig = {}
      let errorResult = null

      try {
        // Create the tab (inactive, background)
        const tab = await chrome.tabs.create({
          url: site.url,
          active: false
        })
        const tabId = tab.id // Get the ID immediately

        // Scrape jobs using the tabId. scrapeFromTab will handle window creation/focus and closing.
        const result = await scraperService.scrapeFromTab(tabId) // Pass tabId
        platformJobs = result.jobs || []
        platformConfig = result.config || {}

        console.log(`Found ${platformJobs.length} jobs from ${site.platform}`, platformConfig)

        // Window/Tab closure is handled within scrapeFromTab's finally block

      } catch (error) {
        console.error(`Error scraping ${site.platform}:`, error)
        errorResult = error.toString()
      } finally {
        // Update progress as this site completes
        completedSites++
        if (progressCallback) {
          progressCallback(
            (completedSites / totalSites) * 100,
            `Finished ${site.platform} (${completedSites}/${totalSites})...`,
            `Found ${platformJobs.length} jobs so far...`
          )
        }
      }

      // Return results for this platform
      return {
        platform: site.platform,
        jobs: platformJobs,
        config: platformConfig,
        error: errorResult
      }
    }

    // Start scraping all sites concurrently
    const scrapePromises = searchSites.map(site => scrapeSite(site))

    // Wait for all scraping tasks to settle (complete or fail)
    const results = await Promise.allSettled(scrapePromises)

    // Process the results from all promises
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        const { platform, jobs, config, error } = result.value

        // Add platform to the list of scraped platforms
        if (!combinedScrapingConfig.platforms.includes(platform)) {
          combinedScrapingConfig.platforms.push(platform)
        }

        // Add platform-specific results to combined config
        combinedScrapingConfig.platformResults.push({
          platform: platform,
          jobsFound: jobs.length,
          error: error, // Include error if one occurred during scraping
          ...config
        })

        // Update combined totals
        combinedScrapingConfig.totalPagesScraped += config.pagesScraped || 0
        combinedScrapingConfig.totalJobsFound += jobs.length

        // Add jobs to the list
        allJobs = allJobs.concat(jobs)

      } else {
        // Handle cases where the scrapeSite promise itself was rejected (less likely with try/catch inside)
        console.error("Scraping promise rejected:", result.reason)
        // Potentially record a generic error for an unknown platform if needed
        combinedScrapingConfig.platformResults.push({
          platform: "Unknown (Promise Rejection)",
          error: result.reason?.toString() || "Unknown rejection",
          jobsFound: 0
        })
      }
    })

    // Update final progress to 100%
    if (progressCallback) {
      progressCallback(
        100,
        'Processing results...',
        `Found ${allJobs.length} jobs across ${searchSites.length} platforms`
      )
    }

    // Remove duplicates
    allJobs = scraperService.removeDuplicateJobs(allJobs)

    // Update final stats
    combinedScrapingConfig.endTime = Date.now()
    combinedScrapingConfig.duration = combinedScrapingConfig.endTime - combinedScrapingConfig.startTime
    combinedScrapingConfig.totalUniqueJobs = allJobs.length

    // Store jobs and scraping config in the job service
    jobService.setJobs(allJobs)
    jobService.setScrapingConfig(combinedScrapingConfig)

    return allJobs
  } catch (error) {
    console.error('Error during job search:', error)
    throw error
  }
}

/**
 * Generate a summary of search results
 * @param {Array} jobs Array of job objects
 * @param {Array} searchSites Array of search site objects
 * @returns {string} Summary message
 */
function generateSearchSummary (jobs, searchSites) {
  const uniqueJobs = jobs.length
  const platformCount = searchSites.length
  return `Found ${uniqueJobs} jobs across ${platformCount} platforms`
}

export default {
  searchJobs,
  generateSearchSummary
} 