// JobJourney Content Script for Job Sites
// Import modularized functions
import { initializeAuthMonitoring } from './authMonitoring';
import { createJobJourneyIndicator } from './indicator';
import { detectPRRequirement } from './prDetection';
import { scrapingFunctions, Job, getCurrentPlatform } from './scrapingFunctions';

// Import modular save job button functionality (needed on all job sites)
import { SaveButtonManager } from './save-button-manager';

// Initialize save button manager
new SaveButtonManager();

console.log('🔵 JobJourney content script loaded on:', window.location.href);

// Add the indicator when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createJobJourneyIndicator);
} else {
  createJobJourneyIndicator();
}

// Conditionally load scrapers based on current platform
const currentPlatform = getCurrentPlatform();
if (currentPlatform) {
  console.log(`🎯 Loading ${currentPlatform} scraper...`);

  // Dynamically import only the needed scraper
  switch (currentPlatform) {
    case 'linkedin':
      import('./linkedin-scraper');
      break;
    case 'indeed':
      import('./indeed-scraper');
      break;
    case 'seek':
      import('./seek-scraper');
      break;
    // Note: Reed scraper not implemented yet
  }
}

// Make Job and timeout config available globally
(window as any).Job = Job;

// Make TIMEOUT_CONFIG available to scrapers
(window as any).TIMEOUT_CONFIG = {
  PLATFORM_SCRAPING_TOTAL: 900000, // 15 minutes
  PAGE_LOAD: 60000, // 60 seconds
  JOB_PANEL_MAX_WAIT: 3000, // 3 seconds
  JOB_PANEL_MAX_ATTEMPTS: 15,
  LINKEDIN: {
    JOB_PANEL_MAX_ATTEMPTS: 30,
    JOB_PANEL_MAX_WAIT: 3000,
  },
  SEEK: {
    JOB_PANEL_MAX_ATTEMPTS: 25,
    JOB_PANEL_MAX_WAIT: 3000,
  },
};

// Helper function to check localStorage quota and cleanup if needed
function checkAndCleanupLocalStorage() {
  try {
    // Check current storage usage
    const jobsData = localStorage.getItem('jobjourney_scraped_jobs');
    if (jobsData) {
      // Rough estimate: each character is 1 byte, localStorage limit is ~5-10MB
      const sizeInBytes = new Blob([jobsData]).size;
      const sizeInMB = sizeInBytes / (1024 * 1024);

      console.log(`📊 Current localStorage usage: ${sizeInMB.toFixed(2)}MB`);

      // If approaching 3MB, clear old data
      if (sizeInMB > 3) {
        console.log('🧹 localStorage approaching quota limit, clearing old data');
        localStorage.removeItem('jobjourney_scraped_jobs');
        localStorage.removeItem('jobjourney_last_scrape');
      }
    }
  } catch (error) {
    console.warn('Failed to check localStorage usage:', error);
    // If there's any error, try to clear data
    try {
      localStorage.removeItem('jobjourney_scraped_jobs');
      localStorage.removeItem('jobjourney_last_scrape');
    } catch (clearError) {
      console.error('Failed to clear localStorage:', clearError);
    }
  }
}

// Run cleanup check when content script loads
checkAndCleanupLocalStorage();

// Interface for job data (legacy compatibility)
interface JobData {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description?: string;
  salary?: string;
  postedDate?: string;
  isRPRequired?: boolean;
}

// Overlay functionality
function showDiscoverOverlay(message: string, submessage?: string) {
  // Remove existing overlay if any
  hideDiscoverOverlay();

  const overlay = document.createElement('div');
  overlay.id = 'jobjourney-discover-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 999999;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 28px;
    text-align: center;
  `;

  const messageEl = document.createElement('div');
  messageEl.textContent = message;
  messageEl.style.cssText = `
    font-size: 36px;
    font-weight: bold;
    margin-bottom: 10px;
  `;

  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 60px;
    height: 60px;
    border: 6px solid rgba(255, 255, 255, 0.3);
    border-top: 6px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 30px 0;
  `;

  const submessageEl = document.createElement('div');
  if (submessage) {
    submessageEl.textContent = submessage;
    submessageEl.style.cssText = `
      font-size: 24px;
      opacity: 0.8;
      margin-top: 10px;
    `;
  }

  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  overlay.appendChild(messageEl);
  overlay.appendChild(spinner);
  if (submessage) overlay.appendChild(submessageEl);

  document.body.appendChild(overlay);
  console.log('🔄 Discover overlay shown:', message);
}

function hideDiscoverOverlay() {
  const overlay = document.getElementById('jobjourney-discover-overlay');
  if (overlay) {
    overlay.remove();
    console.log('✅ Discover overlay hidden');
  }
}

// Message listener for discover commands and overlay
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_OVERLAY') {
    showDiscoverOverlay(message.data.message, message.data.submessage);
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'HIDE_OVERLAY') {
    hideDiscoverOverlay();
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'CLEAR_SCRAPED_JOBS') {
    console.log('🧹 Clearing scraped jobs from localStorage');
    try {
      // Clear only job-related data, preserve user preferences
      localStorage.removeItem('jobjourney_scraped_jobs');
      localStorage.removeItem('jobjourney_last_scrape');

      // Define keys to preserve (user preferences)
      const keysToPreserve = [
        'jobjourney_keywords',
        'jobjourney_country',
        'jobjourney_location',
        'jobjourney_platforms',
      ];

      // Debug: Log all jobjourney keys before clearing
      const allJobJourneyKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('jobjourney_')) {
          allJobJourneyKeys.push(key);
        }
      }
      console.log('🔍 All jobjourney keys before clearing:', allJobJourneyKeys);
      console.log('🔒 Keys to preserve:', keysToPreserve);

      // Clear other jobjourney_ keys except user preferences
      const clearedKeys = [];
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('jobjourney_') && !keysToPreserve.includes(key)) {
          localStorage.removeItem(key);
          clearedKeys.push(key);
        }
      }
      console.log('🧹 Cleared keys:', clearedKeys);
      console.log('✅ Cleared scraped job data from localStorage (preserved user preferences)');
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to clear scraped jobs:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }

  if (message.type === 'START_SCRAPING') {
    const platform = getCurrentPlatform();

    if (!platform || !scrapingFunctions[platform as keyof typeof scrapingFunctions]) {
      sendResponse({
        success: false,
        error: `Unsupported platform: ${platform}`,
      });
      return;
    }

    try {
      console.log(`🔧 Starting to scrape ${platform}...`);

      // Add a small delay to ensure page is loaded
      setTimeout(async () => {
        try {
          // Handle async scrapers (Indeed, LinkedIn, SEEK)
          let jobs: JobData[] = [];
          let nextUrl: string | null = null;

          if (platform === 'linkedin' && (window as any).linkedInScraper) {
            const result = await (window as any).linkedInScraper.scrapeJobList();
            const rawJobs = result.jobs || [];
            nextUrl = result.nextUrl || null;
            // Convert Job objects to JobData format
            jobs = rawJobs.map((job: any, index: number) => ({
              id: `linkedin_${Date.now()}_${index}`,
              title: job.title || '',
              company: job.company || '',
              location: job.location || '',
              url: job.jobUrl || '',
              description: job.description || '',
              salary: job.salary || '',
              postedDate: job.postedDate || '',
              isRPRequired: job.isRPRequired || false,
            }));
          } else if (platform === 'indeed' && (window as any).indeedScraper) {
            const result = await (window as any).indeedScraper.scrapeJobList();
            const rawJobs = result.jobs || [];
            nextUrl = result.nextUrl || null;
            // Convert Job objects to JobData format
            jobs = rawJobs.map((job: any, index: number) => ({
              id: `indeed_${Date.now()}_${index}`,
              title: job.title || '',
              company: job.company || '',
              location: job.location || '',
              url: job.jobUrl || '',
              description: job.description || '',
              salary: job.salary || '',
              postedDate: job.postedDate || '',
              isRPRequired: job.isRPRequired || false,
            }));
          } else if (platform === 'seek' && (window as any).seekScraper) {
            const result = await (window as any).seekScraper.scrapeJobList();
            const rawJobs = result.jobs || [];
            nextUrl = result.nextUrl || null;
            // Convert Job objects to JobData format
            jobs = rawJobs.map((job: any, index: number) => ({
              id: `seek_${Date.now()}_${index}`,
              title: job.title || '',
              company: job.company || '',
              location: job.location || '',
              url: job.jobUrl || '',
              description: job.description || '',
              salary: job.salary || '',
              postedDate: job.postedDate || '',
              isRPRequired: job.isRPRequired || false,
            }));
          } else {
            jobs = (scrapingFunctions[platform as keyof typeof scrapingFunctions] as () => JobData[])();
          }

          console.log(`✅ Scraped ${jobs.length} jobs from ${platform}`);

          chrome.runtime.sendMessage({
            type: 'SCRAPING_RESULT',
            data: { jobs, platform, nextUrl },
          });

          sendResponse({
            success: true,
            data: { jobs, platform, count: jobs.length },
          });
        } catch (error) {
          console.error(`❌ Error during ${platform} scraping:`, error);

          chrome.runtime.sendMessage({
            type: 'SCRAPING_RESULT',
            data: { jobs: [], error: (error as Error).message, platform },
          });

          sendResponse({
            success: false,
            error: (error as Error).message,
          });
        }
      }, 1000);

      return true; // Keep message channel open for async response
    } catch (error) {
      console.error('Error in scraping handler:', error);
      sendResponse({
        success: false,
        error: (error as Error).message,
      });
      return false;
    }
  }
  return false;
});

// Initialize based on platform
const platform = getCurrentPlatform();
if (platform === 'jobjourney') {
  initializeAuthMonitoring();
} else if (platform) {
  console.log(`📍 Detected platform: ${platform}`);
  console.log('🎯 Ready to scrape jobs when requested');
}

// Export for potential use by other scripts
(window as any).jobJourneyContentScript = {
  platform,
  scrapingFunctions,
  getCurrentPlatform,
};
