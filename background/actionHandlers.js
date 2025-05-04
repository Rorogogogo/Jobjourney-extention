// ============================
// ACTION HANDLERS
// ============================

// Setup extension icon click handler
export function setupActionClickHandler () {
  // Listen for extension icon clicks (if action API is available)
  if (chrome.action && chrome.action.onClicked) {
    chrome.action.onClicked.addListener((tab) => {
      try {
        // Check if sidePanel API is available before trying to use it
        if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function') {
          chrome.sidePanel.open({ tabId: tab.id })
            .catch(err => console.error('Error opening side panel:', err))
        } else {
          console.warn('Side panel API not available for opening panel from action click')
        }
      } catch (e) {
        console.error('Error in action.onClicked handler:', e)
      }
    })
  } else {
    console.warn('chrome.action API not available - icon click handling disabled')
  }
} 