## Automation Engine — Build Plan

Per your answers: remove Compliance Matrix, full PDF parsing for Module 4, bundle templates with version check for Module 5, one-time JSON cache for SCA Directory.

### Sidebar restructure
Update `app-sidebar.tsx` + `mock-data.ts` to list under **Automation Engine**:
1. SIN Recommendation → `/sin`
2. SCA Matrix → `/sca` (new)
3. Documentation Generator → `/documents`
4. Market Validation → `/market-validation` (new)
5. Pricing Workbook → `/pricing-workbook` (new)

Remove `/compliance` route + file. Keep `/pricing` for now or fold into pricing-workbook (TBD — I'll fold it).

### Shared automation store
New `src/lib/automation-store.ts` (mirrors `intake-store.ts`, localStorage-persisted) holding:
- selected SINs (from Module 1)
- selected SCA LCATs (from Module 2)
- market validation rows (Module 4)
- pricing workbook selections (Module 5)

So each module reads upstream output without re-running.

### Module 1 — SIN Recommendation (refactor)
- Auto-load `businessWebsite` from intake-store; manual override input remains
- On "Save selected SINs", persist to automation-store
- No change to `sin-crawler.functions.ts` logic

### Module 2 — SCA Matrix (new)
**One-time ingest script** (`scripts/build-sca-occupations.ts`) — I'll run it once, commit `src/lib/sca-occupations.json` (~400 entries: code, title, definition).
**Server fn** `sca-suggest.functions.ts`: takes SINs + intake website summary → Gemini picks applicable LCATs from the cached JSON, returns matches with confidence + rationale.
**Route** `/sca`: button "Suggest LCATs from SINs" → table with checkboxes → "Save selected" persists to automation-store. Manual add/remove.

### Module 3 — Documentation Generator (upgrade)
Extend `narrative.functions.ts` to accept richer context: intake corporate fields + uploaded past-performance text + selected SCAs. Add new prompt key `"startup-springboard"`. Wire `/documents` route to pull intake/automation state into the context arg.

### Module 4 — Market Validation (new)
**Server fn** `market-validation.functions.ts`:
1. Firecrawl search GSA eLibrary for SIN
2. Take top 5 contractors with price-list links
3. For each: fetch price list PDF → extract tables → Gemini-vision normalizes to `{SIN, LCAT, UoI, Net Price w/ IFF}`
4. Return rows + source URLs
**Route** `/market-validation`: trigger button, progress states, results table, CSV export.

### Module 5 — Pricing Workbook (new)
**Bundle templates** in `/public/templates/`:
- `pricing-terms-r31.xlsx`
- `fcp-product-r31.xlsx`
- `fcp-services-plus-r31.xlsx`
**Version check fn** `gsa-template-version.functions.ts`: HEAD/GET the GSA URLs, parse refresh number from filename, compare to bundled `templates-manifest.json`, warn if newer.
**Install** `exceljs` for template-preserving fills.
**Server fn** `pricing-workbook.functions.ts`: takes intake data + selected SINs + LCATs + commercial price list (uploaded) → loads template → fills rows → returns base64 xlsx for download.
**Route** `/pricing-workbook`: Product vs Services Plus selector (auto-inferred), upload commercial price list, "Generate" → downloads filled xlsx. Surface version-check warning.

### Files
**Create**
- `src/lib/automation-store.ts`
- `src/lib/sca-occupations.json` (built once)
- `src/lib/sca-suggest.functions.ts`
- `src/lib/market-validation.functions.ts`
- `src/lib/pricing-workbook.functions.ts`
- `src/lib/gsa-template-version.functions.ts`
- `src/routes/sca.tsx`
- `src/routes/market-validation.tsx`
- `src/routes/pricing-workbook.tsx`
- `public/templates/*.xlsx` + `public/templates/manifest.json`
- `scripts/build-sca-occupations.ts` (dev-only)

**Edit**
- `src/components/app-sidebar.tsx`
- `src/lib/mock-data.ts`
- `src/lib/narrative.functions.ts`
- `src/routes/sin.tsx`
- `src/routes/documents.tsx`

**Delete**
- `src/routes/compliance.tsx`
- `src/routes/pricing.tsx` (folded into pricing-workbook)

### Scope notes / known limits
- Module 4 price-list PDF parsing is best-effort (~60-80% clean rows expected); UI surfaces "needs review" flags.
- Module 5 templates are locked GSA xlsx files; `exceljs` preserves structure but very heavy formatting tweaks may not round-trip 100%.
- Runtime per Module 4/5 run: 1-3 min; progress UI required.

### Out of scope this turn
- Background job queue (run inline with progress UI for now)
- Auth/per-user persistence (still localStorage)
- Auto-resubmit when GSA refreshes templates (warning only)

Approve and I'll implement in one pass.