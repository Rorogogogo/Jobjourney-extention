import { readFileSync } from 'node:fs';
import type { ManifestType } from '@extension/shared';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

/**
 * JobJourney Chrome Extension Manifest - DEVELOPMENT VERSION
 * Smart job search assistant that scrapes listings from multiple platforms
 *
 * This version includes localhost permissions for development
 * Use manifest.ts for production builds
 */
const manifest = {
  manifest_version: 3,
  name: 'JobJourney Assistant (Dev)',
  version: '3.0.7',
  description:
    'Smart job search assistant that scrapes listings from multiple platforms and integrates with JobJourney',
  default_locale: 'en',
  permissions: ['tabs', 'storage', 'sidePanel', 'scripting', 'activeTab', 'alarms'],
  host_permissions: [
    '*://*.linkedin.com/*',
    '*://*.seek.com.au/*',
    '*://*.seek.co.nz/*',
    '*://*.indeed.com/*',
    '*://*.jobjourney.me/*',
    'http://localhost:5001/*',
    'http://localhost:5014/*',
    'http://localhost:5000/*',
    'http://localhost:3000/*',
  ],
  action: {
    default_title: 'JobJourney Assistant',
  },
  background: {
    service_worker: 'background.js',
    type: 'module',
  },
  side_panel: {
    default_path: 'side-panel/index.html',
  },
  content_scripts: [
    {
      matches: [
        '*://*.linkedin.com/*',
        '*://*.seek.com.au/*',
        '*://*.seek.co.nz/*',
        '*://*.indeed.com/*',
        '*://*.jobjourney.me/*',
        'http://localhost:5001/*',
        'http://localhost:5014/*',
        'http://localhost:5000/*',
        'http://localhost:3000/*',
      ],
      js: ['content/jobsites.iife.js'],
      run_at: 'document_idle',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['*.js', '*.css', '*.svg', 'icon-16.png', 'icon-34.png', 'icon-48.png', 'icon-128.png'],
      matches: [
        '*://*.linkedin.com/*',
        '*://*.seek.com.au/*',
        '*://*.seek.co.nz/*',
        '*://*.indeed.com/*',
        '*://*.jobjourney.me/*',
        'http://localhost:5001/*',
        'http://localhost:5014/*',
        'http://localhost:5000/*',
        'http://localhost:3000/*',
      ],
    },
  ],
  icons: {
    '16': 'icon-16.png',
    '48': 'icon-48.png',
    '128': 'icon-128.png',
  },
} satisfies ManifestType;

export default manifest;
