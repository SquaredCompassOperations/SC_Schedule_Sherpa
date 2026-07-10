# Phase 1 Automation Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Supabase-backed audit layer for SBA status, market validation, SCA matching, and pricing workbook automation runs.

**Architecture:** Existing crawler and workbook server functions remain the execution layer. A new automation run model records each run, metrics, source URLs, and module-specific outputs against an `offer_id`, with admin-controlled visibility for client-facing review later.

**Tech Stack:** TanStack Start server functions, React, Supabase Postgres/RLS, `@supabase/supabase-js`, Vitest, existing Firecrawl and Lovable AI gateway integrations.

## Global Constraints

- Keep automation evidence offer-scoped through `public.offers`.
- Use RLS on every new public table.
- Admins can insert/update automation results; clients can only read rows marked `client_visible`.
- Do not expose service-role keys in browser code.
- Keep the existing local automation store as a fast draft/workbench layer.
- Do not replace the existing crawler functions in this phase.
- Supabase CLI is not installed in this workspace, so create the migration with the repo's timestamped migration convention.

---

### Task 1: Automation Run Schema

**Files:**

- Create: `supabase/migrations/20260710150000_phase1_automation_backend.sql`
- Modify: `src/integrations/supabase/types.ts`

**Interfaces:**

- Produces table `automation_runs` keyed by `id`, scoped to `offer_id`.
- Produces module result tables: `sba_certification_results`, `market_validation_results`, `sca_lcat_matches`, `pricing_workbook_outputs`.
- Produces enum types `automation_module` and `automation_run_status`.

- [ ] **Step 1: Write the migration**

Create tables with this shape:

```sql
CREATE TYPE public.automation_module AS ENUM (
  'sba_status',
  'market_validation',
  'sca_lcat_confirmation',
  'pricing_workbook'
);

CREATE TYPE public.automation_run_status AS ENUM (
  'running',
  'completed',
  'failed',
  'needs_review'
);

CREATE TABLE public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  module public.automation_module NOT NULL,
  status public.automation_run_status NOT NULL DEFAULT 'running',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  error_message TEXT,
  client_visible BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Add module result tables with `run_id`, `offer_id`, source fields, confidence/review fields, and indexes on `offer_id` and `run_id`.

- [ ] **Step 2: Add RLS and grants**

Use policies:

```sql
CREATE POLICY "Admins view automation runs"
  ON public.automation_runs FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Clients view released automation runs"
  ON public.automation_runs FOR SELECT
  TO authenticated
  USING (client_visible AND public.is_offer_member(offer_id));

CREATE POLICY "Admins insert automation runs"
  ON public.automation_runs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update automation runs"
  ON public.automation_runs FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
```

Repeat equivalent policies for the result tables.

- [ ] **Step 3: Update Supabase types**

Add new table and enum definitions to `src/integrations/supabase/types.ts` so TypeScript can compile locally without remote type generation.

### Task 2: Automation Run Helper

**Files:**

- Create: `src/lib/automation-runs.test.ts`
- Create: `src/lib/automation-runs.ts`

**Interfaces:**

- Consumes `supabaseAdmin` by default for server-side writes.
- Produces `startAutomationRun(input, client?)`, `completeAutomationRun(input, client?)`, `failAutomationRun(input, client?)`, and result persistence helpers.

- [ ] **Step 1: Write failing tests**

```ts
it("starts an offer-scoped automation run with normalized inputs", async () => {
  const client = createMockAutomationClient();
  const run = await startAutomationRun(
    {
      offerId: "offer-1",
      module: "market_validation",
      input: { sin: "561320", lcats: ["Program Manager"] },
      sourceUrls: ["https://www.gsaelibrary.gsa.gov/"],
    },
    client,
  );

  expect(run.id).toBe("run-1");
  expect(client.inserts.automation_runs[0]).toMatchObject({
    offer_id: "offer-1",
    module: "market_validation",
    status: "running",
    source_urls: ["https://www.gsaelibrary.gsa.gov/"],
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/lib/automation-runs.test.ts`

Expected: FAIL because `automation-runs.ts` does not exist.

- [ ] **Step 3: Implement minimal helper**

Implement thin insert/update wrappers around Supabase table writes. Use dependency injection so tests do not require real Supabase env vars.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/lib/automation-runs.test.ts`

Expected: PASS.

### Task 3: Wire Existing Automations To Runs

**Files:**

- Modify: `src/lib/sba-lookup.functions.ts`
- Modify: `src/lib/market-validation.functions.ts`
- Modify: `src/lib/sca-suggest.functions.ts`
- Modify: `src/lib/pricing-workbook.functions.ts`

**Interfaces:**

- Accept optional `offerId` in existing server function inputs.
- When `offerId` is present, start a run, persist module output rows, and mark complete/failed.
- When `offerId` is missing, preserve current behavior.

- [ ] **Step 1: Add failing tests at helper level for each result mapper**

Test `saveSbaCertificationResults`, `saveMarketValidationResults`, `saveScaLcatMatches`, and `savePricingWorkbookOutput`.

- [ ] **Step 2: Implement persistence calls in existing server functions**

Wrap each run:

```ts
const run = data.offerId ? await startAutomationRun(...) : null;
try {
  const result = await existingWork();
  if (run) await completeAutomationRun(...);
  return result;
} catch (e) {
  if (run) await failAutomationRun(...);
  throw e;
}
```

- [ ] **Step 3: Keep no-offer flows unchanged**

Run existing focused tests for market, SCA, workbook helper coverage.

### Task 4: Admin Visibility In The Automation UI

**Files:**

- Modify: `src/routes/market-validation.tsx`
- Modify: `src/routes/sca.tsx`
- Modify: `src/routes/pricing-workbook.tsx`
- Modify: `src/routes/intake.tsx`

**Interfaces:**

- Consumes `getSelectedOfferId()` or `useSelectedOfferId()`.
- Passes `offerId` into server functions when a workspace is selected.
- Shows run counts/notes from the existing function response first; fuller history UI can follow.

- [ ] **Step 1: Pass selected offer ID into server functions**

Use:

```ts
const selectedOfferId = useSelectedOfferId();
```

Include `offerId: selectedOfferId ?? undefined` in each server call.

- [ ] **Step 2: Keep users unblocked without a selected workspace**

If no workspace is selected, continue using local storage and show no blocking error.

- [ ] **Step 3: Add compact run messaging**

Show existing notes and last-run status, using the current page layout.

### Task 5: Verification And Commit

**Files:**

- All changed files.

**Interfaces:**

- Produces a clean local commit on `main`.

- [ ] **Step 1: Run focused tests**

Run: `npm test -- src/lib/automation-runs.test.ts`

- [ ] **Step 2: Run full tests**

Run: `npm test`

- [ ] **Step 3: Run build**

Run: `npm run build`

- [ ] **Step 4: Review diff**

Run: `git diff --stat` and `git diff --check`.

- [ ] **Step 5: Commit**

Run:

```bash
git add docs/superpowers/plans/2026-07-10-phase-1-automation-backend.md supabase/migrations/20260710150000_phase1_automation_backend.sql src
git commit -m "Add phase 1 automation backend"
```

## Self-Review

- Spec coverage: SBA status, market validation, SCA matching, and pricing workbook outputs each have a run/result table and helper pathway.
- Placeholder scan: no TBD/TODO placeholders in tasks.
- Type consistency: module enum names match helper inputs and table values.
