#!/usr/bin/env node

/**
 * Manifest Switcher for JobJourney Extension
 * 
 * Usage:
 * npm run manifest:dev    - Switch to development manifest (includes localhost)
 * npm run manifest:prod   - Switch to production manifest (Chrome Web Store ready)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const mode = args[0];

const manifestDir = path.join(__dirname, '../chrome-extension');
const manifestPath = path.join(manifestDir, 'manifest.ts');
const devManifestPath = path.join(manifestDir, 'manifest.dev.ts');
const prodManifestPath = path.join(manifestDir, 'manifest.prod.ts');

if (mode === 'dev') {
  // Copy dev manifest to main manifest
  if (fs.existsSync(devManifestPath)) {
    fs.copyFileSync(devManifestPath, manifestPath);
    console.log('✅ Switched to DEVELOPMENT manifest (includes localhost permissions and system.display)');
  } else {
    console.error('❌ Development manifest not found at:', devManifestPath);
    process.exit(1);
  }
} else if (mode === 'prod') {
  // Copy production manifest to main manifest
  if (fs.existsSync(prodManifestPath)) {
    fs.copyFileSync(prodManifestPath, manifestPath);
    console.log('✅ Switched to PRODUCTION manifest (localhost permissions and system.display removed)');
    console.log('📦 Ready for Chrome Web Store submission');
  } else {
    console.error('❌ Production manifest not found at:', prodManifestPath);
    process.exit(1);
  }
} else {
  console.log('Usage:');
  console.log('  node scripts/switch-manifest.js dev   - Switch to development manifest');
  console.log('  node scripts/switch-manifest.js prod  - Use production manifest');
  console.log('');
  console.log('Or use npm scripts:');
  console.log('  npm run manifest:dev');
  console.log('  npm run manifest:prod');
}