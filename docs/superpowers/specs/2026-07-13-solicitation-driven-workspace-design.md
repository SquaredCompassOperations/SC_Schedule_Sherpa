# Solicitation-Driven Workspace Design

Date: 2026-07-13

## Summary

Add solicitation type selection to New Offer, make non-GSA offers driven by uploaded solicitation packets, rebuild the Automation page around the four requested actions, add an active client selector to the sidebar, and remove static demo values from the Workspace page.

## Decisions

- New Offer exposes four user-facing solicitation types: GSA MAS, VA FSS, RFP/RFQ/RFI/RFB, and Other Solicitation Type.
- The database keeps the existing offer type enum. RFP/RFQ/RFI/RFB maps to `gwac_rfp`; Other maps to `custom_solicitation`.
- GSA MAS keeps MAS readiness and the MAS document queue.
- Any non-GSA MAS offer disables MAS readiness and uses uploaded solicitation documents/forms instead of the MAS document queue.
- Solicitation packet ingestion in this pass stores uploaded packet metadata and derives an initial custom document queue from filenames/forms. Deeper OCR/model extraction can improve those labels later.
- Workspace page panels must display blank/not-started states until real selected-offer or local workflow data exists.

## User Experience

### New Offer

The New Offer form adds a Solicitation Type Selection dropdown.

Choices:

- GSA MAS
- VA FSS
- RFP/RFQ/RFI/RFB
- Other Solicitation Type

When GSA MAS is selected, the form behaves like the current MAS workspace creation flow. When any other type is selected, the form shows a solicitation packet upload area after creation and communicates that MAS readiness is disabled.

### Solicitation Packet

For non-GSA MAS offers, the app allows solicitation document uploads. The uploaded packet replaces the MAS document queue in the Documents section. Documents derived from packet uploads are shown as solicitation-sourced items with draft/review/final states.

### Automation Workspace

The Automation page becomes an on-demand actions workspace with:

- Market Validation Scan
- Agent Authorization Letter
- Pricing Workbook Build
- Client Update

Each action has status, source/output detail, Open and Run controls where applicable, and a selected-action detail panel. Client Update lets an admin write a request to the client's main contact and logs it as client-visible activity.

### Active Client Selector

The left sidebar gains a bottom Active Client selector. Admins can switch the selected offer from any page. The selector uses the same offer list as the Workspace board and persists through the existing selected-offer store.

### Workspace Blank States

The Workspace page stops showing static demo readiness, compliance, SIN, and registration data. Panels render only real data from the selected offer and local workflow stores. If no data exists, the panel says what is waiting to be started.

## Data Flow

1. Admin creates an offer and selects solicitation type.
2. The selected type is passed through the `create_offer_workspace` RPC.
3. The selected offer context is persisted by the existing selected-offer store.
4. GSA MAS offers use existing MAS readiness/document behavior.
5. Non-GSA MAS offers use solicitation-packet state to populate the document queue.
6. Automation actions update automation state, document state, message state, and activity state where applicable.
7. Workspace panels read from actual offer/module state and show blank states when no matching data exists.

## Supabase Changes

Add a migration that updates `public.create_offer_workspace` to accept `p_offer_type public.offer_type DEFAULT 'gsa_mas'`. The function validates and stores the value, sets agency based on type, and preserves existing RLS/function grants.

No new table is required in this pass.

## Testing

Automated tests should cover:

- Offer type labels and MAS readiness capability.
- New Offer creation passes the selected offer type to Supabase.
- Non-GSA solicitation uploads replace the MAS document queue.
- Sidebar active-client options derive from real workspace cards.
- Automation client update pushes a client-visible message/activity.
- Workspace panels show blank states instead of static demo values when no data exists.

## Non-Goals

- Full model-based form extraction from every uploaded solicitation packet.
- Full VA FSS or RFP compliance logic.
- Replacing all local stores with Supabase-backed module tables.
- Filling dynamic PDF forms automatically.
