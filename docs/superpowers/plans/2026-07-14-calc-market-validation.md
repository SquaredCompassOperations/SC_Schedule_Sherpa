# CALC Market Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a testing-branch CALC benchmark path to Market Validation.

**Architecture:** Add pure CALC helpers for URL/query construction, normalization, and pricing comparison. Add one server function that calls GSA CALC and returns existing market validation rows plus CALC-specific fields. Wire the page to run CALC from Step 2 and display the new fields.

**Tech Stack:** TypeScript, TanStack Start server functions, Vitest, GSA CALC public pricing endpoint.

## Global Constraints

- Keep the existing eLibrary / GSA Advantage market validation path available.
- Use the extracted price-list LCATs already stored in `automation.priceListLcats`.
- Use the GSA CALC ceiling rates endpoint: `https://buy.gsa.gov/pricing/api/v3/search/ceilingrates/`.
- Do not add new npm dependencies.

---

### Task 1: CALC Helpers

**Files:**
- Create: `src/lib/calc-pricing.ts`
- Test: `src/lib/calc-pricing.test.ts`

**Interfaces:**
- Produces: `buildCalcPricingUrl(input)`, `normalizeCalcPricingResponse(input)`, `compareClientPriceToCalc(input)`, and `buildCalcBenchmarkRows(input)`.

- [ ] **Step 1: Write failing tests**

Create tests for:
- a Technical Writer/Editor II query with SIN `541611`
- a CALC response with wage stats and hits
- the sample Squared Compass price list rows priced against CALC medians

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/calc-pricing.test.ts`

- [ ] **Step 3: Implement helper functions**

Add typed helpers with no network calls.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/calc-pricing.test.ts`

### Task 2: CALC Server Function

**Files:**
- Create: `src/lib/calc-pricing.functions.ts`
- Modify: `src/lib/automation-store.ts`

**Interfaces:**
- Consumes: CALC helpers from Task 1.
- Produces: `runCalcPricingBenchmark` server function.

- [ ] **Step 1: Write failing test where practical**

Use helper tests for most behavior; server function is a thin network wrapper.

- [ ] **Step 2: Implement server function**

Call CALC once per LCAT, continue on per-LCAT misses, save automation run output when available.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

### Task 3: Market Validation UI

**Files:**
- Modify: `src/routes/market-validation.tsx`

**Interfaces:**
- Consumes: `runCalcPricingBenchmark`.
- Produces: a CALC benchmark button and market rows table with CALC comparison fields.

- [ ] **Step 1: Wire page state**

Add `useServerFn(runCalcPricingBenchmark)` and call it from Step 2.

- [ ] **Step 2: Update labels and table**

Make CALC the visible benchmark in testing, show client price, CALC comparable price, median, min/max, and posture.

- [ ] **Step 3: Verify**

Run: `npm test`, `npx tsc --noEmit`, and `npm run build`.
