# Solicitation-Driven Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add solicitation type selection, solicitation-driven documents, the new Automation workspace, an active client selector, and blank/source-driven Workspace panels.

**Architecture:** Keep the existing selected-offer, automation, document, message, and activity stores. Add small focused helpers for solicitation type behavior, solicitation packet-derived documents, and automation action state so UI files do not carry business rules.

**Tech Stack:** React, TanStack Router/Start, Supabase RPC, Vitest, local persistent stores.

## Global Constraints

- GSA MAS keeps MAS readiness and MAS document queue.
- Non-GSA MAS offers disable MAS readiness and replace MAS documents with uploaded solicitation packet documents.
- Workspace page must not show static demo registration/compliance/SIN values.
- Client Update must be client-visible on the client update/messages surface.
- All behavior changes are test-first.

---

### Task 1: Offer Type Selection

**Files:**

- Modify: `src/lib/offer-workspace.ts`
- Modify: `src/lib/offer-workspace.functions.ts`
- Modify: `src/components/workspace-board.tsx`
- Modify: `src/integrations/supabase/types.ts`
- Create: `supabase/migrations/20260713171500_offer_type_workspace_creation.sql`
- Test: `src/lib/offer-workspace.test.ts`
- Test: `src/lib/offer-workspace.functions.test.ts`

**Steps:**

- [ ] Add tests for the four user-facing labels and GSA MAS readiness capability.
- [ ] Add tests that `createOfferWorkspace` passes `p_offer_type`.
- [ ] Add UI dropdown state to New Offer.
- [ ] Update RPC input type and migration.
- [ ] Run targeted tests.

### Task 2: Solicitation Packet Documents

**Files:**

- Create: `src/lib/solicitation-store.ts`
- Test: `src/lib/solicitation-store.test.ts`
- Modify: `src/routes/documents.tsx`

**Steps:**

- [ ] Add tests for deriving packet document queue items from uploaded files.
- [ ] Add upload metadata store and helper functions.
- [ ] Switch Documents queue to MAS queue for GSA MAS and packet queue for non-GSA offers.
- [ ] Add upload panel for non-GSA offers.
- [ ] Run targeted tests.

### Task 3: Automation Workspace

**Files:**

- Create: `src/lib/automation-workspace.ts`
- Test: `src/lib/automation-workspace.test.ts`
- Modify: `src/routes/market-validation.tsx`

**Steps:**

- [ ] Add tests for action state and client update side effects.
- [ ] Rebuild the page around the four action cards.
- [ ] Preserve market validation run access.
- [ ] Add agent authorization letter action and source metadata.
- [ ] Add client update request composer.
- [ ] Run targeted tests.

### Task 4: Active Client Selector

**Files:**

- Modify: `src/components/app-sidebar.tsx`
- Test: `src/components/app-sidebar.test.tsx`

**Steps:**

- [ ] Add a testable helper for deriving selector options from workspace cards.
- [ ] Add bottom Active Client selector.
- [ ] Ensure selection uses existing `selectOffer`.
- [ ] Run sidebar tests.

### Task 5: Source-Driven Workspace Page

**Files:**

- Modify: `src/components/workspace-board.tsx`
- Test: add focused helper tests where practical.

**Steps:**

- [ ] Remove static registration/compliance/SIN demo data from Workspace panels.
- [ ] Render blank states when stores have no real data.
- [ ] Derive visible rows from intake, automation, docs, and selected offer.
- [ ] Run targeted tests and full verification.
