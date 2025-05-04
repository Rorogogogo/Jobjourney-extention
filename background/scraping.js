import scraperService from '../src/services/scraperService.js'
import { safelySendThroughPort, activePanelPort } from './panelState.js'

// Function to start the actual scraping process
export async function startScraping (data) {
  const { jobTitle, city, country, platforms } = data

  try {
    console.log(`Starting scraping for ${jobTitle} in ${city}, ${country} on platforms:`, platforms)

    // Track progress
    let currentProgress = 0
    const totalSteps = platforms.length

    // Collect all jobs
    const allJobs = []

    // Progress update callback
    const progressCallback = (progress, platformName, status) => {
      const message = {
        action: 'SCRAPING_PROGRESS',
        data: {
          platform: platformName,
          progress: progress,
          status: status,
          overallProgress: Math.round((currentProgress + progress / 100) / totalSteps * 100)
        }
      }

      // Broadcast progress to all extension pages
      chrome.runtime.sendMessage(message)

      // Also send through port if available
      const currentPort = activePanelPort()
      if (currentPort) {
        safelySendThroughPort(currentPort, message)
      }
    }

    // Process each platform
    for (const platform of platforms) {
      try {
        // Update progress
        progressCallback(0, platform, 'starting')

        // Scrape jobs from this platform
        const jobs = await scraperService.scrapeFromPlatform(platform, jobTitle, city, country,
          (progress, status) => progressCallback(progress, platform, status))

        console.log(`Found ${jobs.length} jobs from ${platform}`)
        allJobs.push(...jobs)

        // Update progress
        currentProgress += 1
        progressCallback(100, platform, 'completed')
      } catch (err) {
        console.error(`Error scraping from ${platform}:`, err)
        currentProgress += 1
        progressCallback(100, platform, 'error')
      }
    }

    // All done - send final result
    const finalResult = {
      action: 'SCRAPING_COMPLETED',
      data: {
        success: true,
        jobs: allJobs,
        count: allJobs.length,
        platforms: platforms,
        query: {
          jobTitle,
          city,
          country
        }
      }
    }

    // Broadcast to all extension pages
    chrome.runtime.sendMessage(finalResult)

    // Also send through port if available
    const currentPort = activePanelPort()
    if (currentPort) {
      safelySendThroughPort(currentPort, finalResult)
    }

    console.log('Scraping completed successfully')
  } catch (err) {
    console.error('Error in scraping process:', err)

    // Send error status
    const errorMessage = {
      action: 'SCRAPING_ERROR',
      data: {
        success: false,
        error: err.message || 'Unknown error in scraping process',
        platforms: platforms
      }
    }

    // Broadcast to all extension pages
    chrome.runtime.sendMessage(errorMessage)

    // Also send through port if available
    const currentPort = activePanelPort()
    if (currentPort) {
      safelySendThroughPort(currentPort, errorMessage)
    }
  }
} 