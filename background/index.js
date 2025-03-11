import messagingService, { MessageType } from '../src/services/messagingService.js'
import {
  handleVersionCheck,
  handleSidePanelLoaded,
  handleShowInJobJourney,
  handleStartScraping,
  registerMessageHandlers,
  setupRuntimeMessageListeners
} from './messageHandlers.js'
import { setupPortConnectionListeners } from './portConnection.js'
import { setupActionClickHandler } from './actionHandlers.js'
// import { initialize } from './initialization.js'

console.log('Background script starting...')

// ============================
// ERROR HANDLING
// ============================

// Global error handler for uncaught promise rejections
self.addEventListener('unhandledrejection', function (event) {
  console.warn('Unhandled promise rejection:', event.reason)

  if (event.reason && event.reason.message &&
    event.reason.message.includes("Receiving end does not exist")) {
    console.log("Suppressing known connection error")
    event.preventDefault()
  }
})

// ============================
// INITIALIZATION
// ============================

// Initialize components
async function initialize () {
  try {
    // Initialize messaging service
    messagingService.initialize({ debug: true })

    // Register message handlers
    registerMessageHandlers()

    // Setup runtime message listeners
    setupRuntimeMessageListeners()

    // Initialize side panel
    // await initializeSidePanel()

    // Setup port connection listeners
    setupPortConnectionListeners()

    // Setup extension icon click handler
    setupActionClickHandler()
    console.log('Background script initialization complete')
  } catch (error) {
    console.error('Error initializing background script:', error)
  }
}

// Start initialization
initialize() 