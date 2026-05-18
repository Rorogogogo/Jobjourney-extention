# Extension Restructure — Progress Summary

**Date:** 2026-03-08
**Branch:** JJ-4.0
**Plan:** `docs/plans/2026-03-07-extension-restructure-plan.md`

---

## Completed Tasks

### Task 1-5: `@extension/types` Package (DONE)
Created `packages/types/` with 9 type modules as single source of truth:
- `platform.ts` — `PlatformId`, `Platform`, `CountryConfig`, `PlatformUrls`
- `analysis.ts` — `PrRequirementResult`, `PrDetectionResult` (uses `isRPRequired`), `AppliedStatusResult` (uses `isApplied`), `WorkArrangementResult`, `EmploymentTypeResult`, `TechStackResult`, `ExperienceLevelResult`, `JobAnalysisResult`
- `job.ts` — `JobData`, `JobConstructorParams` (expanded with all fields: salary, postedDate, companyLogoUrl, jobType, workplaceType, applicantCount, isAlreadyApplied, appliedDateUtc), `JobExtractorResult`, `JobScraper`
- `auth.ts` — `AuthUser`, `AuthStatus`
- `api.ts` — `ApiResponse<T>`
- `scraping.ts` — `ScrapingSession`, `ScrapingProgress`, `PlatformProgress`, `SearchConfig`, `SearchResults`
- `messages.ts` — `MessageType` enum (30+ members), `EventType` enum (12+ members), `ChromeMessage<T>`, `ChromeResponse<T>`, `EventData`
- `storage.ts` — `STORAGE_KEYS`, `StorageData`, `UserSettings`, `CacheData`
- `config.ts` — `ConfigData`

### Task 6-7: Dead Code Removal (DONE)
- Deleted boilerplate pages: `popup/`, `options/`, `new-tab/`, `devtools/`, `devtools-panel/`, `content-ui/`, `content-runtime/`
- Deleted `packages/module-manager/`
- Deleted dead content files: `index_backup.ts`, `saveJobButton-refactored.ts`, `button-manager.ts`
- Removed `module-manager` script from root `package.json`

### Task 8: Background Services Migration (DONE)
- Added `@extension/types` dependency to `chrome-extension/package.json`
- Deleted `chrome-extension/src/background/types/index.ts`
- Migrated all background service files to import from `@extension/types`
- Replaced all `MESSAGE_TYPES.X` with `MessageType.X`
- Replaced all `this.eventManager.emit('STRING')` with `EventType.X`
- Updated all modules in `background/services/background/`:
  - `MessageHandlerModule.ts` — all 15 case statements use `MessageType.X`
  - `ScrapingModule.ts`, `UtilityModule.ts`, `TabManagerModule.ts`, `ToastModule.ts`, `AuthModule.ts`, `ChromeListenerModule.ts`

### Task 9: Content Scripts Migration (DONE)
- Replaced the remaining hardcoded content-script message strings with `MessageType` in the 4 main scrapers, `save-button-manager/api-service.ts`, `saveJobButton.ts`, `index.ts`, and `indicator.ts`
- Removed the last legacy local `JobData` interface definitions in content files and switched them to `@extension/types`
- Fixed follow-on content typing issues discovered during package verification (`JobConstructorParams` import, `Platform`/`PlatformId` mismatches, `isRPRequired` compatibility, applied date nullability, single-job-scraper imports/exports)
- Verification: `pnpm -F @extension/content-script type-check` PASS

### Task 10: Side Panel Migration (DONE)
- Updated `ToastManager.tsx`, `AuthSection.tsx`, `ResultsSection.tsx`, and `ProgressSection.tsx` to use shared types and `MessageType`
- Fixed `url` → `jobUrl` usage via shared `SearchResults`
- Moved the side-panel environment helper into `@extension/shared` and deleted `pages/side-panel/src/utils/environment.ts`
- Also migrated the dev mock action to `MessageType.MOCK_LARGE_SCRAPE`
- Verification: `pnpm -F @extension/sidepanel type-check` PASS

### Task 11: Shared Utility Consolidation (DONE)
- Moved duplicated environment, logger, and PR-detection helpers into `packages/shared/lib/utils/`
- Updated background/content consumers to import from `@extension/shared`
- Deleted the duplicated utility files from `chrome-extension/src/background/utils/` and content

### Task 12: ScrapingService Split (DONE)
- Added `SessionManager`, `WindowManager`, `TabSequencer`, and `ProgressTracker`
- Refactored `ScrapingService` to delegate session/window/tab/progress responsibilities to those focused classes
- Added `chrome-extension/src/background/services/scraping/ScrapingService.ts` as the new import surface

### Task 13: ApiService 401 Handling (DONE)
- Removed direct logout/tab management from `ApiService`
- Injected `EventManager` into `ApiService`
- On HTTP 401, `ApiService` now emits `EventType.UNAUTHORIZED`
- `BackgroundService` now owns the unauthorized flow by clearing auth and delegating tab sign-out

### Task 14: MessageHandlerModule Map Dispatch (DONE)
- Converted `MessageHandlerModule` from `switch` dispatch to a `Map<MessageType, handler>`
- Added explicit payload narrowing for message data access (`sessionId`, `shouldShowToast`, mock scrape payloads)
- Eliminated the remaining `MessageHandlerModule` type errors

### Task 15: Background Constants Cleanup (DONE)
- Removed duplicated background-only type/interface definitions from `chrome-extension/src/background/constants/index.ts`
- Removed dead `MESSAGE_TYPES` and `STORAGE_KEYS` exports from that constants file
- Switched background constants typing to shared contracts from `@extension/types`
- Updated `ScrapingService` to consume `Platform` from `@extension/types`

### Task 16: Final Verification and Cleanup (DONE)
- Fixed the remaining background module type issues in `AuthService`, `AuthModule`, `ScrapingModule`, `TabManagerModule`, `ToastModule`, `UtilityModule`, and `BackgroundService`
- Replaced the final hardcoded runtime message strings that remained in content/side-panel code
- Normalized cleanup scripts that used `pnpx rimraf` to local `rimraf`/`turbo` so build/clean commands no longer depend on registry access
- Verification:
  - `pnpm -F chrome-extension type-check` PASS
  - `pnpm type-check` PASS
  - `pnpm lint` PASS (warnings only)
  - `pnpm build` PASS

---

## Remaining Work

No remaining restructure tasks from the 2026-03-07 plan.

---

## Important Notes

### Type Field Names (decided during migration)
- `PrDetectionResult.isRPRequired` — matches existing codebase usage
- `AppliedStatusResult.isApplied` (not `isAlreadyApplied`) — matches detector return values
- `PrRequirementResult` = renamed `CitizenshipRequirementResult` (comprehensive version with citizenship + security clearance)
- `PrDetectionResult` = simplified version (just isRPRequired + confidence + patterns + reasoning)

### Former Pre-existing Type Errors
These were cleaned up during Task 16:
- `WestpacScraper` and `CanvaScraper` compatibility issues around `JobData | undefined` vs `JobData | null`
- `progressError` handling in `seek-scraper.ts`

### Node.js Version
The project expects Node ^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0 but the dev machine has v23.11.0. `pnpm install` fails; use `--ignore-engines` or update Node.

### Build Verification Note
`pnpm build` required an unrestricted rerun in this environment because the content build script (`tsx build.mts`) uses a local IPC pipe that is blocked by the default sandbox. The unrestricted build completed successfully.
