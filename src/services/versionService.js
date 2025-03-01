import tabService from './tabService.js'

// Helper function to wait for a specific amount of time
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Check if the page is ready by sending a simple readiness check
async function checkPageReady (tabId) {
  console.log('Checking if JobJourney page is ready...')
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return {
          // Check for the global readiness flag first
          ready: !!window.extensionPageReady || !!window.extensionUpdateData || document.readyState === 'complete',
          state: document.readyState,
          hasExtensionFlag: !!window.extensionPageReady,
          hasUpdateData: !!window.extensionUpdateData
        }
      }
    })

    const readinessInfo = result[0]?.result || { ready: false, state: 'unknown' }
    console.log('Page readiness check result:', readinessInfo)

    // If the page has our special flag, it's definitely ready
    if (readinessInfo.hasExtensionFlag) {
      console.log('Page has extensionPageReady flag - communication should work')
      return true
    }

    return readinessInfo.ready || false
  } catch (error) {
    console.error('Error checking page readiness:', error)
    return false
  }
}

// Version check function using message passing
async function checkVersion (shouldFocusPopup = true, retryCount = 0, existingTabId = null) {
  console.group('checkVersion - attempt ' + (retryCount + 1))
  try {
    console.log('Starting version check (attempt ' + (retryCount + 1) + ')')
    const manifest = chrome.runtime.getManifest()
    console.log('Extension manifest:', manifest)

    // Use existing tab if provided (for retries), otherwise get/create a new one
    let tab
    if (existingTabId) {
      try {
        console.log('Using existing tab ID:', existingTabId)
        tab = await chrome.tabs.get(existingTabId)
        // Focus on the tab but don't navigate to a new URL
        await chrome.tabs.update(tab.id, { active: true })
      } catch (e) {
        console.warn('Existing tab no longer available, creating new one')
        tab = await tabService.ensureJobJourneyWebsite(shouldFocusPopup)
      }
    } else {
      console.log('Ensuring JobJourney website is open...')
      tab = await tabService.ensureJobJourneyWebsite(shouldFocusPopup)
    }
    console.log('JobJourney tab ready:', tab)

    // Wait to ensure the page is fully loaded
    console.log('Waiting for page to be fully initialized...')
    await delay(1000)

    // Check if page is ready for communication
    const isReady = await checkPageReady(tab.id)
    if (!isReady && retryCount < 2) {
      console.log('Page not ready yet, waiting and retrying...')
      console.groupEnd()
      await delay(2000) // Wait longer before retry
      return checkVersion(shouldFocusPopup, retryCount + 1, tab.id)
    }

    // Send a PAGE_READY message first to ensure the page's event listeners are set up
    console.log('Sending PAGE_READY message to ensure event listeners are initialized...')
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        window.postMessage({ type: 'PAGE_READY' }, '*')
      }
    })

    // Wait a moment for event listeners to initialize
    await delay(500)

    // Send version check message to the page using executeScript
    console.log('Injecting version check message...')
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (message) => {
        console.log('Executing in JobJourney tab, sending message:', message)
        window.postMessage(message, '*')
      },
      args: [{
        type: 'checkVersion',
        data: {
          version: manifest.version,
          extensionId: chrome.runtime.id
        }
      }]
    })

    // Wait for response using content script
    console.log('Waiting for version check response...')
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('Version check timed out after 8 seconds')
        // If we've already retried twice, return an error, otherwise retry
        if (retryCount >= 2) {
          resolve({
            isCompatible: true, // Default to compatible if we can't verify
            requireUpdate: false,
            currentVersion: manifest.version,
            minimumVersion: 'Unknown',
            message: 'Version check timed out. Continuing with current version.'
          })
        } else {
          console.groupEnd()
          console.log('Retrying version check due to timeout...')
          resolve(checkVersion(shouldFocusPopup, retryCount + 1, tab.id))
        }
      }, 8000) // Longer timeout

      // Set up message listener in the JobJourney tab
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return new Promise((resolve) => {
            const handler = (event) => {
              console.log('JobJourney tab received event:', event)
              if (event.source !== window) {
                console.log('Ignoring event from non-window source:', event.source)
                return
              }
              console.log('Processing message:', event.data)
              if (event.data.type === 'VERSION_CHECK_RESPONSE') {
                console.log('Received version check response:', event.data)
                window.removeEventListener('message', handler)
                resolve(event.data)
              } else {
                console.log('Ignoring message of type:', event.data.type)
              }
            }
            console.log('Adding message event listener in JobJourney tab')
            window.addEventListener('message', handler)
          })
        }
      }).then(([result]) => {
        console.log('Received result from JobJourney tab script:', result)
        clearTimeout(timeout)
        if (result && result.result) {
          console.log('Processing version check response data:', result.result)
          const response = result.result.data || {}

          // If there's an error and we haven't retried too many times, retry
          if (response.errorCode === 'VERSION_CHECK_ERROR' && retryCount < 2) {
            console.warn('Version check failed, retrying...')
            console.groupEnd()
            setTimeout(() => {
              resolve(checkVersion(shouldFocusPopup, retryCount + 1, tab.id))
            }, 2000)
            return
          }

          resolve({
            isCompatible: response.isCompatible !== false,
            requireUpdate: response.isCompatible === false,
            currentVersion: manifest.version,
            minimumVersion: response.minimumVersion,
            message: response.message || 'Please update to the latest version'
          })
        } else {
          console.warn('No valid result from JobJourney tab:', result)

          // Retry if we haven't retried too many times
          if (retryCount < 2) {
            console.warn('Version check failed, retrying...')
            console.groupEnd()
            setTimeout(() => {
              resolve(checkVersion(shouldFocusPopup, retryCount + 1, tab.id))
            }, 2000)
          } else {
            resolve({
              isCompatible: true, // Default to compatible if we can't verify
              requireUpdate: false,
              currentVersion: manifest.version,
              minimumVersion: 'Unknown',
              message: 'Failed to verify version compatibility, continuing with current version.'
            })
          }
        }
      }).catch(error => {
        console.error('Error in version check script:', error)

        // Retry if we haven't retried too many times
        if (retryCount < 2) {
          console.warn('Version check error, retrying...')
          console.groupEnd()
          setTimeout(() => {
            resolve(checkVersion(shouldFocusPopup, retryCount + 1, tab.id))
          }, 2000)
        } else {
          resolve({
            isCompatible: true, // Default to compatible if we can't verify
            requireUpdate: false,
            currentVersion: manifest.version,
            minimumVersion: 'Unknown',
            message: 'Error checking version compatibility'
          })
        }
      })
    })
  } catch (error) {
    console.error('Version check failed:', error)

    // Retry if we haven't retried too many times
    if (retryCount < 2) {
      console.warn('Version check error, retrying...')
      console.groupEnd()
      await delay(2000)
      // If we have an existing tab, pass it to the retry
      if (existingTabId) {
        return checkVersion(shouldFocusPopup, retryCount + 1, existingTabId)
      } else {
        return checkVersion(shouldFocusPopup, retryCount + 1)
      }
    }

    return {
      isCompatible: true, // Default to compatible if we can't verify
      requireUpdate: false,
      currentVersion: manifest.version,
      minimumVersion: 'Unknown',
      message: error.message || 'Failed to check version compatibility'
    }
  } finally {
    console.groupEnd()
  }
}

// Function to show update UI
function showUpdateUI ({ currentVersion, minimumVersion, message }) {
  const container = document.querySelector('.container')
  const updateMessage = document.createElement('div')
  updateMessage.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.95);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
    text-align: center;
  `
  updateMessage.innerHTML = `
    <h2 style="color: #721c24; margin-bottom: 20px;">Update Required</h2>
    <p style="color: #721c24; margin-bottom: 20px;">${message}</p>
    <p style="color: #666; margin-bottom: 20px;">Current Version: ${currentVersion || 'Unknown'}<br>Required Version: ${minimumVersion || 'Unknown'}</p>
    <button id="updateExtensionBtn" 
            style="padding: 10px 20px; background: #0073b1; color: white; border: none; border-radius: 4px; cursor: pointer;">
      Download Latest Version
    </button>
  `
  container.appendChild(updateMessage)

  // Add event listener for update button
  const updateBtn = document.getElementById('updateExtensionBtn')
  if (updateBtn) {
    updateBtn.addEventListener('click', async () => {
      try {
        const tab = await tabService.ensureJobJourneyWebsite(false)

        // Explicitly focus on the JobJourney tab
        await chrome.tabs.update(tab.id, { active: true })
        // Also bring the tab's window to the front
        const tabInfo = await chrome.tabs.get(tab.id)
        if (tabInfo.windowId) {
          await chrome.windows.update(tabInfo.windowId, { focused: true })
        }

        console.log('Sending download trigger message to JobJourney...')

        // Send download trigger message
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (message) => {
            console.log('Executing in JobJourney tab, sending download message:', message)
            window.postMessage(message, '*')
          },
          args: [{
            type: 'triggerExtensionDownload',
            data: {
              currentVersion: currentVersion,
              requiredVersion: minimumVersion
            }
          }]
        })

        // Wait for response
        const response = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve({ success: false, message: 'Download trigger timed out' })
          }, 5000)

          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return new Promise((resolve) => {
                const handler = (event) => {
                  if (event.source !== window) return
                  if (event.data.type === 'DOWNLOAD_TRIGGERED_RESPONSE') {
                    window.removeEventListener('message', handler)
                    resolve(event.data)
                  }
                }
                window.addEventListener('message', handler)
              })
            }
          }).then(([result]) => {
            clearTimeout(timeout)
            resolve(result?.result || { success: false, message: 'No response received' })
          })
        })

        if (!response.success) {
          console.error('Failed to trigger download:', response)
          // Show a notification instead of redirecting to GitHub
          chrome.notifications.create({
            type: 'basic',
            iconUrl: '/icons/icon128.png',
            title: 'Extension Update Required',
            message: 'Please visit JobJourney website to download the latest extension.',
            priority: 2
          })
        }
      } catch (error) {
        console.error('Error triggering download:', error)
        // Show a notification instead of redirecting to GitHub
        chrome.notifications.create({
          type: 'basic',
          iconUrl: '/icons/icon128.png',
          title: 'Extension Update Required',
          message: 'Please visit JobJourney website to download the latest extension.',
          priority: 2
        })
      }
    })
  }
}

export default {
  checkVersion,
  showUpdateUI
} 