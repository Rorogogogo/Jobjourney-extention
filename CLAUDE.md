# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **JobJourney Chrome Extension** built using the Chrome Extension Boilerplate with React + Vite + TypeScript. The extension serves as a job search assistant that scrapes job listings from multiple platforms and integrates with the JobJourney web application.

**Key Features:**
- Authentication sync between extension and JobJourney web app
- Job scraping from LinkedIn, Indeed, SEEK, Reed
- Side panel UI for job search management
- Background service worker with dependency injection architecture
- Event-driven authentication monitoring with toast notifications
- Extension-to-frontend communication for sign-out functionality

## Development Commands

### Environment Management
```bash
# Switch to development manifest (includes localhost permissions)
pnpm manifest:dev

# Switch to production manifest (Chrome Web Store ready)
pnpm manifest:prod
```

### Building & Development
```bash
# Development mode (Chrome) - use after pnpm manifest:dev
pnpm dev

# Development mode (Firefox)  
pnpm dev:firefox

# Production build (Chrome) - use after pnpm manifest:prod
pnpm build

# Production build (Firefox)
pnpm build:firefox

# Create distributable zip for Chrome Web Store
pnpm build && pnpm zip
```

### Code Quality
```bash
# Run linting
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Type checking
pnpm type-check
```

### Testing & Deployment
```bash
# End-to-end tests
pnpm e2e

# Clean and rebuild
pnpm clean:bundle && pnpm build
```

### Module Management
```bash
# Install dependency for root
pnpm i <package> -w

# Install dependency for specific module
pnpm i <package> -F <module-name>

# Enable/disable modules
pnpm module-manager
```

## Architecture Overview

### Background Service Worker (`chrome-extension/src/background/`)
The extension uses a **service-oriented architecture** with dependency injection:

- **BackgroundService**: Main orchestrator that initializes and coordinates all services
- **AuthService**: Handles authentication state, token management, and sync with JobJourney
- **ScrapingService**: Manages job scraping sessions across different platforms
- **ApiService**: HTTP client for JobJourney API communications
- **StorageService**: Chrome storage abstraction layer
- **ConfigService**: Environment-based configuration management
- **EventManager**: Internal pub/sub system for service communication

**Key Pattern**: Services use dependency injection via `setDependencies()` method to avoid circular dependencies.

### Content Scripts (`pages/content/src/matches/jobsites/`)
- **Event-driven authentication monitoring**: Uses localStorage overrides and storage events for instant auth detection
- **Smart toast logic**: Prevents duplicate toasts across tabs with `shouldShowToast` flags
- **Platform-specific scrapers**: LinkedIn, Indeed, SEEK, Reed job extraction
- **Extension-to-frontend communication**: Custom events for sign-out commands

### Side Panel (`pages/side-panel/src/`)
- **useJobJourneyState**: Main hook for extension state management
- **ToastManager**: Centralized toast notification system with deduplication
- **AuthSection**: Authentication UI with sign-in/sign-out functionality

### Key Communication Flows

1. **Authentication Sync**:
   - Content script monitors localStorage changes
   - Sends `AUTH_DETECTED`/`AUTH_CLEARED` to background
   - Background updates internal state and broadcasts to UI
   - Side panel receives updates and shows appropriate toasts

2. **Sign-out Flow**:
   - User clicks sign-out in extension
   - Background finds JobJourney tabs
   - Sends `EXTENSION_SIGN_OUT_COMMAND` to content script
   - Content script triggers frontend logout via custom event
   - Authentication change detected and synced back to extension

3. **Job Scraping**:
   - Side panel initiates scraping via background service
   - Background coordinates with content scripts on job sites
   - Results processed and stored via ScrapingService
   - Progress updates broadcast to UI

## Environment Configuration

### Environment Variables
Environment variables in `.env` with `CEB_` prefix:
- `CEB_JOBJOURNEY_FRONTEND_DEV/PROD`: JobJourney web app URLs
- `CEB_JOBJOURNEY_API_DEV/PROD`: JobJourney API endpoints

CLI-controlled variables (set via scripts):
- `CLI_CEB_DEV`: Development mode flag (`true`/`false`)
- `CLI_CEB_FIREFOX`: Firefox build flag (`true`/`false`)

### Manifest Switching System
The extension uses two separate manifest files:
- **`manifest.ts`**: Production version (default) - Chrome Web Store ready
- **`manifest.dev.ts`**: Development version - includes localhost permissions

**Development Manifest Features:**
- Localhost permissions for ports: 3000, 5001, 5014, 5000
- Additional permission: `system.display`
- Extension name: "JobJourney Assistant (Dev)"
- Content script injection on localhost URLs

**Production Manifest Features:**
- Only production domains (jobjourney.me, LinkedIn, Indeed, SEEK, Reed)
- No localhost permissions
- Extension name: "JobJourney Assistant"
- Chrome Web Store compliant

**Switching Commands:**
```bash
pnpm manifest:dev   # Copy manifest.dev.ts → manifest.ts
pnpm manifest:prod  # Use production manifest.ts (default)
```

**Important:** Always switch to production before creating Chrome Web Store builds.

## Important Implementation Details

### Authentication System
- **No token validation on startup**: Prevents clearing valid tokens
- **Event-driven detection**: Uses localStorage monitoring for instant sync
- **Toast deduplication**: 2-second debounce prevents duplicate notifications
- **Cross-tab coordination**: Smart logic prevents multiple tabs from showing duplicate toasts

### Content Script Injection
- **Precise domain matching**: Uses URL parsing instead of string inclusion for tab detection
- **Auth page detection**: Prevents false "signed out" toasts during sign-in flow
- **Silent sync capability**: Can sync auth state without triggering toast notifications

### Error Handling
- **Extension context validation**: Handles extension lifecycle properly
- **Graceful fallbacks**: Sign-out flow works even when JobJourney tabs aren't responsive
- **Logging system**: Comprehensive logging with different levels (info, warning, error, success)

## Testing the Extension

1. Load unpacked extension from `dist/` folder in Chrome
2. Navigate to JobJourney web app or job sites (LinkedIn, Indeed, etc.)
3. Use Chrome DevTools → Extensions → Service Worker for background debugging
4. Check console logs in content script context for auth monitoring

## Known Considerations

- Extension requires broad permissions for job site scraping
- Authentication depends on JobJourney's localStorage structure
- Sign-out functionality requires active JobJourney tabs or creates temporary ones
- Toast system includes smart deduplication across multiple tabs