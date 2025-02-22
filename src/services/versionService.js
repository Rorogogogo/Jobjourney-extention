import tabService from './tabService.js'

// Version check function using message passing
async function checkVersion (shouldFocusPopup = true) {
  console.group('checkVersion')
  try {
    console.log('Starting version check')
    const manifest = chrome.runtime.getManifest()
    console.log('Extension manifest:', manifest)

    console.log('Ensuring JobJourney website is open...')
    const tab = await tabService.ensureJobJourneyWebsite(shouldFocusPopup)
    console.log('JobJourney tab ready:', tab)

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
        console.warn('Version check timed out after 5 seconds')
        resolve({
          isCompatible: false,
          requireUpdate: true,
          currentVersion: manifest.version,
          minimumVersion: 'Unknown',
          message: 'Version check timed out. Please try again.'
        })
      }, 5000)

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
          const response = result.result.data
          resolve({
            isCompatible: response.isCompatible,
            requireUpdate: !response.isCompatible,
            currentVersion: manifest.version,
            minimumVersion: response.minimumVersion,
            message: response.message || 'Please update to the latest version'
          })
        } else {
          console.warn('No valid result from JobJourney tab:', result)
          resolve({
            isCompatible: false,
            requireUpdate: true,
            currentVersion: manifest.version,
            minimumVersion: 'Unknown',
            message: 'Failed to verify version compatibility'
          })
        }
      }).catch(error => {
        console.error('Error in version check script:', error)
        resolve({
          isCompatible: false,
          requireUpdate: true,
          currentVersion: manifest.version,
          minimumVersion: 'Unknown',
          message: 'Error checking version compatibility'
        })
      })
    })
  } catch (error) {
    console.error('Version check failed:', error)
    return {
      isCompatible: false,
      requireUpdate: true,
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
        const tab = await tabService.ensureJobJourneyWebsite()
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
          // Fallback to GitHub if download trigger fails
          chrome.tabs.create({ url: 'https://github.com/Rorogogogo/Jobjourney-extention' })
        }
      } catch (error) {
        console.error('Error triggering download:', error)
        // Fallback to GitHub on error
        chrome.tabs.create({ url: 'https://github.com/Rorogogogo/Jobjourney-extention' })
      }
    })
  }
}

export default {
  checkVersion,
  showUpdateUI
} 