import tabService from './tabService.js'
import { MessageType } from './messagingService.js'
import uiService from './uiService.js'
// import { showUpdateUI, showVersionOverlay } from './uiService.js'

// Helper function to wait for a specific amount of time
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Track if a version check is already in progress
let versionCheckInProgress = false
let lastVersionCheckResult = null
let lastVersionCheckTime = 0

/**
 * Version check that sends a message and waits for response with a short timeout
 * @param {boolean} shouldFocusPopup Whether to focus the popup window
 * @returns {Promise<Object>} Version check result
 */
async function checkVersion (shouldFocusPopup = true) {
  try {
    console.log('Starting version check')

    // Ensure we're not sending checks when panel is closed
    // This assumes the background.js exports isPanelOpen function
    // If we can't access it directly, we'll use a message
    if (chrome.extension && chrome.extension.getBackgroundPage) {
      const bg = chrome.extension.getBackgroundPage()
      if (bg && typeof bg.isPanelOpen === 'function' && !bg.isPanelOpen()) {
        console.warn('Skipping version check - panel is closed')
        return {
          isCompatible: true,
          message: 'Version check skipped - panel is closed',
          currentVersion: chrome.runtime.getManifest().version
        }
      }
    }

    // Mark that we're starting a check
    versionCheckInProgress = true

    // Get the current extension version
    const manifest = chrome.runtime.getManifest()
    const currentVersion = manifest.version
    console.log('Current extension version:', currentVersion)

    // Create or find a JobJourney tab
    const tab = await tabService.ensureJobJourneyWebsite(shouldFocusPopup)
    console.log('Using JobJourney tab:', tab.id)

    // Wait briefly for the page to load
    await delay(500)

    // Send the version check message without waiting for a response
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (version) => {
        console.log('Sending version check from page context, version:', version)

        // Send message directly to window
        window.postMessage({
          type: 'VERSION_CHECK',
          source: 'JOBJOURNEY_EXTENSION',
          data: { version },
          timestamp: Date.now()
        }, '*')

        // Also try sendExtensionMessage if available
        if (typeof window.sendExtensionMessage === 'function') {
          try {
            window.sendExtensionMessage('VERSION_CHECK', { version })
          } catch (err) {
            console.error('Error using sendExtensionMessage:', err)
          }
        }

        return true
      },
      args: [currentVersion]
    }).catch(err => {
      console.warn('Error executing version check script:', err)
    })

    // Return a default result - actual compatibility will be handled by the message listener
    return {
      isCompatible: true,
      currentVersion,
      message: 'Version check initiated, waiting for response'
    }
  } catch (error) {
    console.error('Error in version check:', error)
    // Even on error, return success to not block functionality
    return {
      isCompatible: true,
      error: error.message || 'Unknown error in version check',
      currentVersion: chrome.runtime.getManifest().version
    }
  } finally {
    // Mark that we're done with the check
    versionCheckInProgress = false
  }
}

/**
 * Check extension version with UI overlay
 * Manages UI updates during version checking
 * @param {Object} uiElements UI elements for displaying overlay and status
 * @returns {Promise<Object>} Version check result
 */
async function checkVersionWithUI (uiElements) {
  try {
    console.log('Checking extension version with UI')

    // Show the overlay during the check
    if (uiElements && uiElements.scrapingOverlay) {
      uiService.showOverlay(uiElements.scrapingOverlay, true)

      // Set initial overlay text
      if (uiElements.overlayText) {
        uiElements.overlayText.textContent = "Checking version compatibility..."
      }

      if (uiElements.overlayDetail) {
        uiElements.overlayDetail.textContent = "Connecting to JobJourney"
      }
    }

    // Add a listener for VERSION_STATUS_UPDATE messages in the checkVersionWithUI function
    function versionUpdateListener (message) {
      if (message.action === 'VERSION_STATUS_UPDATE') {
        console.log('Received version status update:', message.data)

        // Check compatibility flag directly
        if (message.data && message.data.isCompatible === false) {
          // Show incompatibility overlay
          uiService.showVersionOverlay({
            isCompatible: false,
            message: message.data.message || 'Your extension version is not compatible with the website.',
            minimumVersion: message.data.minimumVersion,
            latestVersion: message.data.latestVersion
          })

          // Remove this listener to avoid duplicates
          chrome.runtime.onMessage.removeListener(versionUpdateListener)
          // Don't return true since we're not using sendResponse
        }
      }
      return false  // Always return false to indicate we're handling synchronously
    }

    // Add listener for direct version status updates from background
    chrome.runtime.onMessage.addListener(versionUpdateListener)

    // Use the version check function to initiate the check without waiting for a response
    const initialResult = await checkVersion(true)

    // Define default versionResult with information from checkVersion
    const versionResult = {
      isCompatible: true, // Default to compatible
      currentVersion: initialResult.currentVersion,
      message: initialResult.message,
      minimumVersion: null,
      latestVersion: null
    }

    // Hide the overlay after the check
    if (uiElements && uiElements.scrapingOverlay) {
      uiService.showOverlay(uiElements.scrapingOverlay, false)
    }

    console.log('Version check completed with result:', versionResult)

    // Handle the result based on compatibility
    if (!versionResult.isCompatible) {
      console.warn('Extension version is not compatible:', versionResult)

      // Show the update UI if not compatible
      uiService.showUpdateUI({
        currentVersion: versionResult.currentVersion,
        minimumVersion: versionResult.minimumVersion,
        message: versionResult.message
      })

      // Show error message if UI elements available
      if (uiElements && uiElements.statusMessage) {
        uiService.showMessage(
          uiElements.statusMessage,
          `Update required: ${versionResult.message}`,
          true
        )
      }
    } else {
      console.log('Extension version is compatible')

      // Show success message if UI elements available
      if (uiElements && uiElements.statusMessage) {
        uiService.showMessage(
          uiElements.statusMessage,
          'Version check successful'
        )
      }
    }

    return versionResult
  } catch (error) {
    console.error('Error checking extension version:', error)

    // Hide the overlay in case of error
    if (uiElements && uiElements.scrapingOverlay) {
      uiService.showOverlay(uiElements.scrapingOverlay, false)
    }

    // Show error message if UI elements available
    if (uiElements && uiElements.statusMessage) {
      uiService.showMessage(
        uiElements.statusMessage,
        'Error checking version - continuing anyway',
        true
      )
    }

    return {
      isCompatible: true, // Default to compatible on error
      error: error.message
    }
  }
}



/**
 * Check version using port-based messaging
 * This is a more reliable version that uses port-based messaging and waits for response
 * @param {Object} port - The connection port to the background script
 * @returns {Promise<Object>} Version check result
 */
function checkVersionWithPort (port) {
  return new Promise((resolve) => {
    // Get current version
    const manifest = chrome.runtime.getManifest()
    const currentVersion = manifest.version
    console.log('Starting port-based version check, version:', currentVersion)

    // Set a timeout for response (increased to 10 seconds to allow for tab creation)
    const timeoutId = setTimeout(() => {
      console.log('Version check timeout after 10 seconds, assuming compatible')
      port.onMessage.removeListener(messageHandler)
      resolve({
        isCompatible: true,
        currentVersion,
        message: 'Version check timed out, assuming compatible'
      })
    }, 10000) // 10 seconds to allow time for tab creation

    // Create message handler
    function messageHandler (message) {
      if (message.action === 'VERSION_STATUS_UPDATE') {
        // Clear timeout
        clearTimeout(timeoutId)

        console.log('Received version update via port:', message.data)

        // Create result
        const result = {
          isCompatible: message.data.isCompatible !== false, // Default to compatible if not explicitly false
          currentVersion,
          message: message.data.message || 'Version check completed',
          minimumVersion: message.data.minimumVersion,
          latestVersion: message.data.latestVersion
        }

        // Return result
        resolve(result)

        // Remove listener
        port.onMessage.removeListener(messageHandler)
      }
    }

    // Add listener
    port.onMessage.addListener(messageHandler)

    // Check if port is connected before sending message
    try {
      // Send version check request
      port.postMessage({
        action: 'CHECK_VERSION',
        data: { version: currentVersion }
      })

      console.log('Sent version check request via port')
    } catch (error) {
      console.error('Error sending version check request:', error)
      // Resolve with a default value if we can't send the message
      clearTimeout(timeoutId)
      resolve({
        isCompatible: true,
        currentVersion,
        message: 'Error sending version check request, assuming compatible'
      })
    }
  })
}

export default {
  checkVersion,
  checkVersionWithUI,
  checkVersionWithPort
} 