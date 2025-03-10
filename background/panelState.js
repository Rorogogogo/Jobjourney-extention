import sidePanelService from '../src/services/sidePanelService.js'

// ============================
// STATE VARIABLES
// ============================
const state = {
  panelOpen: false,
  activePanelPort: null,
  portConnected: false
}

// Helper function to check if panel is open
export function isPanelOpen () {
  if (!state.panelOpen) {
    console.warn("Operation attempted while panel is closed")
    return false
  }
  return true
}

// Helper function to safely send message through port
export function safelySendThroughPort (port, message) {
  if (!port) {
    console.warn("Cannot send message - port is null")
    return false
  }

  try {
    port.postMessage(message)
    return true
  } catch (error) {
    console.error("Error sending message through port:", error.message)
    // If we get a connection error, mark the port as disconnected
    if (error.message.includes("Receiving end does not exist")) {
      state.portConnected = false

      // If this is the active port, clear it
      if (state.activePanelPort === port) {
        state.activePanelPort = null
      }
    }
    return false
  }
}

// Initialize side panel
export async function initializeSidePanel () {
  console.log('Initializing side panel')

  // Check if Side Panel API is available
  if (!chrome.sidePanel) {
    console.warn('Side Panel API is not available in this browser or extension context')
    console.log('Using fallback mechanisms for panel state tracking')

    // Still initialize the panel service for basic functionality
    await sidePanelService.initialize()
    return
  }

  // Side Panel API is available, proceed with setup
  try {
    // Register panel behavior if the method exists
    if (typeof chrome.sidePanel.setPanelBehavior === 'function') {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      console.log('Side panel behavior registered successfully')
    } else {
      console.warn('Side panel setPanelBehavior is not available')
    }

    // Initialize the panel service
    await sidePanelService.initialize()

    // Set up event listeners if they exist
    if (chrome.sidePanel.onShown && typeof chrome.sidePanel.onShown.addListener === 'function') {
      chrome.sidePanel.onShown.addListener(() => {
        console.log('Side panel shown')
        state.panelOpen = true
      })
      console.log('Side panel shown listener registered')
    } else {
      console.warn('Side panel onShown event is not available')
    }

    if (chrome.sidePanel.onHidden && typeof chrome.sidePanel.onHidden.addListener === 'function') {
      chrome.sidePanel.onHidden.addListener(() => {
        console.log('Side panel hidden')
        state.panelOpen = false
      })
      console.log('Side panel hidden listener registered')
    } else {
      console.warn('Side panel onHidden event is not available')
    }

    console.log('Side panel initialization completed')
  } catch (error) {
    console.error('Error in side panel initialization:', error)
    // Still initialize the panel service for basic functionality
    try {
      await sidePanelService.initialize()
    } catch (innerError) {
      console.error('Error initializing sidePanelService:', innerError)
    }
  }
}

// Update panel state
export function setPanelOpen (isOpen) {
  state.panelOpen = isOpen
}

// Update active panel port
export function setActivePanelPort (port) {
  state.activePanelPort = port
}

// Update port connected state
export function setPortConnected (isConnected) {
  state.portConnected = isConnected
}

// Get panel state
export function getPanelState () {
  return state
}

// Export state getters
export const panelOpen = () => state.panelOpen
export const activePanelPort = () => state.activePanelPort
export const portConnected = () => state.portConnected 