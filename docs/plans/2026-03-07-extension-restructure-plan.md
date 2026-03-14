# Extension Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the Chrome extension to eliminate type duplication, consolidate shared utilities, split god objects, remove dead code, and standardize naming.

**Architecture:** New `@extension/types` package as single source of truth for all shared contracts. Background ScrapingService split into 4 focused modules. Duplicate utilities merged into `@extension/shared`. Dead boilerplate pages removed.

**Tech Stack:** TypeScript, pnpm workspaces, Turbo, Chrome Extension Manifest V3, React

---

### Task 1: Create `@extension/types` Package — Scaffold

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/lib/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@extension/types",
  "version": "1.0.0",
  "description": "Shared type definitions for JobJourney extension",
  "type": "module",
  "private": true,
  "sideEffects": false,
  "files": ["dist/**"],
  "types": "index.mts",
  "main": "dist/index.mjs",
  "scripts": {
    "clean:bundle": "rimraf dist",
    "clean:node_modules": "pnpx rimraf node_modules",
    "clean:turbo": "rimraf .turbo",
    "clean": "pnpm clean:bundle && pnpm clean:node_modules && pnpm clean:turbo",
    "ready": "tsc -b",
    "lint": "eslint .",
    "lint:fix": "pnpm lint --fix",
    "format": "prettier . --write --ignore-path ../../.prettierignore",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "@extension/tsconfig": "workspace:*"
  }
}
```

**Step 2: Create tsconfig.json**

Model after `packages/env/tsconfig.json`. Extends `@extension/tsconfig/module.json`, includes `lib/**/*.ts`.

**Step 3: Create empty index.ts**

```typescript
// @extension/types — single source of truth for all shared type definitions
```

**Step 4: Install dependencies**

Run: `cd /Users/roro/Downloads/work/JJ/JJ-extension-3.0 && pnpm install`
Expected: Package resolves successfully in workspace.

**Step 5: Verify**

Run: `pnpm -F @extension/types type-check`
Expected: PASS (empty package compiles)

**Step 6: Commit**

```bash
git add packages/types/
git commit -m "feat: scaffold @extension/types package"
```

---

### Task 2: Create `@extension/types` — Platform Types

**Files:**
- Create: `packages/types/lib/platform.ts`
- Modify: `packages/types/lib/index.ts`

**Reference files (DO NOT modify yet):**
- `chrome-extension/src/background/types/index.ts:72-79` — Platform interface
- `chrome-extension/src/background/constants/index.ts:6-31` — CountryConfig, PlatformUrls, Platform
- `pages/side-panel/src/constants/index.ts:1-15` — CountryConfig, Platform (subset)
- `pages/content/src/matches/jobsites/save-button-manager/types.ts:41-50` — Platform union

**Step 1: Create platform.ts**

```typescript
// Platform identification and configuration types

export type PlatformId =
  | 'linkedin'
  | 'indeed'
  | 'seek'
  | 'jora'
  | 'reed'
  | 'macquarie'
  | 'atlassian'
  | 'westpac'
  | 'canva';

export interface Platform {
  id: PlatformId;
  name: string;
  icon: string;
  domains: string[];
  color: string;
  enabled: boolean;
}

export interface PlatformUrls {
  linkedin?: string;
  seek?: string;
  indeed?: string;
  jora?: string;
  reed?: string;
}

export interface CountryConfig {
  name: string;
  code: string;
  icon: string;
  platforms: PlatformId[];
  locations: string[];
  urls: PlatformUrls;
}
```

**Step 2: Export from index.ts**

```typescript
export * from './platform.js';
```

**Step 3: Verify**

Run: `pnpm -F @extension/types type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/types/
git commit -m "feat: add platform types to @extension/types"
```

---

### Task 3: Create `@extension/types` — Job & Analysis Types

**Files:**
- Create: `packages/types/lib/job.ts`
- Create: `packages/types/lib/analysis.ts`
- Modify: `packages/types/lib/index.ts`

**Reference files (DO NOT modify yet):**
- `chrome-extension/src/background/types/index.ts:26-42` — JobData
- `pages/content/src/matches/jobsites/types.ts:2-16` — JobData (content version)
- `pages/content/src/matches/jobsites/save-button-manager/types.ts:4-19` — JobData (save-button version)
- `pages/content/src/matches/jobsites/descriptionAnalysis.ts:3-33` — Analysis result types
- `pages/content/src/matches/jobsites/prDetection.ts:5-12` — CitizenshipRequirementResult
- `pages/content/src/matches/jobsites/save-button-manager/types.ts:21-33` — AppliedStatusResult, PRDetectionResult

**Step 1: Create analysis.ts**

```typescript
// Job description analysis types

export interface PrRequirementResult {
  isRPRequired: boolean;
  isCitizenRequired: boolean;
  securityClearance: string | null;
  confidence: 'high' | 'medium' | 'low';
  matchedPatterns: string[];
  reasoning: string;
}

export interface PrDetectionResult {
  isRPRequired: boolean;
  confidence: 'high' | 'medium' | 'low';
  matchedPatterns: string[];
  reasoning: string;
}

export interface AppliedStatusResult {
  isAlreadyApplied: boolean;
  appliedDateUtc?: string;
  detectionSource: 'explicit' | 'inferred';
  rawText?: string;
}

export interface WorkArrangementResult {
  type: 'remote' | 'hybrid' | 'on-site' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface EmploymentTypeResult {
  type: 'full-time' | 'contract' | 'part-time' | 'casual' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface TechStackResult {
  technologies: string[];
  count: number;
}

export interface ExperienceLevelResult {
  level: 'senior' | 'mid' | 'junior' | 'lead' | 'graduate' | 'intern' | 'unknown';
  years: number | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface JobAnalysisResult {
  workArrangement: WorkArrangementResult;
  employmentType: EmploymentTypeResult;
  experienceLevel: ExperienceLevelResult;
  techStack: TechStackResult;
  prDetection: PrRequirementResult;
}
```

**Step 2: Create job.ts**

```typescript
// Job data types — single source of truth
import type { PlatformId } from './platform.js';
import type { JobAnalysisResult } from './analysis.js';

export interface JobData {
  id?: string;
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  platform: PlatformId | string;
  description?: string;
  salary?: string;
  postedDate?: string;
  extractedAt?: string | null;
  isRPRequired?: boolean;
  companyLogoUrl?: string | null;
  requiredSkills?: string;
  employmentTypes?: string;
  workArrangement?: string;
  analysis?: JobAnalysisResult;
  isAlreadyApplied?: boolean;
  appliedDateUtc?: string | null;
}

export interface JobConstructorParams {
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  platform: PlatformId | string;
  description?: string;
}

export interface JobExtractorResult {
  jobs: JobData[];
  nextPage?: string;
  hasMore: boolean;
  errors?: string[];
}

export interface JobScraper {
  extractJobData(): JobData | null;
  findInsertionPoint(): HTMLElement | null;
}
```

**Step 3: Export from index.ts**

```typescript
export * from './platform.js';
export * from './job.js';
export * from './analysis.js';
```

**Step 4: Verify**

Run: `pnpm -F @extension/types type-check`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/types/
git commit -m "feat: add job and analysis types to @extension/types"
```

---

### Task 4: Create `@extension/types` — Auth, API, Scraping Types

**Files:**
- Create: `packages/types/lib/auth.ts`
- Create: `packages/types/lib/api.ts`
- Create: `packages/types/lib/scraping.ts`
- Modify: `packages/types/lib/index.ts`

**Reference files:**
- `chrome-extension/src/background/types/index.ts:3-18` — ScrapingSession, ScrapingProgress
- `chrome-extension/src/background/types/index.ts:44-50` — SearchConfig
- `chrome-extension/src/background/types/index.ts:52-63` — AuthStatus
- `chrome-extension/src/background/types/index.ts:65-70` — ApiResponse
- `pages/side-panel/src/hooks/useJobJourneyState.ts:3-52` — AuthStatus, SearchProgress, SearchResults, SearchConfig

**Step 1: Create auth.ts**

```typescript
// Authentication types

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  isPro?: boolean;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  user?: AuthUser;
  token?: string;
  expiresAt?: number;
}
```

**Step 2: Create api.ts**

```typescript
// API response types

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

**Step 3: Create scraping.ts**

```typescript
// Scraping session and progress types
import type { PlatformId } from './platform.js';

export interface ScrapingSession {
  id: string;
  startTime: Date | number;
  status: 'active' | 'running' | 'completed' | 'error' | 'stopped';
  platforms: string[];
  keywords: string;
  progress?: ScrapingProgress;
}

export interface ScrapingProgress {
  totalPlatforms: number;
  completedPlatforms: number;
  currentPlatform?: string;
  jobsFound: number;
  errors: string[];
}

export interface PlatformProgress {
  platform: PlatformId | string;
  status: 'pending' | 'active' | 'completed' | 'error';
  current: number;
  total: number;
  jobsFound: number;
  error?: string;
}

export interface SearchConfig {
  keywords: string;
  location?: string;
  country?: string;
  platforms: string[];
  maxJobs?: number;
}

export interface SearchResults {
  sessionId: string;
  jobs: JobData[];
  totalJobs: number;
  duration?: number;
}
```

Note: `SearchResults` references `JobData`, so add the import:
```typescript
import type { JobData } from './job.js';
```

**Step 4: Export from index.ts**

```typescript
export * from './platform.js';
export * from './job.js';
export * from './analysis.js';
export * from './auth.js';
export * from './api.js';
export * from './scraping.js';
```

**Step 5: Verify**

Run: `pnpm -F @extension/types type-check`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/types/
git commit -m "feat: add auth, api, and scraping types to @extension/types"
```

---

### Task 5: Create `@extension/types` — Messages, Storage, Config Types

**Files:**
- Create: `packages/types/lib/messages.ts`
- Create: `packages/types/lib/storage.ts`
- Create: `packages/types/lib/config.ts`
- Modify: `packages/types/lib/index.ts`

**Reference files:**
- `chrome-extension/src/background/types/index.ts:89-148` — EventType, MessageType, ConfigData, StorageData, UserSettings, CacheData
- `chrome-extension/src/background/constants/index.ts:430-450` — MESSAGE_TYPES, STORAGE_KEYS

**Step 1: Create messages.ts**

```typescript
// Message and event type definitions — single source of truth
// All Chrome message types and internal event types are defined here.
// NEVER use hardcoded strings for message types. Always use these enums.

export enum MessageType {
  // Auth messages
  GET_AUTH_STATUS = 'GET_AUTH_STATUS',
  AUTH_STATUS_CHANGED = 'AUTH_STATUS_CHANGED',
  AUTH_DETECTED = 'AUTH_DETECTED',
  AUTH_CLEARED = 'AUTH_CLEARED',
  SIGN_OUT_USER = 'SIGN_OUT_USER',

  // Scraping messages
  START_JOB_SEARCH = 'START_JOB_SEARCH',
  START_SCRAPING = 'START_SCRAPING',
  STOP_SCRAPING = 'STOP_SCRAPING',
  SCRAPING_PROGRESS = 'SCRAPING_PROGRESS',
  SCRAPING_PROGRESS_UPDATE = 'SCRAPING_PROGRESS_UPDATE',
  SCRAPING_COMPLETE = 'SCRAPING_COMPLETE',
  SCRAPING_ERROR = 'SCRAPING_ERROR',
  SCRAPE_JOBS = 'SCRAPE_JOBS',
  GET_SEARCH_PROGRESS = 'GET_SEARCH_PROGRESS',
  CLEAR_SCRAPED_JOBS = 'CLEAR_SCRAPED_JOBS',

  // Job transfer messages
  EXTENSION_JOBS_PROCESSED = 'EXTENSION_JOBS_PROCESSED',
  EXTENSION_JOBS_CHUNK = 'EXTENSION_JOBS_CHUNK',
  JOBS_SENDING = 'JOBS_SENDING',
  JOBS_SENT = 'JOBS_SENT',
  SAVE_JOB_MANUALLY = 'SAVE_JOB_MANUALLY',

  // UI messages
  SHOW_OVERLAY = 'SHOW_OVERLAY',
  HIDE_OVERLAY = 'HIDE_OVERLAY',

  // Extension lifecycle
  EXTENSION_SIGN_OUT_COMMAND = 'EXTENSION_SIGN_OUT_COMMAND',
  JOBJOURNEY_EXTENSION_PING = 'JOBJOURNEY_EXTENSION_PING',

  // API
  API_REQUEST = 'API_REQUEST',
  API_RESPONSE = 'API_RESPONSE',
}

export enum EventType {
  AUTH_STATUS = 'AUTH_STATUS',
  TOKEN_UPDATE = 'TOKEN_UPDATE',
  START_SCRAPING = 'START_SCRAPING',
  SCRAPING_PROGRESS = 'SCRAPING_PROGRESS',
  SCRAPING_COMPLETE = 'SCRAPING_COMPLETE',
  SCRAPING_ERROR = 'SCRAPING_ERROR',
  API_REQUEST = 'API_REQUEST',
  AUTH_CHECK_REQUIRED = 'AUTH_CHECK_REQUIRED',
  AUTH_STATUS_REFRESH = 'AUTH_STATUS_REFRESH',
  JOBS_SENDING = 'JOBS_SENDING',
  JOBS_SENT = 'JOBS_SENT',
  UNAUTHORIZED = 'UNAUTHORIZED',
}

export interface ChromeMessage<T = unknown> {
  type: MessageType | string;
  data?: T;
  timestamp?: number;
}

export interface ChromeResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface EventData {
  [key: string]: unknown;
}
```

**Step 2: Create storage.ts**

```typescript
// Storage types and keys
import type { AuthStatus } from './auth.js';

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'jobjourney_auth_token',
  USER_DATA: 'jobjourney_user_data',
  SEARCH_PREFERENCES: 'search_preferences',
  LAST_SCRAPE: 'last_scrape_data',
} as const;

export interface StorageData {
  auth?: AuthStatus;
  settings?: UserSettings;
  cache?: CacheData;
}

export interface UserSettings {
  defaultPlatforms: string[];
  maxJobsPerPlatform: number;
  autoRefreshInterval: number;
  notifications: boolean;
  theme: 'light' | 'dark' | 'auto';
}

export interface CacheData {
  [key: string]: {
    data: unknown;
    timestamp: number;
    expiresAt: number;
  };
}
```

**Step 3: Create config.ts**

```typescript
// Configuration types

export interface ConfigData {
  environment: 'development' | 'production';
  baseUrl: string;
  apiUrl: string;
  initialized: boolean;
}
```

**Step 4: Export from index.ts**

```typescript
export * from './platform.js';
export * from './job.js';
export * from './analysis.js';
export * from './auth.js';
export * from './api.js';
export * from './scraping.js';
export * from './messages.js';
export * from './storage.js';
export * from './config.js';
```

**Step 5: Verify**

Run: `pnpm -F @extension/types type-check`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/types/
git commit -m "feat: add messages, storage, and config types to @extension/types"
```

---

### Task 6: Delete Unused Boilerplate Pages

**Files:**
- Delete: `pages/popup/` (entire directory)
- Delete: `pages/options/` (entire directory)
- Delete: `pages/new-tab/` (entire directory)
- Delete: `pages/devtools/` (entire directory)
- Delete: `pages/devtools-panel/` (entire directory)
- Delete: `pages/content-ui/` (entire directory)
- Delete: `pages/content-runtime/` (entire directory)
- Delete: `packages/module-manager/` (entire directory)
- Modify: `package.json:37` — remove `module-manager` script

**Step 1: Verify none are imported by active code**

Run: `grep -r "content-runtime\|content-ui\|devtools-panel\|devtools\|new-tab\|options\|popup" --include="*.ts" --include="*.tsx" pages/side-panel/ pages/content/ chrome-extension/src/`
Expected: No matches (or only references inside deleted directories)

Also check:
Run: `grep -r "module-manager" --include="*.ts" --include="*.tsx" chrome-extension/ pages/ packages/ --exclude-dir=module-manager`
Expected: No matches

**Step 2: Delete directories**

```bash
rm -rf pages/popup pages/options pages/new-tab pages/devtools pages/devtools-panel pages/content-ui pages/content-runtime packages/module-manager
```

**Step 3: Remove module-manager script from root package.json**

Remove line 37: `"module-manager": "pnpm -F module-manager start",`

**Step 4: Verify workspace still resolves**

Run: `pnpm install`
Expected: Resolves without errors (workspace globs `pages/*` and `packages/*` auto-exclude deleted dirs)

**Step 5: Verify build**

Run: `pnpm type-check`
Expected: PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove unused boilerplate pages and module-manager package"
```

---

### Task 7: Delete Dead Content Script Files

**Files:**
- Delete: `pages/content/src/matches/jobsites/index_backup.ts`
- Delete: `pages/content/src/matches/jobsites/saveJobButton-refactored.ts`
- Delete: `pages/content/src/matches/jobsites/button-manager.ts`

**Step 1: Verify button-manager.ts is not imported**

Run: `grep -r "button-manager" --include="*.ts" --include="*.tsx" pages/content/src/`
Expected: No imports from `button-manager.ts` (only from `save-button-manager/`)

**Step 2: Verify backup files are not imported**

Run: `grep -r "index_backup\|saveJobButton-refactored" --include="*.ts" --include="*.tsx" pages/`
Expected: No matches

**Step 3: Delete files**

```bash
rm pages/content/src/matches/jobsites/index_backup.ts
rm pages/content/src/matches/jobsites/saveJobButton-refactored.ts
rm pages/content/src/matches/jobsites/button-manager.ts
```

**Step 4: Verify build**

Run: `pnpm type-check`
Expected: PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove dead content script files (backup, refactored, redundant button-manager)"
```

---

### Task 8: Migrate Background Services to `@extension/types`

**Files:**
- Modify: `chrome-extension/package.json` — add `@extension/types` dependency
- Delete: `chrome-extension/src/background/types/index.ts`
- Modify: `chrome-extension/src/background/services/BackgroundService.ts` — update imports
- Modify: `chrome-extension/src/background/services/AuthService.ts` — update imports
- Modify: `chrome-extension/src/background/services/ApiService.ts` — update imports
- Modify: `chrome-extension/src/background/services/ScrapingService.ts` — update imports
- Modify: `chrome-extension/src/background/services/StorageService.ts` — update imports
- Modify: `chrome-extension/src/background/services/EventManager.ts` — update imports
- Modify: `chrome-extension/src/background/services/ConfigService.ts` — update imports
- Modify: all files in `chrome-extension/src/background/services/background/` — update imports

**Step 1: Add @extension/types dependency to chrome-extension/package.json**

Add to devDependencies: `"@extension/types": "workspace:*"`

Run: `pnpm install`

**Step 2: Delete old types file**

```bash
rm chrome-extension/src/background/types/index.ts
rmdir chrome-extension/src/background/types
```

**Step 3: Update all imports in background services**

Replace all occurrences of:
```typescript
import type { ... } from '../types';
```
With:
```typescript
import type { ... } from '@extension/types';
```

Also replace `import { MESSAGE_TYPES, STORAGE_KEYS } from '../constants'` patterns — keep constants that are DATA (like `PLATFORMS`, `COUNTRIES`, `buildSearchUrl`, `TIMEOUT_CONFIG`, `SCRAPING_CONFIG`) in the constants file, but import type definitions and `MESSAGE_TYPES`/`STORAGE_KEYS` from `@extension/types`.

**Step 4: Update constants/index.ts**

- Remove `interface CountryConfig`, `interface PlatformUrls`, `interface Platform` definitions (import from `@extension/types`)
- Remove `MESSAGE_TYPES` and `STORAGE_KEYS` constants (now in `@extension/types/messages.ts` and `@extension/types/storage.ts`)
- Keep: `PLATFORMS` data, `COUNTRIES` data, `JOB_SUGGESTIONS`, `buildSearchUrl`, `TIMEOUT_CONFIG`, `SCRAPING_CONFIG`, `UI_STATES`
- Add import: `import type { Platform, CountryConfig, PlatformUrls } from '@extension/types';`

**Step 5: Update message string usage**

Replace hardcoded strings with enum values. Example:
```typescript
// Before
case 'AUTH_DETECTED':
// After
case MessageType.AUTH_DETECTED:
```

Do this across all background service files.

**Step 6: Verify**

Run: `pnpm -F chrome-extension type-check`
Expected: PASS

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: migrate background services to @extension/types"
```

---

### Task 9: Migrate Content Scripts to `@extension/types`

**Files:**
- Modify: `pages/content/package.json` — add `@extension/types` dependency
- Delete: `pages/content/src/matches/jobsites/types.ts`
- Delete: `pages/content/src/matches/jobsites/save-button-manager/types.ts`
- Modify: `pages/content/src/matches/jobsites/job-class.ts` — remove duplicate JobData, import from `@extension/types`
- Modify: `pages/content/src/matches/jobsites/descriptionAnalysis.ts` — remove type definitions (keep analysis logic), import types from `@extension/types`
- Modify: `pages/content/src/matches/jobsites/prDetection.ts` — rename `CitizenshipRequirementResult` to `PrRequirementResult`, or import from `@extension/types`
- Modify: `pages/content/src/matches/jobsites/save-button-manager/index.ts` — update re-exports
- Modify: all scraper files — update imports
- Modify: `pages/content/src/matches/jobsites/authMonitoring.ts` — use `MessageType` enum
- Modify: `pages/content/src/matches/jobsites/index.ts` — use `MessageType` enum
- Modify: `pages/content/src/matches/jobsites/save-button-manager/*.ts` — update imports

**Step 1: Add dependency**

Add `"@extension/types": "workspace:*"` to `pages/content/package.json` devDependencies.

Run: `pnpm install`

**Step 2: Delete duplicate type files**

```bash
rm pages/content/src/matches/jobsites/types.ts
rm pages/content/src/matches/jobsites/save-button-manager/types.ts
```

**Step 3: Update all imports**

Replace local type imports with `@extension/types`. Key changes:
- `import { JobData } from '../types'` -> `import type { JobData } from '@extension/types'`
- `import { JobData, AppliedStatusResult, PRDetectionResult, ISaveButtonManager, Platform } from './types'` -> `import type { JobData, AppliedStatusResult, PrDetectionResult, PlatformId } from '@extension/types'`
- Keep `ISaveButtonManager` interface locally in `save-button-manager/save-button-manager.ts` since it's implementation-specific

**Step 4: Apply naming fixes**

- `PRDetectionResult` -> `PrDetectionResult`
- Keep `isRPRequired` as the standardized field name
- `isApplied` -> `isAlreadyApplied` (in AppliedStatusResult)
- `CitizenshipRequirementResult` -> `PrRequirementResult`

**Step 5: Update descriptionAnalysis.ts**

Remove type definitions (lines 3-33), import from `@extension/types`:
```typescript
import type { WorkArrangementResult, EmploymentTypeResult, TechStackResult, ExperienceLevelResult, JobAnalysisResult, PrRequirementResult } from '@extension/types';
```
Keep all analysis logic functions.

**Step 6: Update hardcoded message strings**

Replace all `'AUTH_DETECTED'`, `'AUTH_CLEARED'`, `'EXTENSION_SIGN_OUT_COMMAND'`, etc. with `MessageType.X` enum values.

**Step 7: Verify**

Run: `pnpm type-check`
Expected: PASS

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor: migrate content scripts to @extension/types, fix naming"
```

---

### Task 10: Migrate Side Panel to `@extension/types`

**Files:**
- Modify: `pages/side-panel/package.json` — add `@extension/types` dependency
- Modify: `pages/side-panel/src/hooks/useJobJourneyState.ts` — remove inline types, import from `@extension/types`, remove polling
- Modify: `pages/side-panel/src/constants/index.ts` — remove type definitions, import from `@extension/types`
- Modify: `pages/side-panel/src/components/AuthSection.tsx` — remove inline AuthStatus, import
- Modify: `pages/side-panel/src/components/ResultsSection.tsx` — remove inline JobData/SearchResults, import
- Modify: `pages/side-panel/src/components/ProgressSection.tsx` — remove inline types, import
- Modify: `pages/side-panel/src/components/ToastManager.tsx` — use MessageType enum
- Delete: `pages/side-panel/src/utils/environment.ts` (will import from @extension/shared after Task 11)

**Step 1: Add dependency**

Add `"@extension/types": "workspace:*"` to `pages/side-panel/package.json` devDependencies.

Run: `pnpm install`

**Step 2: Update useJobJourneyState.ts**

- Remove inline `AuthStatus` (lines 3-15), `SearchProgress` (lines 17-38), `SearchResults` (lines 40-45), `SearchConfig` (lines 47-52)
- Add: `import type { AuthStatus, ScrapingProgress, SearchResults, SearchConfig } from '@extension/types';`
- Rename local `SearchProgress` usage to `ScrapingProgress`
- Replace hardcoded message strings with `MessageType` enum
- Remove the `setInterval(pollProgress, 2000)` polling logic — the `chrome.runtime.onMessage` listener already handles progress updates

**Step 3: Update constants/index.ts**

- Remove `CountryConfig` and `Platform` interface definitions
- Add: `import type { CountryConfig, Platform, PlatformId } from '@extension/types';`
- Keep the PLATFORMS and COUNTRIES data constants, but add missing fields to match the canonical Platform type (add `domains`, `color` fields)

**Step 4: Update component files**

Remove inline type definitions from AuthSection.tsx, ResultsSection.tsx, ProgressSection.tsx. Import from `@extension/types`. Fix `url` -> `jobUrl` in ResultsSection.tsx.

**Step 5: Update message strings**

Replace hardcoded strings with `MessageType` enum values across all side panel files.

**Step 6: Verify**

Run: `pnpm type-check`
Expected: PASS

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: migrate side panel to @extension/types, remove polling"
```

---

### Task 11: Consolidate Shared Utilities

**Files:**
- Modify: `packages/shared/package.json` — add `@extension/types` dependency if needed
- Create: `packages/shared/lib/utils/environment.ts` (merged version)
- Create: `packages/shared/lib/utils/pr-detection.ts` (comprehensive version)
- Move: `chrome-extension/src/background/utils/Logger.ts` -> `packages/shared/lib/utils/logger.ts`
- Modify: `packages/shared/lib/utils/index.ts` — add new exports
- Delete: `pages/side-panel/src/utils/environment.ts` (if not already deleted in Task 10)
- Delete: `chrome-extension/src/background/utils/environment.ts`
- Delete: `chrome-extension/src/background/utils/prDetection.ts`
- Delete: `pages/content/src/matches/jobsites/prDetection.ts`
- Modify: files that imported from old locations — update to `@extension/shared`

**Step 1: Read both environment.ts files and create merged version**

Read both files, take the comprehensive version, place in `packages/shared/lib/utils/environment.ts`. Keep all functions: `detectEnvironment()`, `getJobJourneyBaseUrl()`, `getJobMarketUrl()`, `getAuthUrl()`, `isDevelopment()`, `isProduction()`, `clearEnvironmentCache()`, `getEnvironmentInfo()`.

**Step 2: Read both prDetection.ts files and create merged version**

Use the content script version (259 lines, comprehensive with security clearance detection) as the base. Place in `packages/shared/lib/utils/pr-detection.ts`. Export all functions including `detectCitizenshipRequirements()` and the simpler `isPRRequired()`.

Update type references to use `PrRequirementResult` from `@extension/types`.

**Step 3: Move Logger**

Copy `chrome-extension/src/background/utils/Logger.ts` to `packages/shared/lib/utils/logger.ts`.

**Step 4: Update index.ts exports**

Add to `packages/shared/lib/utils/index.ts`:
```typescript
export * from './environment.js';
export * from './pr-detection.js';
export * from './logger.js';
```

**Step 5: Delete old files**

```bash
rm pages/side-panel/src/utils/environment.ts
rm chrome-extension/src/background/utils/environment.ts
rm chrome-extension/src/background/utils/prDetection.ts
rm pages/content/src/matches/jobsites/prDetection.ts
rm chrome-extension/src/background/utils/Logger.ts
```

**Step 6: Update all imports**

- Files importing `'../utils/environment'` -> `'@extension/shared'`
- Files importing `'../utils/prDetection'` or `'./prDetection'` -> `'@extension/shared'`
- Files importing `'../utils/Logger'` -> `'@extension/shared'`

Add `"@extension/shared": "workspace:*"` to devDependencies of packages that need it (if not already present).

**Step 7: Verify**

Run: `pnpm type-check`
Expected: PASS

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor: consolidate environment, pr-detection, and logger into @extension/shared"
```

---

### Task 12: Split ScrapingService into Focused Modules

**Files:**
- Create: `chrome-extension/src/background/services/scraping/SessionManager.ts`
- Create: `chrome-extension/src/background/services/scraping/WindowManager.ts`
- Create: `chrome-extension/src/background/services/scraping/TabSequencer.ts`
- Create: `chrome-extension/src/background/services/scraping/ProgressTracker.ts`
- Move+Modify: `chrome-extension/src/background/services/ScrapingService.ts` -> `chrome-extension/src/background/services/scraping/ScrapingService.ts`
- Modify: `chrome-extension/src/background/services/BackgroundService.ts` — update import path

**Step 1: Read the full ScrapingService.ts**

Read all 1900 lines to understand the full scope.

**Step 2: Create SessionManager.ts**

Extract session lifecycle management:
- `activeSessions` and `completedSessions` Maps
- `generateSessionId()`
- `startSession()`, `stopSession()`, `getSession()`, `completeSession()`
- Session status tracking

**Step 3: Create WindowManager.ts**

Extract Chrome window management:
- `sessionWindows` Map
- Window creation/cleanup logic
- `createWindow()`, `closeSessionWindows()`, `handleWindowClosure()`

**Step 4: Create TabSequencer.ts**

Extract tab management:
- `sessionTabs` Map
- `sessionTimeouts` Map
- Tab activation/sequencing logic
- `activateNextTab()`, `queueTab()`, `handleTabClosure()`
- Timeout management

**Step 5: Create ProgressTracker.ts**

Extract progress tracking:
- Platform progress state
- `updateProgress()`, `broadcastProgress()`, `getProgress()`
- EventManager integration for broadcasting

**Step 6: Slim down ScrapingService.ts**

Move to `scraping/ScrapingService.ts`. Keep as orchestrator that:
- Delegates session lifecycle to SessionManager
- Delegates window ops to WindowManager
- Delegates tab ops to TabSequencer
- Delegates progress to ProgressTracker
- Keeps `startJobSearch()` and `stopJobSearch()` as the main public API

**Step 7: Update BackgroundService.ts import**

```typescript
// Before
import { ScrapingService } from './ScrapingService';
// After
import { ScrapingService } from './scraping/ScrapingService';
```

**Step 8: Verify**

Run: `pnpm -F chrome-extension type-check`
Expected: PASS

**Step 9: Commit**

```bash
git add -A
git commit -m "refactor: split ScrapingService into SessionManager, WindowManager, TabSequencer, ProgressTracker"
```

---

### Task 13: Fix ApiService 401 Handling

**Files:**
- Modify: `chrome-extension/src/background/services/ApiService.ts` — remove `performLogoutWithFallback()`, emit event instead
- Modify: `chrome-extension/src/background/services/BackgroundService.ts` — add UNAUTHORIZED event listener

**Step 1: Read ApiService.ts fully**

Identify `performLogoutWithFallback()` method and all 401 handling code.

**Step 2: Update ApiService**

- Add EventManager as a dependency (if not already)
- Replace 401 handling:

```typescript
// Before
if (response.status === 401) {
  this.performLogoutWithFallback();
}

// After
if (response.status === 401) {
  this.eventManager.emit(EventType.UNAUTHORIZED, { reason: 'token_expired' });
}
```

- Remove `performLogoutWithFallback()` method entirely

**Step 3: Update BackgroundService**

Add listener in initialization:

```typescript
this.eventManager.on(EventType.UNAUTHORIZED, async (data) => {
  await this.authService.clearAuthData(true, 'token_expired');
  await this.tabManagerModule.handleSignOutUser();
});
```

**Step 4: Verify**

Run: `pnpm -F chrome-extension type-check`
Expected: PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move 401 logout handling from ApiService to BackgroundService via events"
```

---

### Task 14: Convert MessageHandlerModule to Map-Based Dispatch

**Files:**
- Modify: `chrome-extension/src/background/services/background/MessageHandlerModule.ts`

**Step 1: Read MessageHandlerModule.ts fully**

Identify the switch statement and all cases.

**Step 2: Convert to Map-based dispatch**

```typescript
private messageHandlers = new Map<MessageType, (data: any, sendResponse: Function) => Promise<void>>([
  [MessageType.GET_AUTH_STATUS, this.onGetAuthStatus.bind(this)],
  [MessageType.START_JOB_SEARCH, this.onStartJobSearch.bind(this)],
  [MessageType.STOP_SCRAPING, this.onStopScraping.bind(this)],
  [MessageType.AUTH_DETECTED, this.onAuthDetected.bind(this)],
  // ... all other handlers
]);

async handleMessage(message: ChromeMessage, sender: chrome.runtime.MessageSender, sendResponse: Function): Promise<boolean> {
  const handler = this.messageHandlers.get(message.type as MessageType);
  if (handler) {
    await handler(message.data, sendResponse);
    return true;
  }
  return false;
}
```

**Step 3: Verify**

Run: `pnpm -F chrome-extension type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: convert MessageHandlerModule to map-based dispatch"
```

---

### Task 15: Update Background Constants File

**Files:**
- Modify: `chrome-extension/src/background/constants/index.ts`

**Step 1: Clean up constants file**

- Remove type definitions that now live in `@extension/types` (CountryConfig, PlatformUrls, Platform interfaces)
- Remove `MESSAGE_TYPES` constant (now `MessageType` enum in `@extension/types`)
- Remove `STORAGE_KEYS` constant (now in `@extension/types/storage.ts`)
- Keep: `EXTENSION_NAME`, `VERSION`, `PLATFORMS` data, `COUNTRIES` data, `JOB_SUGGESTIONS`, `buildSearchUrl`, `TIMEOUT_CONFIG`, `SCRAPING_CONFIG`, `UI_STATES`
- Add imports from `@extension/types` for types used by the data constants
- Type the PLATFORMS record: `Record<PlatformId, Platform>`

**Step 2: Update all imports across background services**

Files that imported `MESSAGE_TYPES` or `STORAGE_KEYS` from `'../constants'` now import `MessageType`/`STORAGE_KEYS` from `'@extension/types'`.

**Step 3: Verify**

Run: `pnpm -F chrome-extension type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: clean up background constants, remove duplicated types and message constants"
```

---

### Task 16: Final Verification and Cleanup

**Files:**
- Possibly modify: any remaining files with type errors

**Step 1: Full type check**

Run: `pnpm type-check`
Expected: PASS across all packages

**Step 2: Lint check**

Run: `pnpm lint`
Fix any linting issues introduced by the refactoring.

**Step 3: Build check**

Run: `pnpm build`
Expected: Builds successfully

**Step 4: Verify no remaining duplicate types**

Run: `grep -rn "interface JobData" --include="*.ts" --include="*.tsx" pages/ chrome-extension/src/`
Expected: Only `packages/types/lib/job.ts` defines JobData

Run: `grep -rn "interface AuthStatus" --include="*.ts" --include="*.tsx" pages/ chrome-extension/src/`
Expected: Only `packages/types/lib/auth.ts` defines AuthStatus

Run: `grep -rn "interface Platform " --include="*.ts" --include="*.tsx" pages/ chrome-extension/src/`
Expected: Only `packages/types/lib/platform.ts` defines Platform

**Step 5: Verify no remaining hardcoded message strings**

Run: `grep -rn "'AUTH_DETECTED'\|'AUTH_CLEARED'\|'GET_AUTH_STATUS'\|'START_JOB_SEARCH'\|'STOP_SCRAPING'" --include="*.ts" --include="*.tsx" pages/ chrome-extension/src/`
Expected: No matches (all should use `MessageType.X`)

**Step 6: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final cleanup after restructure — fix lint and remaining type issues"
```

---

## Task Dependency Order

```
Task 1 (scaffold types pkg)
  └─> Task 2 (platform types)
  └─> Task 3 (job + analysis types)
  └─> Task 4 (auth + api + scraping types)
  └─> Task 5 (messages + storage + config types)

Task 6 (delete unused pages) — independent, can run anytime
Task 7 (delete dead content files) — independent, can run anytime

Task 5 done:
  └─> Task 8 (migrate background to @extension/types)
  └─> Task 9 (migrate content to @extension/types)
  └─> Task 10 (migrate side panel to @extension/types)

Task 8 done:
  └─> Task 11 (consolidate shared utils)
  └─> Task 12 (split ScrapingService)
  └─> Task 13 (fix ApiService 401)
  └─> Task 14 (convert MessageHandler)
  └─> Task 15 (clean up constants)

All tasks done:
  └─> Task 16 (final verification)
```

## Parallel Execution Opportunities

These groups can run in parallel:
- **Group A**: Tasks 2, 3, 4, 5 (all create independent type files)
- **Group B**: Tasks 6, 7 (delete dead code — independent of everything)
- **Group C**: Tasks 8, 9, 10 (migrate different modules — after types are done)
- **Group D**: Tasks 12, 13, 14, 15 (background refactors — after Task 8)
