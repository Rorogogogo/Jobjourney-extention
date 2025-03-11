// import sidePanelService from '../src/services/sidePanelService.js'

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