/**
 * Working scrapers initialization
 * This file imports the shared Job class and attaches it to window
 */

import { Job, initializeJobClass } from './job-class';

// Re-export for any direct imports
export { Job };

// Global window declarations for scrapers
declare global {
  interface Window {
    linkedInScraper: any;
    seekScraper: any;
    indeedScraper: any;
  }
}

// Initialize Job class on window
initializeJobClass();

console.log('Working scrapers implementation loaded');
