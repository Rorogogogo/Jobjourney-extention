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

    // Scrape jobs from each site
    for (const site of searchSites) {
      if (progressCallback) {
        progressCallback(
          (completedSites / totalSites) * 100,
          `Scraping ${site.platform}...`,
          `Searching for ${searchInputValue} in ${locationValue}`
        )
      }

      try {
        // Open the site in a new tab
        const tab = await chrome.tabs.create({
          url: site.url,
          active: false
        })

        // Wait for page to load
        await scraperService.waitForPageLoad(tab.id)

        // Scrape jobs from the tab
        const jobs = await scraperService.scrapeFromTab(tab)
        console.log(`Found ${jobs.length} jobs from ${site.platform}`)

        // Add jobs to the list
        allJobs = allJobs.concat(jobs)

        // Close the tab
        chrome.tabs.remove(tab.id)
      } catch (error) {
        console.error(`Error scraping ${site.platform}:`, error)
      }

      completedSites++
    }

    // Update progress to 100%
    if (progressCallback) {
      progressCallback(
        100,
        'Processing results...',
        `Found ${allJobs.length} jobs across ${searchSites.length} platforms`
      )
    }

    // Remove duplicates
    allJobs = scraperService.removeDuplicateJobs(allJobs)

    // Store jobs in the job service
    jobService.setJobs(allJobs)

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