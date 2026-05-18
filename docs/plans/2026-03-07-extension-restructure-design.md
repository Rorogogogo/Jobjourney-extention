# Extension Restructure Design

## Problem

The Chrome extension codebase has accumulated significant technical debt:
- **Type duplication**: `JobData` defined 5 times, `AuthStatus` 3 times, `Platform` 4 times — each with different fields
- **Hardcoded message strings**: 14+ message types scattered as raw strings across 16+ files, only 11 in the `MESSAGE_TYPES` constant
- **Code duplication**: ~400-500 lines of duplicate code (`environment.ts` 95% identical in 2 locations, `prDetection.ts` duplicated with divergent logic)
- **God objects**: `ScrapingService` at 1900 lines handling sessions, windows, tabs, timeouts, and progress
- **Naming inconsistencies**: legacy PR field naming, `jobUrl` vs `url`, `isApplied` vs `isAlreadyApplied`
- **Dead code**: 6 unused boilerplate page directories, backup files, redundant `button-manager.ts`
- **Architecture issues**: ApiService handles 401 logout (SRP violation), side panel polls AND listens for events (redundant), post-construction DI via `setDependencies()`

## Approach

"Clean Layers" — new shared types package as single source of truth, modular service splits, utility consolidation, dead code removal. Edit existing files in place (not rewrite from scratch), except for the new `@extension/types` package.

## Design

### 1. New `@extension/types` Package

Single source of truth for all shared type definitions, message contracts, and constants.

```
packages/types/
├── lib/
│   ├── index.ts              # Re-exports everything
│   ├── job.ts                # JobData, JobConstructorParams, JobAnalysisResult
│   ├── auth.ts               # AuthStatus, AuthToken
│   ├── platform.ts           # Platform, PlatformId, CountryConfig, PlatformUrls
│   ├── scraping.ts           # ScrapingSession, ScrapingProgress, SearchConfig, SearchResults
│   ├── messages.ts           # MessageType enum, EventType enum, ChromeMessage<T>, ChromeResponse<T>
│   ├── api.ts                # ApiResponse<T>
│   ├── storage.ts            # StorageData, StorageKeys, CacheData, UserSettings
│   └── analysis.ts           # PrRequirementResult, WorkArrangementResult, EmploymentTypeResult, TechStackResult, ExperienceLevelResult, PrDetectionResult, AppliedStatusResult
├── package.json
└── tsconfig.json
```

Key decisions:
- `MessageType` and `EventType` are enums with all known message types
- `PlatformId` is a union type: `'linkedin' | 'indeed' | 'seek' | 'jora' | 'reed' | 'atlassian' | 'canva' | 'macquarie' | 'westpac'`
- Standardized naming: `isRPRequired`, `jobUrl`, `isAlreadyApplied`

### 2. Background Service Restructure

Split ScrapingService (1900 lines) into 4 focused modules:

```
chrome-extension/src/background/services/
├── scraping/
│   ├── ScrapingService.ts    # Orchestrator only
│   ├── SessionManager.ts     # Session lifecycle
│   ├── WindowManager.ts      # Chrome window creation/cleanup
│   ├── TabSequencer.ts       # Tab queuing, activation
│   └── ProgressTracker.ts    # Progress tracking, broadcasting
```

ApiService change: Remove `performLogoutWithFallback()`, emit `EventType.UNAUTHORIZED` instead. BackgroundService handles the logout coordination.

MessageHandlerModule: Convert switch statement to Map-based dispatch.

Delete: `chrome-extension/src/background/types/index.ts`, `chrome-extension/src/background/constants/index.ts` (content moves to `@extension/types`).

### 3. Shared Utilities Consolidation

Merge duplicates into `@extension/shared`:

- `environment.ts` (2 copies) -> single `packages/shared/lib/utils/environment.ts`
- `prDetection.ts` (2 copies) -> single `packages/shared/lib/utils/pr-detection.ts` (comprehensive version)
- `Logger.ts` -> `packages/shared/lib/utils/logger.ts`

Delete originals from `pages/side-panel/src/utils/` and `chrome-extension/src/background/utils/`.

### 4. Content Scripts Cleanup

Delete:
- `button-manager.ts` (redundant, replaced by `save-button-manager/`)
- `save-button-manager/types.ts` (replaced by `@extension/types`)
- `index_backup.ts` (dead backup)
- `saveJobButton-refactored.ts` (dead code)

Keep all scrapers (both bulk and single-job). Update imports to `@extension/types`. Move analysis type definitions from `descriptionAnalysis.ts` to `@extension/types/analysis.ts`.

### 5. Side Panel Cleanup

- Remove all inline type definitions from components and hooks (import from `@extension/types`)
- Remove polling in `useJobJourneyState.ts` (rely on broadcast messages only)
- Delete `pages/side-panel/src/utils/environment.ts` (import from `@extension/shared`)
- Keep country/platform DATA constants in `constants/index.ts`, typed with imported interfaces

### 6. Dead Code Removal

Delete unused boilerplate page directories:
- `pages/popup/`, `pages/options/`, `pages/new-tab/`
- `pages/devtools/`, `pages/devtools-panel/`
- `pages/content-ui/`, `pages/content-runtime/`

Delete unused package:
- `packages/module-manager/`

Update `pnpm-workspace.yaml`, `turbo.json`, root `package.json` to remove references.

### 7. Naming Standardization

| Current | New |
|---------|-----|
| legacy PR field | `isRPRequired` |
| `url` (ResultsSection) | `jobUrl` |
| `isApplied` (AppliedStatusResult) | `isAlreadyApplied` |
| `PRDetectionResult` | `PrDetectionResult` |
| `CitizenshipRequirementResult` | `PrRequirementResult` |
| `SearchProgress` (side panel) | `ScrapingProgress` |
| Hardcoded message strings | `MessageType.X` enum references |

Conventions:
- Types/Interfaces: `PascalCase`
- Enum members: `UPPER_SNAKE_CASE`
- Boolean properties: `is` prefix, `camelCase`
- Platform IDs: lowercase string literals
