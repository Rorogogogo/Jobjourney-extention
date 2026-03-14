# Standardize isRPRequired Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename the shared PR detection field from the legacy spelling to `isRPRequired` everywhere it still exists, without changing logic.

**Architecture:** Treat this as a narrow contract rename. Add a compiler-enforced regression for the shared utility and type surface, then update the shared types and utility return shape, and finally update direct consumers that still read the old property.

**Tech Stack:** TypeScript, pnpm, Turbo

---

### Task 1: Add regression coverage for the renamed field

**Files:**
- Create: `packages/shared/lib/utils/pr-detection.test-d.ts`

**Step 1: Write the failing test**

Create a type-level compiler check that requires `isRPRequired` and rejects the legacy field spelling on both `PrRequirementResult` and `detectCitizenshipRequirements`.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @extension/shared type-check`
Expected: FAIL because the shared type surface still exposes the legacy field spelling.

### Task 2: Rename the shared contract and direct consumers

**Files:**
- Modify: `packages/types/lib/analysis.ts`
- Modify: `packages/types/lib/job.ts`
- Modify: `packages/shared/lib/utils/pr-detection.ts`
- Modify: `pages/content/src/matches/jobsites/save-button-manager/save-button-manager.ts`

**Step 1: Write minimal implementation**

Rename the field in `PrRequirementResult`, remove the duplicate legacy field from `JobData`, update the shared utility to return/read `isRPRequired`, and update the content-script consumer to read `jobData.analysis.prDetection.isRPRequired`.

**Step 2: Run targeted verification**

Run: `pnpm --filter @extension/shared type-check`
Expected: PASS

### Task 3: Verify the workspace contract

**Files:**
- Verify only

**Step 1: Run full verification**

Run: `pnpm type-check`
Expected: PASS with no type errors.
