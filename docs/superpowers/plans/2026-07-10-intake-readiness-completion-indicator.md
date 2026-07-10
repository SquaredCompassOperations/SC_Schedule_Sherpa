# Intake Readiness Completion Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Intake sidebar indicator green after the final Intake button is clicked when the shared readiness composite is at least 90%.

**Architecture:** Extract the current Readiness page scoring rules into `src/lib/intake-readiness.ts`. Use that helper from both `src/routes/readiness.tsx` and `src/routes/intake.tsx`, then update the sidebar dot function to prioritize module completion status.

**Tech Stack:** TypeScript, React, TanStack Router, Vitest, existing module status store.

## Global Constraints

- The final Intake button still navigates to `/readiness`.
- `/intake` is marked complete only when `calculateIntakeReadinessComposite(intake) >= 90`.
- Completion status makes the Intake sidebar dot green even on active Intake routes.
- Existing readiness category labels, weights, and details remain unchanged.

---

### Task 1: Shared Intake Readiness Helper

**Files:**

- Create: `src/lib/intake-readiness.test.ts`
- Create: `src/lib/intake-readiness.ts`
- Modify: `src/routes/readiness.tsx`

**Interfaces:**

- Produces: `buildIntakeReadinessCategories(intake: IntakeState): ReadinessCategory[]`
- Produces: `calculateIntakeReadinessComposite(intake: IntakeState): number`
- Produces: `isIntakeReadyForCompletion(intake: IntakeState): boolean`

- [ ] **Step 1: Write failing tests for complete, below-threshold, and exact-threshold composites.**
- [ ] **Step 2: Run `npm test -- src/lib/intake-readiness.test.ts` and verify it fails because the helper does not exist.**
- [ ] **Step 3: Extract the existing scoring logic from `src/routes/readiness.tsx` into `src/lib/intake-readiness.ts`.**
- [ ] **Step 4: Update `src/routes/readiness.tsx` to import the shared helper.**
- [ ] **Step 5: Run `npm test -- src/lib/intake-readiness.test.ts` and verify it passes.**

### Task 2: Finish Button And Sidebar Indicator

**Files:**

- Create: `src/components/app-sidebar.test.tsx`
- Modify: `src/routes/intake.tsx`
- Modify: `src/components/app-sidebar.tsx`

**Interfaces:**

- Consumes: `isIntakeReadyForCompletion(intake)`
- Consumes: `markModuleComplete("/intake")`
- Produces: green Intake sidebar dot when `/intake` status is complete.

- [ ] **Step 1: Write a failing sidebar dot class test that expects complete status to override active blue.**
- [ ] **Step 2: Run `npm test -- src/components/app-sidebar.test.tsx` and verify it fails.**
- [ ] **Step 3: Wire the Intake final button to mark `/intake` complete when the helper returns true.**
- [ ] **Step 4: Update sidebar dot logic to check module status overrides.**
- [ ] **Step 5: Run focused tests and verify they pass.**

### Task 3: Verification

**Files:**

- All changed files.

**Interfaces:**

- Produces: verified, build-ready checkout.

- [ ] **Step 1: Run `npm test`.**
- [ ] **Step 2: Run `npx tsc --noEmit`.**
- [ ] **Step 3: Run changed-file lint.**
- [ ] **Step 4: Run `npm run build`.**
- [ ] **Step 5: Commit the change.**
