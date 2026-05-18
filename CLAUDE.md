# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**JobJourney Chrome Extension** — a job search assistant that scrapes listings from multiple platforms (LinkedIn, Indeed, SEEK, Jora, Reed) and integrates with the JobJourney web app. Built with React + Vite + TypeScript as a pnpm monorepo with Turbo build orchestration.

## Development Commands

```bash
# Environment switching (MUST run manifest:dev before local development)
pnpm manifest:dev          # Enable localhost permissions
pnpm manifest:prod         # Production manifest (before Chrome Web Store builds)

# Development
pnpm dev                   # Chrome dev mode (run manifest:dev first)
pnpm dev:firefox           # Firefox dev mode

# Production builds
pnpm build                 # Chrome production build
pnpm build:firefox         # Firefox production build
pnpm build && pnpm zip     # Chrome Web Store distributable

# Code quality (run before committing)
pnpm lint                  # ESLint check
pnpm lint:fix              # Auto-fix linting issues
pnpm format                # Prettier formatting
pnpm type-check            # TypeScript compilation check

# Testing
pnpm e2e                   # End-to-end tests

# Dependencies
pnpm i <package> -w        # Install to root
pnpm i <package> -F <mod>  # Install to specific workspace module

# Clean rebuild
pnpm clean:bundle && pnpm build
```

## Architecture Overview

### Monorepo Structure

```
chrome-extension/          # Background service worker entry point
  src/background/
    services/              # Core services (Auth, Api, Storage, Config, EventManager)
    services/scraping/     # ScrapingService + sub-services (Session, Progress, Tab, Window)
    services/background/   # Modular handlers (AuthModule, MessageHandlerModule, ScrapingModule, etc.)
pages/
  content/src/matches/jobsites/  # Content scripts: scrapers + save-button system
  side-panel/src/                # Side panel UI (React)
packages/
  types/                   # @extension/types — single source of truth for all shared types
  shared/                  # @extension/shared — utilities (logger, PR detection, environment)
  storage/                 # @extension/storage — Chrome storage abstraction
  env/                     # @extension/env — environment config (IS_DEV, IS_PROD, IS_FIREFOX)
  ui/                      # @extension/ui — reusable UI components
  vite-config/             # Build helpers (withPageConfig, content script builders)
  (+ i18n, hmr, dev-utils, tailwindcss-config, tsconfig, zipper)
```

### Background Service Worker

Service-oriented architecture with dependency injection via `setDependencies()`:

- **BackgroundService** — main orchestrator, initializes all services and wires modular handlers
- **Core services**: AuthService, ApiService, StorageService, ConfigService, EventManager
- **Scraping sub-services**: ScrapingService orchestrates SessionManager, ProgressTracker, TabSequencer, WindowManager
- **Modular handlers** (`services/background/`): AuthModule, MessageHandlerModule, ScrapingModule, TabManagerModule, ToastModule, ChromeListenerModule, UtilityModule

### Content Scripts

Two scraper types in `pages/content/src/matches/jobsites/`:
- **Bulk scrapers**: LinkedIn, Indeed, SEEK, Jora — scrape search result pages
- **Single-job scrapers**: Extend `BaseSingleJobScraper` — extract data from individual job pages (LinkedIn, Indeed, SEEK, Jora, Reed, Atlassian, Canva, Macquarie, Westpac)
- **Save Button Manager** (`save-button-manager/`): Modular DI system — SaveButtonManager, PlatformDetector, JobDataExtractor, InsertionPointFinder, ButtonComponent, PRRequirementDetector, AppliedStatusDetector

### Side Panel

- `useJobJourneyState` hook — main state management
- Components: AuthSection, SearchSection, ProgressSection, ResultsSection, ToastManager

### Key Communication Flows

1. **Auth sync**: Content script monitors localStorage → sends `AUTH_DETECTED`/`AUTH_CLEARED` to background → broadcasts to side panel
2. **Sign-out**: Side panel → background finds JobJourney tabs → `EXTENSION_SIGN_OUT_COMMAND` to content script → triggers frontend logout → auth change syncs back
3. **Job scraping**: Side panel → background ScrapingService → coordinates with content scripts → progress updates broadcast to UI

## Important Patterns & Conventions

### Type System (`@extension/types`)

All shared types live in `packages/types/` — never define types inline or in service files:
- `MessageType` and `EventType` are **enums** (not hardcoded strings)
- `PlatformId` is a union type: `'linkedin' | 'indeed' | 'seek' | 'jora' | 'reed' | ...`
- Boolean properties use `is` prefix: `isPRRequired`, `isAlreadyApplied`
- Key type files: `job.ts`, `auth.ts`, `platform.ts`, `scraping.ts`, `messages.ts`, `api.ts`, `storage.ts`

### Dependency Injection

Services use post-construction `setDependencies()` to avoid circular imports. BackgroundService wires all modules via handler registration in MessageHandlerModule.

### Adding a New Job Site Scraper

1. Create a class extending `BaseSingleJobScraper` in `pages/content/src/matches/jobsites/`
2. Implement the required extraction methods
3. Register in `scraper-factory.ts`
4. Add the platform to the `PlatformId` type in `@extension/types`

### Extension Context Monitoring

Content scripts must handle extension lifecycle — use `chrome.runtime.connect()` with `onDisconnect` listener to detect when the extension is disabled and clean up DOM modifications.

## Environment Configuration

Environment variables in `.env` use `CEB_` prefix:
- `CEB_JOBJOURNEY_FRONTEND_DEV/PROD` — web app URLs
- `CEB_JOBJOURNEY_API_DEV/PROD` — API endpoints
- `CLI_CEB_DEV`, `CLI_CEB_FIREFOX` — set automatically by build scripts, not manually

### Manifest System

Two manifest files in `chrome-extension/`:
- `manifest.ts` — production (Chrome Web Store ready)
- `manifest.dev.ts` — development (adds localhost permissions for ports 3000, 5001, 5014, 5000)

`pnpm manifest:dev` copies dev → production. **Always run `pnpm manifest:prod` before Chrome Web Store builds.**

## Version Management

The Chrome Web Store reads the version from `chrome-extension/package.json`, NOT the root `package.json`. Both should be kept in sync, but `chrome-extension/package.json` is authoritative.

## Known Considerations

- Authentication depends on JobJourney's localStorage structure
- Sign-out requires active JobJourney tabs or creates temporary ones
- Toast system includes cross-tab deduplication with 2-second debounce
- DOM modifications (body padding, fixed element positioning) auto-restore when extension is disabled
- PR/sponsorship requirement detection uses keyword matching — may have false positives/negatives
