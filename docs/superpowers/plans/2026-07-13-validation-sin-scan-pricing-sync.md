# Validation SIN Scan and Pricing Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Validation workspace start with a website-driven SIN scan and make uploaded/extracted price-list rows flow clearly into the Pricing Workbook.

**Architecture:** Reuse the existing Firecrawl/Gemini SIN crawler and price-list extraction state. Add small helpers for testable state mapping, then wire the Market Validation route and Pricing Workbook route to those helpers.

**Tech Stack:** React, TanStack Router/Start, Vitest, TypeScript, existing automation/intake stores.

## Global Constraints

- Keep edits scoped to Validation workspace, Pricing Workbook sync, and test helpers.
- Do not duplicate crawler/extractor implementations.
- Preserve existing Vercel build behavior and existing route names.

---

### Task 1: Validation Workspace SIN Scan State

**Files:**

- Create: `src/lib/validation-workspace.ts`
- Test: `src/lib/validation-workspace.test.ts`

**Interfaces:**

- Produces: `selectSinCandidatesForSave(candidates, selectedCodes)` and `recommendedSelectedCodes(candidates)`.

- [x] Write failing tests for candidate saving and default recommended selection.
- [x] Implement minimal helper functions.
- [x] Run `npm test -- src/lib/validation-workspace.test.ts`.

### Task 2: Pricing Workbook Row Sync

**Files:**

- Create: `src/lib/pricing-workbook-rows.ts`
- Test: `src/lib/pricing-workbook-rows.test.ts`
- Modify: `src/routes/pricing-workbook.tsx`

**Interfaces:**

- Produces: `buildPricingRowsFromAutomation(automation)` and `derivePricingKeywords(description)`.

- [x] Write failing tests that extracted price-list LCATs become workbook rows.
- [x] Move row-building logic out of the route and into the helper.
- [x] Add a “Sync from extracted price list” action to Pricing Workbook.
- [x] Run focused tests and type check.

### Task 3: Wire SIN Scan Into Validation Workspace

**Files:**

- Modify: `src/routes/market-validation.tsx`

**Interfaces:**

- Consumes: existing `crawlClientForSins`, `crawlPriceListFromSite`, `setSelectedSins`, `setPriceListLcats`.

- [x] Add Step 1 website SIN scan using the intake website as the default URL.
- [x] Show candidate rows, selected count, scan summary, and save selected SINs.
- [x] Keep Step 2 benchmark tied to saved SINs and extracted price-list LCATs.
- [x] Run full tests, type check, targeted lint, and production build.
