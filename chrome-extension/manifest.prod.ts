import type { ManifestType } from '@extension/shared';

/**
 * JobJourney Chrome Extension Manifest - PRODUCTION VERSION
 * Smart job search assistant that scrapes listings from multiple platforms
 * 
 * This version is ready for Chrome Web Store submission
 * NO localhost permissions or system.display permission
 */
const manifest = {
  manifest_version: 3,
  name: 'JobJourney Assistant',
  version: '3.0.2',
  description: 'Smart job search assistant that scrapes listings from multiple platforms and integrates with JobJourney',
  default_locale: 'en',
  permissions: [
    'tabs',
    'storage', 
    'sidePanel',
    'scripting',
    'activeTab',
    'alarms'
  ],
  host_permissions: [
    '*://*.linkedin.com/*',
    '*://*.seek.com.au/*',
    '*://*.seek.co.nz/*',
    '*://*.indeed.com/*',
    '*://recruitment.macquarie.com/*',
    '*://*.atlassian.com/*',
    '*://ebuu.fa.ap1.oraclecloud.com/*',
    '*://www.lifeatcanva.com/*',
    '*://*.jobjourney.me/*'
  ],
  action: {
    default_title: 'JobJourney Assistant'
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
        '*://recruitment.macquarie.com/*',
        '*://*.atlassian.com/*',
        '*://ebuu.fa.ap1.oraclecloud.com/*',
        '*://www.lifeatcanva.com/*',
        '*://*.jobjourney.me/*'
      ],
      js: ['content/jobsites.iife.js'],
      run_at: 'document_idle'
    }
  ],
  web_accessible_resources: [
    {
      resources: ['*.js', '*.css', '*.svg', 'icon-16.png', 'icon-34.png', 'icon-48.png', 'icon-128.png'],
      matches: [
        '*://*.linkedin.com/*',
        '*://*.seek.com.au/*',
        '*://*.seek.co.nz/*', 
        '*://*.indeed.com/*',
        '*://recruitment.macquarie.com/*',
        '*://*.atlassian.com/*',
        '*://ebuu.fa.ap1.oraclecloud.com/*',
        '*://www.lifeatcanva.com/*',
        '*://*.jobjourney.me/*'
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