// Configuration for the JobJourney extension
const config = {
  // Development environment
  development: {
    baseUrl: 'http://localhost:5001'
  },
  // Production environment
  production: {
    baseUrl: 'https://jobjourney.me'
  },
  extension_version: '2.0.0',
  extension_update_date: 'May 6, 2024'
}



async function getBaseUrl () {
  try {
    // Try to detect development environment
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1000) // 1 second timeout

    try {
      await fetch('http://localhost:5001/health', {
        signal: controller.signal,
        mode: 'no-cors' // This allows us to at least detect if the server responds
      })
      clearTimeout(timeoutId)
      console.log('Development environment detected')
      return config.development.baseUrl
    } catch (error) {
      clearTimeout(timeoutId)
      console.log('Production environment detected')
      return config.production.baseUrl
    }
  } catch (error) {
    console.log('Error checking environment, defaulting to production:', error)
    return config.production.baseUrl
  }
}

export default {
  getBaseUrl,
  version: config.extension_version,
  updateDate: config.extension_update_date
} 