## Goal

Restructure the platform into the three top-level sections from the spec, and rebuild the **Intake & Readiness** section to match Module 1 (Client Intake) and Module 2 (Readiness Assessment) exactly. Other sections (Automation Engine, Finalization) become placeholders we'll fill in subsequent turns.

## 1. Top-level navigation

Collapse the current sidebar into three sections:

- **Intake & Readiness** → Client Intake, Readiness Assessment
- **Automation Engine** → (placeholder children — SIN Engine, Document Generator, Pricing, Compliance Matrix from existing routes, regrouped; no behavior changes yet)
- **Finalization** → (placeholder — Review, eOffer Export from existing routes, regrouped)

Update `src/components/app-sidebar.tsx` to render three collapsible groups with these children. Keep existing routes mounted so nothing 404s; we'll refine each in later turns.

## 2. Client Intake (Module 1) — rebuild

Replace the current 8-step intake with **4 steps**, exactly as specified:

**Step 1 — Corporate Information** (driven by SAM.gov profile upload)
- Company Details: UEI, Type of Organization, Common Parent UEI, Company Name, DBA, EIN, Business Type(s) registered in SAM, SAM Expiration Date, Business Website, Primary NAICS, Years in Business (derived from Entity Start Date)
- Company Address: Street1, Street2, City, State, Zip, Country
- Mailing Address: Street1, Street2, City, State, Zip, Country (with "same as company address" toggle)
- "Upload SAM.gov profile" extractor at the top auto-fills these fields (extends current `extractBusinessIdentity` schema to cover the new fields). Drive picker stays.

**Step 2 — Corporate Documents**
- Checkbox list with file upload per item:
  - Professional/Employee Compensation Plan
  - Uncompensated Overtime Policy
  - Quality Control documentation
  - P&L Statements: Year 1, Year 2
  - Balance Sheets: Year 1, Year 2
  - Past Performance (Capability Statements, Case Studies, References, Project Experience)
- Each row: checkbox (auto-checks when file uploaded), label, upload button, filename display.

**Step 3 — Authorized Negotiators**
- Up to 4 negotiators, first = Primary (badge).
- Per negotiator: Name, Title, US Phone (XXX-XXX-XXXX) **or** International Phone, Email, US Fax or International Fax, Role (Authorized to Sign checkbox).
- Validation: phone OR international phone required.

**Step 4 — Socioeconomic Status**
- Button "Scan SBA Small Business Search" → calls a new server fn that takes the UEI from Step 1 and fetches `https://search.certifications.sba.gov/` to parse active SBA certifications.
- Display detected active certifications (8(a), WOSB, SDVOSB, HUBZone, etc.) with source date.
- Manual override list as fallback.

## 3. Readiness Assessment (Module 2) — rebuild

New route `/readiness` (replaces current one). Computes a live scorecard from intake state:

- Corporate information completeness (% of required fields filled)
- Authorized negotiators completeness (≥1 with all required fields)
- Past performance uploaded (yes/no + count)
- Financial documents:
  - Both P&L years uploaded? If yes, parse via Gemini to detect a net loss → if loss, surface a "Request explanation from Primary Negotiator" action (drafts an email; mailto link for now, no SMTP).
  - Both balance sheet years uploaded?
- Corporate policy documents: Compensation Plan, UOT Policy, QC documentation — each yes/no.

Each category shows status (Complete / Partial / Missing) with a level-of-effort estimate, and a rollup readiness % at the top.

## 4. State plumbing

Intake state currently lives in component-local `useState` in `intake.tsx`. To let Readiness consume it without backend churn, lift it into a small shared store (`src/lib/intake-store.ts`, same `useSyncExternalStore` pattern as `doc-store.ts`). Holds: corporate fields, address, mailing address, uploaded doc map (key → File metadata + checked), negotiators array, socio certifications.

## 5. Out of scope this turn

- Automation Engine and Finalization sections only get re-grouped in the sidebar; their internal pages are untouched.
- No new Supabase tables — intake state stays in-memory for now (matches current behavior).
- SBA scraper is best-effort HTML parse; will return empty list gracefully if the page structure changes.

## Files

**Edit**
- `src/components/app-sidebar.tsx` — three-section nav
- `src/routes/intake.tsx` — full rebuild (4 steps)
- `src/routes/readiness.tsx` — full rebuild (Module 2 scorecard)
- `src/lib/intake-extract.functions.ts` — extend extraction schema (org type, parent UEI, DBA, biz types, website, entity start date, addresses)

**Create**
- `src/lib/intake-store.ts` — shared intake state
- `src/lib/sba-lookup.functions.ts` — SBA Small Business Search scraper (UEI → certs)
- `src/lib/financials-check.functions.ts` — Gemini P&L loss detection

After you approve, I'll implement.
