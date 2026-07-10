# Task 2: Pure Offer Workspace Domain Helpers

## Status

DONE

## Implementation

Created the pure offer workspace domain helper module and its focused Vitest coverage:

- `src/lib/offer-workspace.ts`
- `src/lib/offer-workspace.test.ts`

The module consumes the generated Supabase `offers` and `organizations` row types and Task 1 enums. It provides:

- `OfferWorkspaceRow`, `OfferWorkspaceCard`, and filter types.
- Stable offer stage metadata and offer type labels.
- Supabase-row-to-card derivation, including SIN code extraction and prioritized next actions.
- Search, stage, and blocked-state filtering.
- SSR-safe selected-offer state helpers backed by `localStorage` in the browser and `useSyncExternalStore` for React consumers.

## RED/GREEN Verification

| Command | Result |
| --- | --- |
| `npm run test -- src/lib/offer-workspace.test.ts` before implementation | Failed as expected: `Cannot find module './offer-workspace'`. |
| `npm run test -- src/lib/offer-workspace.test.ts` after implementation | Passed: 1 file, 6 tests. |
| `npm run test` | Passed: 5 files, 25 tests. |
| `npx eslint src/lib/offer-workspace.ts src/lib/offer-workspace.test.ts` | Passed. |
| `npx tsc --noEmit` | Passed. |
| `git diff --check` | Passed. |

## Commit

- `fd2dcc6 Add offer workspace domain helpers`

## Self-Review

- Confirmed stage metadata values, type labels, card fields, and next-action priority match the task brief.
- Confirmed the selected-offer module initializes safely when `window` is unavailable.
- Confirmed the test fixture exercises the required GSA MAS label, review metadata, card derivation, blocked priority, filtering, and selection lifecycle.

## Concerns

None.

## Review Fixes

### What Changed

- Wrapped `localStorage.setItem` in `selectOffer` and `localStorage.removeItem` in `clearSelectedOffer` with `try/catch` so unavailable or denied storage cannot interrupt in-memory state updates or listener notifications.
- Added focused coverage for selection and clearing when both storage operations throw.

### Covering Test

| Command | Result |
| --- | --- |
| `npm run test -- src/lib/offer-workspace.test.ts` | Passed: 1 file, 7 tests. |

### Commit

- `0055876 Fix offer selection storage failures`
