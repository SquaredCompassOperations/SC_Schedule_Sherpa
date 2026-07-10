# Intake Readiness Completion Indicator Design

## Goal

When an admin finishes the Intake workflow and chooses **Finish & Go to Readiness**, the sidebar indicator next to Intake should turn green if the Intake-derived readiness composite is at least 90%.

## Scope

- Reuse one shared readiness calculation for the Intake page and the Readiness page.
- Mark `/intake` complete only when the last Intake button is clicked and the shared composite is `>= 90`.
- Make the sidebar dot show green for completed workflow items, even when the item is currently active.
- Keep the existing navigation target: after clicking the final Intake button, go to `/readiness`.

## Design

Create `src/lib/intake-readiness.ts` as the pure home for Intake readiness category and composite scoring. Move the existing category scoring rules from `src/routes/readiness.tsx` into this helper so the page display and completion gate use the same logic.

The final button in `src/routes/intake.tsx` calls `isIntakeReadyForCompletion(intake)` before navigating. If true, it calls `markModuleComplete("/intake")`; otherwise it only navigates to readiness.

`src/components/app-sidebar.tsx` reads module status overrides and gives `"complete"` status precedence over the active route color. This makes Intake stay green on `/readiness` after it has been completed.

## Testing

- Unit-test the readiness helper for complete, below-threshold, and exact-threshold cases.
- Unit-test sidebar dot class behavior so complete status overrides active blue.
- Run full tests, type-checking, changed-file lint, and production build.
