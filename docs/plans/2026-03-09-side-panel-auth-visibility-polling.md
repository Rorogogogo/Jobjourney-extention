# Side Panel Auth Visibility Polling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the side panel's 30-second auth polling interval with a visibility-based auth refresh while keeping the existing mount-time auth check and message listener behavior intact.

**Architecture:** Keep `checkAuthStatus` as the single auth refresh path. Update only the mount auth effect in the side panel hook so it performs one immediate auth check on mount, subscribes to `document.visibilitychange`, and re-checks auth only when the panel becomes visible again.

**Tech Stack:** React hooks, TypeScript, Chrome extension runtime messaging

---

### Task 1: Update the auth refresh effect

**Files:**
- Modify: `pages/side-panel/src/hooks/useJobJourneyState.ts:200-207`
- Test: `none (user requested no new test scaffolding; verify with type-check only)`

**Step 1: Confirm the current auth effect scope**

Read `pages/side-panel/src/hooks/useJobJourneyState.ts` and verify that:
- `checkAuthStatus()` is called on mount
- the current interval-based polling is isolated to the auth effect
- the runtime message listener effect is separate and must remain unchanged

**Step 2: Replace interval polling with visibility-based refresh**

Update the auth effect to:
- keep the initial `checkAuthStatus()` call
- define `handleVisibilityChange`
- call `checkAuthStatus()` only when `document.visibilityState === 'visible'`
- register the listener with `document.addEventListener('visibilitychange', handleVisibilityChange)`

**Step 3: Add matching cleanup**

Update the auth effect cleanup to:
- remove the `visibilitychange` listener
- not retain any interval setup or cleanup

**Step 4: Verify the package type-check**

Run:

```bash
pnpm -F @extension/sidepanel type-check
```

Expected:
- exit code `0`
- no TypeScript errors
