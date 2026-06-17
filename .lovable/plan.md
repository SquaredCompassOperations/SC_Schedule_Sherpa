## Overview

Ten changes touching the client portal, intake, document generator, review workflow, and activity log. Grouping into 4 work areas to keep edits coherent.

Before I start, two clarifying decisions I'd like to lock in (I'll proceed with the defaults shown unless you say otherwise in your approval message):

- **Item 1 — MAS Readiness placement:** Default = the client portal landing (`/client`) becomes the MAS Readiness Assessment. After submission, the existing dashboard (timeline + messages + doc status) appears. Alternative: keep it as a separate "Step 0" tile.
- **Item 8 — Sign-off authorization:** Default = any user listed as an Authorized Negotiator (extracted from SAM) sees Sign-off buttons in the review workflow; we match on the logged-in user's email. Sign-offs are recorded with name + timestamp in the review store and surface in the Activity Log.

---

## Work Area A — Client portal: MAS Readiness + Document Uploads (Items 1, 2)

**New: `src/lib/readiness-store.ts`**
- Persisted assessment state with all fields from the uploaded PDF (Pathways training, UEI, offering description, Category/SIN, Contract Admin contact, TAA, Section 889 use/provide, FASCSA, monitoring narratives, target agencies, price posture, annual sales, feedback request).
- `status: 'not_started' | 'in_progress' | 'complete'`, `savedAt`, `submittedAt`.

**Rebuild `src/routes/client.index.tsx`** as a stepped flow:
1. **MAS Readiness Assessment** — multi-section form mirroring the PDF, with **Save & Continue** per section.
2. **Corporate Document Upload** — file-uploader for the intake doc checklist (SAM profile, Pathways cert, financials, Pro Comp Plan, Uncomp OT Policy, Price List, Letters of Supply, etc.). Shows the *missing items* list pulled from `intake-store` requirements; each row = required label + upload control + status badge (Missing / Uploaded / Accepted).
3. **Submit for Intake & Readiness** button — disabled until readiness is `complete` AND every required corporate doc has at least one upload. Submission flips the engagement to "Intake submitted" and writes an activity-log entry.

The existing `/client/timeline` and `/client/messages` routes remain; add a tab/segmented control on `/client` for "Assessment", "Documents", "Status".

---

## Work Area B — SAM extraction + EPA ordering (Items 3, 4)

**Item 3 — Authorized Negotiators from SAM**
- Update `src/lib/sam-lookup.functions.ts` (and/or `intake-extract.functions.ts`) to parse `Government Business POC` from the SAM profile response and populate an `authorizedNegotiators: Array<{name, title, email, phone, isPrimary}>` field on the intake store.
- Show negotiators in the intake review UI; the list also feeds Work Area D (sign-off auth).

**Item 4 — EPA mechanism ordering**
- Reorder the EPA narrative prompt + UI checklists in `src/lib/narrative.functions.ts`, `src/lib/mock-data.ts`, and the relevant route(s) to render mechanisms in this exact sequence:
  1. GSAM 538.270-4(a)(1) — Fixed escalation rates
  2. GSAM 538.270-4(a)(2) — Market index or other basis
  3. GSAM 538.270-4(a)(3) — Established pricing (commercial price list/catalog/standard market pricing)
- Update labels to match the longer descriptions verbatim.

---

## Work Area C — Document Generator hand-off (Items 5, 6, 7)

**Item 5 — Intake uploads become "final" generated docs (with regenerate)**
- In `src/lib/doc-store.ts`, add a `source: 'generated' | 'client-upload'` field and a `sourceFileRef` (asset id from intake upload).
- When a client uploads a document during intake that maps to a generated artifact (Pro Comp Plan, Uncomp OT Policy, Letters of Supply, etc.), the corresponding doc record is automatically created with `status: 'final'` and `source: 'client-upload'`.
- Add a **"Regenerate from template"** action on each such doc — flips it back to `status: 'draft'` and runs the existing generation pipeline, preserving the original upload as a previous version.

**Item 6 — Ready-for-review alert**
- When a generated doc transitions to `status: 'ready_for_review'`, push a message into `src/routes/client.messages.tsx` ("[Doc name] is ready for your review") and surface a toast/banner on `/client` next visit. Hook into the existing doc-store event flow.

**Item 7 — Queue sync**
- Audit `src/routes/documents.tsx` to ensure all status badges (draft, generating, ready_for_review, final, needs_revision) reflect doc-store state in real time, including counts in any header/rollup. Add a `subscribe` pattern if not present so the queue re-renders on store mutations.

---

## Work Area D — Sign-off, Save & Continue, Activity Log (Items 8, 9, 10)

**Item 8 — Client sign-off in review workflow**
- Extend `src/lib/review-store.ts`: each gate item gains `signOff: { signedBy, signedAt, role } | null`.
- In `src/routes/review.tsx`, render a **"Sign off"** button next to each item *only* if the current logged-in user's email is in `intake.authorizedNegotiators` AND the item is in `ready_for_review`. Signed items lock and show signer name + timestamp.
- A gate is "complete" only when every item is signed off.

**Item 9 — Save & Continue everywhere + green status**
- Add a shared `<SaveAndContinue />` button component used in: intake, MAS readiness, pricing workbook, SCA, SIN, market validation, financials. On click: persist the module's state, mark its module status `complete`, navigate to the next module in the canonical sequence.
- The readiness rollup indicator (currently orange when "in progress") switches to green when module `status === 'complete'`. Verify `src/components/readiness-rollup.tsx` and `src/lib/readiness-rollup.ts` map all module statuses correctly.

**Item 10 — Activity log + review workflow sync**
- Centralize activity events in a new helper `src/lib/activity-log.ts` (or extend existing status-data). Every mutation in doc-store / review-store / intake-store / readiness-store / module stores emits `{actor, action, target, timestamp}`.
- `src/routes/status.activity.tsx` reads from this single source so updates always appear.
- Review workflow gates re-derive status from these events so completing a module immediately ticks the gate.

---

## Technical notes

- All new stores use the same persistence pattern as existing `src/lib/*-store.ts` (Zustand + `persist`, per `src/lib/persist.ts`).
- "Current logged-in user" comes from `src/lib/auth-context.tsx`. For sign-off matching, lowercase + trim emails on both sides.
- No schema/migration changes — all client-side state. Backend remains unchanged.
- The MAS Readiness form is long; I'll split it into 4 sections (Basics, Compliance, Market Fit, Commercial Practices) with Save & Continue between sections.

---

## Files touched (approx.)

- New: `src/lib/readiness-store.ts`, `src/lib/activity-log.ts`, `src/components/save-and-continue.tsx`, `src/routes/client.readiness.tsx` (or inline into `client.index.tsx`).
- Edited: `src/routes/client.tsx`, `src/routes/client.index.tsx`, `src/routes/intake.tsx`, `src/routes/documents.tsx`, `src/routes/review.tsx`, `src/routes/status.activity.tsx`, `src/routes/client.messages.tsx`, `src/lib/doc-store.ts`, `src/lib/review-store.ts`, `src/lib/intake-store.ts`, `src/lib/sam-lookup.functions.ts`, `src/lib/intake-extract.functions.ts`, `src/lib/narrative.functions.ts`, `src/lib/mock-data.ts`, `src/lib/readiness-rollup.ts`, `src/components/readiness-rollup.tsx`, and the pricing/SCA/SIN/market/financials route files to wire Save & Continue.

Approve and I'll implement straight through, or tell me which defaults to flip first.