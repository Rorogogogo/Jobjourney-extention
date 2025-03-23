/**
 * Messaging Service
 * Handles all communication between different parts of the extension and with the website
 */

// Define standard message types for consistent communication
export const MessageType = {
  // Extension → Website messages
  JOBS_SCRAPED: 'JOBS_SCRAPED',
  SCRAPING_STATUS: 'SCRAPING_STATUS',
  VERSION_CHECK: 'VERSION_CHECK',
  DOWNLOAD_EXTENSION: 'DOWNLOAD_EXTENSION',

  // Website → Extension messages
  JOBS_RECEIVED: 'JOBS_RECEIVED',
  SHOW_IN_JOBJOURNEY: 'SHOW_IN_JOBJOURNEY',
  VERSION_CHECK_RESPONSE: 'VERSION_CHECK_RESPONSE',

  // Internal extension messages
  SIDE_PANEL_LOADED: 'SIDE_PANEL_LOADED',
  SEARCH_JOBS: 'SEARCH_JOBS',
  UPDATE_UI: 'UPDATE_UI'
}

// Error types for better error handling
export const ErrorType = {
  TIMEOUT: 'TIMEOUT',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  UNKNOWN: 'UNKNOWN'
}

class MessagingService {
  constructor() {
    this.SOURCE_IDENTIFIER = 'JOBJOURNEY_EXTENSION'
    this.PROTOCOL_VERSION = '1.0'
    this.MESSAGE_TIMEOUT = 10000 // 10 seconds
    this.messageHandlers = new Map()
    this.pendingResponses = new Map()
    this.messageCounter = 0
    this.debugMode = false
    this.initialized = false
  }

  /**
   * Initialize the messaging service
   * @param {Object} options - Configuration options
   * @param {boolean} options.debug - Enable debug mode
   */
  initialize (options = {}) {
    if (this.initialized) {
      return
    }

    this.debugMode = options.debug || false
    this.log('Initializing messaging service')

    // Setup message listeners
    this.setupMessageListeners()

    // Register default handlers for common message types
    this.registerDefaultHandlers()

    // Register handlers for background.js action types
    this.registerBackgroundActionHandlers()

    this.initialized = true

    this.log('Messaging service initialized')
  }

  /**
   * Set up message listeners
   */
  setupMessageListeners () {
    // Listen for runtime messages (between background, content scripts, and other extension parts)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleRuntimeMessage(message, sender, sendResponse)
      return true // Keep the message channel open for async responses
    })

    // Listen for messages from the website
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('message', (event) => {
        this.handleWebsiteMessage(event)
      })
    }
  }

  /**
   * Handle messages from other parts of the extension
   * @param {Object} message - The message object
   * @param {Object} sender - The sender information
   * @param {Function} sendResponse - Function to send a response
   */
  handleRuntimeMessage (message, sender, sendResponse) {
    try {
      // Validate the message
      if (!message) {
        this.log('Missing message object')
        sendResponse({ success: false, error: ErrorType.INVALID_MESSAGE })
        return
      }

      // Support both 'type' (our messaging protocol) and 'action' (Chrome messaging) formats
      const messageType = message.type || message.action

      if (!messageType) {
        this.log('Invalid message received (no type or action):', message)
        sendResponse({ success: false, error: ErrorType.INVALID_MESSAGE })
        return
      }

      this.log('Runtime message received:', messageType)

      // Check if this is a response to a pending message
      if (message.isResponse && message.messageId && this.pendingResponses.has(message.messageId)) {
        const { resolve } = this.pendingResponses.get(message.messageId)
        this.pendingResponses.delete(message.messageId)
        resolve(message.data)
        return
      }

      // Process message with registered handlers
      const handlers = this.messageHandlers.get(messageType) || []

      if (handlers.length === 0) {
        this.log(`No handlers registered for message type: ${messageType}`)
        sendResponse({ success: false, error: 'No handlers registered for this message type' })
        return
      }

      // Execute all handlers
      Promise.all(handlers.map(handler => handler(message.data, sender)))
        .then(results => {
          // Use the first non-null result
          const result = results.find(r => r !== null && r !== undefined) || {}
          sendResponse({ success: true, data: result })
        })
        .catch(error => {
          this.log('Error handling message:', error)
          sendResponse({ success: false, error: error.message || ErrorType.UNKNOWN })
        })
    } catch (error) {
      this.log('Error in runtime message handler:', error)
      sendResponse({ success: false, error: error.message || ErrorType.UNKNOWN })
    }
  }

  /**
   * Handle messages from the website
   * @param {MessageEvent} event - The message event
   */
  handleWebsiteMessage (event) {
    try {
      // Validate the source and message
      if (!event.data || typeof event.data !== 'object' || !event.data.type) {
        return
      }

      const message = event.data

      // Ensure it's a message for our extension
      if (message.target !== 'JOBJOURNEY_EXTENSION') {
        return
      }

      this.log('Website message received:', message.type)

      // Process the message
      const handlers = this.messageHandlers.get(message.type) || []

      if (handlers.length === 0) {
        this.log(`No handlers registered for website message type: ${message.type}`)
        return
      }

      // Execute all handlers
      Promise.all(handlers.map(handler => handler(message.data, { source: 'website' })))
        .then(results => {
          // If this message expects a response, send it back to the website
          if (message.messageId) {
            const result = results.find(r => r !== null && r !== undefined) || {}
            this.sendToWebsite({
              type: message.type + '_RESPONSE',
              data: result,
              messageId: message.messageId,
              isResponse: true
            })
          }
        })
        .catch(error => {
          this.log('Error handling website message:', error)
          if (message.messageId) {
            this.sendToWebsite({
              type: message.type + '_RESPONSE',
              error: error.message || ErrorType.UNKNOWN,
              messageId: message.messageId,
              isResponse: true,
              success: false
            })
          }
        })
    } catch (error) {
      this.log('Error in website message handler:', error)
    }
  }

  /**
   * Register a handler for a specific message type
   * @param {string} type - The message type to handle
   * @param {Function} handler - The handler function
   * @returns {Function} - Function to unregister the handler
   */
  registerHandler (type, handler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, [])
    }

    this.messageHandlers.get(type).push(handler)
    this.log(`Handler registered for message type: ${type}`)

    // Return function to unregister this handler
    return () => {
      const handlers = this.messageHandlers.get(type) || []
      const index = handlers.indexOf(handler)
      if (index !== -1) {
        handlers.splice(index, 1)
        this.log(`Handler unregistered for message type: ${type}`)
      }
    }
  }

  /**
   * Send a message to another part of the extension
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @returns {Promise<any>} - Response promise
   */
  sendMessage (type, data = {}) {
    return new Promise((resolve, reject) => {
      try {
        const messageId = this.generateMessageId()

        // Store the promise callbacks for later resolution
        this.pendingResponses.set(messageId, {
          resolve,
          reject,
          timestamp: Date.now()
        })

        // Set a timeout to clean up and reject if no response
        setTimeout(() => {
          if (this.pendingResponses.has(messageId)) {
            const { reject } = this.pendingResponses.get(messageId)
            this.pendingResponses.delete(messageId)
            reject(new Error(`Message timeout: ${type}`))
          }
        }, this.MESSAGE_TIMEOUT)

        // Send the message
        chrome.runtime.sendMessage({
          type,
          data,
          messageId,
          timestamp: Date.now(),
          source: this.SOURCE_IDENTIFIER,
          protocolVersion: this.PROTOCOL_VERSION
        })
          .then(response => {
            if (response && response.success) {
              resolve(response.data)
            } else {
              reject(new Error(response?.error || 'Unknown error'))
            }
          })
          .catch(error => {
            this.log('Error sending message:', error)

            // Clean up the pending response
            if (this.pendingResponses.has(messageId)) {
              this.pendingResponses.delete(messageId)
            }

            reject(new Error(`Failed to send message: ${error.message || 'Unknown error'}`))
          })
      } catch (error) {
        reject(new Error(`Error preparing message: ${error.message}`))
      }
    })
  }

  /**
   * Send a message to a specific tab
   * @param {number} tabId - The ID of the tab to send to
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @returns {Promise<any>} - Response promise
   */
  sendToTab (tabId, type, data = {}) {
    return new Promise((resolve, reject) => {
      try {
        const messageId = this.generateMessageId()

        // Store the promise callbacks for later resolution
        this.pendingResponses.set(messageId, {
          resolve,
          reject,
          timestamp: Date.now()
        })

        // Set a timeout to clean up and reject if no response
        setTimeout(() => {
          if (this.pendingResponses.has(messageId)) {
            const { reject } = this.pendingResponses.get(messageId)
            this.pendingResponses.delete(messageId)
            reject(new Error(`Tab message timeout: ${type}`))
          }
        }, this.MESSAGE_TIMEOUT)

        // Send the message to the specific tab
        chrome.tabs.sendMessage(tabId, {
          type,
          data,
          messageId,
          timestamp: Date.now(),
          source: this.SOURCE_IDENTIFIER,
          protocolVersion: this.PROTOCOL_VERSION
        })
          .then(response => {
            if (response && response.success) {
              resolve(response.data)
            } else {
              reject(new Error(response?.error || 'Unknown error'))
            }
          })
          .catch(error => {
            this.log('Error sending message to tab:', error)

            // Clean up the pending response
            if (this.pendingResponses.has(messageId)) {
              this.pendingResponses.delete(messageId)
            }

            reject(new Error(`Failed to send tab message: ${error.message || 'Unknown error'}`))
          })
      } catch (error) {
        reject(new Error(`Error preparing tab message: ${error.message}`))
      }
    })
  }

  /**
   * Send a message to the website
   * @param {Object} message - The message to send
   */
  sendToWebsite (message) {
    if (typeof window === 'undefined') {
      this.log('Cannot send to website: window is undefined')
      return
    }

    try {
      window.postMessage({
        ...message,
        source: this.SOURCE_IDENTIFIER,
        timestamp: Date.now(),
        protocolVersion: this.PROTOCOL_VERSION,
        target: 'JOBJOURNEY_APP'
      }, '*')

      this.log('Message sent to website:', message.type)
    } catch (error) {
      this.log('Error sending message to website:', error)
    }
  }

  /**
   * Generate a unique message ID
   * @returns {string} - Unique message ID
   */
  generateMessageId () {
    return `msg_${Date.now()}_${this.messageCounter++}`
  }

  /**
   * Log a message if debug mode is enabled
   * @param  {...any} args - Arguments to log
   */
  log (...args) {
    if (this.debugMode) {
      console.log('[MessagingService]', ...args)
    }
  }

  /**
   * Register handlers for background.js action types
   */
  registerBackgroundActionHandlers () {
    // Register handlers for common action types used in background.js
    // This bridges the two messaging systems
  }

  /**
   * Register default handlers for common message types
   */
  registerDefaultHandlers () {
    this.log('Registering default message handlers')


    // Handler for version check
    this.registerHandler(MessageType.VERSION_CHECK, async () => {
      this.log('Default handler for VERSION_CHECK')
      return {
        isCompatible: true,
        minimumVersion: '1.0.0',
        latestVersion: '1.0.1',
        message: 'Extension is compatible'
      }
    })

    // Add other default handlers as needed
  }
}

// Export a singleton instance
export default new MessagingService() 