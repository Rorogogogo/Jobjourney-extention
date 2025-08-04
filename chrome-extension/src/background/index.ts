// JobJourney Background Service Worker - Main Entry Point
import 'webextension-polyfill';
import { BackgroundService } from './services/BackgroundService';

// Initialize the background service
const backgroundService = new BackgroundService();

// Start the service when the script loads
backgroundService.initialize().catch(error => {
  console.error('❌ Failed to initialize JobJourney background service:', error);
});

console.log('🚀 JobJourney Background Service loaded');
