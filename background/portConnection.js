import { handleVersionCheckFromPanel, handleScrapingFromPanel } from './messageHandlers.js'

// Import panel state functions
import { setPanelOpen, setActivePanelPort, setPortConnected } from './panelState.js'

// ============================
// PORT CONNECTION HANDLING
// ============================

// Setup port connection listeners
export function setupPortConnectionListeners () {
  // Listen for panel connections
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "panel") {
      // Update panel state
      setPanelOpen(true)
      setPortConnected(true)
      setActivePanelPort(port)
      console.log("Panel opened")

      // Listen for messages from the panel
      port.onMessage.addListener((message) => {
        console.log("Received message from panel:", message)

        // Handle panel state updates
        if (message.action === "PANEL_STATE_UPDATE") {
          const isActive = message.data?.isActive === true
          console.log(`Panel reporting state: ${isActive ? 'Active ✅' : 'Inactive ❌'}`)
          setPanelOpen(isActive)
        }
        // Handle version check request
        else if (message.action === "CHECK_VERSION") {
          console.log("Received version check request from panel")
          handleVersionCheckFromPanel(message, port)
        }
        // Handle scraping request
        else if (message.action === "START_SCRAPING") {
          console.log("Received START_SCRAPING request from panel:", message.data)
          handleScrapingFromPanel(message, port)
        }
      })

      port.onDisconnect.addListener(() => {
        setPanelOpen(false)
        setPortConnected(false)
        console.log("Panel closed")

        // Clear the active port reference if it's this port
        setActivePanelPort(null)
      })
    }
  })
} 