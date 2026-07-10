# Admin Client Preview Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins switch between the admin workspace and a clearly labeled client preview without changing their Supabase role.

**Architecture:** Add a small client-side preview helper, test it, then wire it into the existing top bar and client portal layout. The helper keeps routing and visibility decisions out of the React components.

**Tech Stack:** React 19, TanStack Router, TypeScript, Vitest, existing Tailwind utility classes.

## Global Constraints

- Do not change Supabase roles, migrations, or RLS for this feature.
- Client Preview is for admins only.
- Real client users must not see an Admin switch.
- Use existing route paths: `/` for Admin and `/client` for Client Preview.
- Keep copy concise and user-facing.

---

### Task 1: Preview Mode Helper

**Files:**
- Create: `src/lib/client-preview-mode.ts`
- Test: `src/lib/client-preview-mode.test.ts`

**Interfaces:**
- Consumes: `AppRole` from `src/lib/rbac.ts`
- Produces:
  - `type AdminViewMode = "admin" | "client-preview"`
  - `canUseClientPreview(role: AppRole | null | undefined): boolean`
  - `getAdminViewModeForPath(pathname: string): AdminViewMode`
  - `getAdminViewModeTarget(mode: AdminViewMode): "/" | "/client"`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  canUseClientPreview,
  getAdminViewModeForPath,
  getAdminViewModeTarget,
} from "./client-preview-mode";

describe("client preview mode", () => {
  it("allows only admins to use client preview switching", () => {
    expect(canUseClientPreview("admin")).toBe(true);
    expect(canUseClientPreview("client")).toBe(false);
    expect(canUseClientPreview(null)).toBe(false);
    expect(canUseClientPreview(undefined)).toBe(false);
  });

  it("routes mode switches to the correct shell", () => {
    expect(getAdminViewModeTarget("admin")).toBe("/");
    expect(getAdminViewModeTarget("client-preview")).toBe("/client");
  });

  it("derives admin mode from non-client paths", () => {
    expect(getAdminViewModeForPath("/")).toBe("admin");
    expect(getAdminViewModeForPath("/intake")).toBe("admin");
  });

  it("derives client preview mode from client paths", () => {
    expect(getAdminViewModeForPath("/client")).toBe("client-preview");
    expect(getAdminViewModeForPath("/client/documents")).toBe("client-preview");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/client-preview-mode.test.ts`

Expected: FAIL because `src/lib/client-preview-mode.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { AppRole } from "@/lib/rbac";

export type AdminViewMode = "admin" | "client-preview";

export function canUseClientPreview(role: AppRole | null | undefined) {
  return role === "admin";
}

export function getAdminViewModeForPath(pathname: string): AdminViewMode {
  if (pathname === "/client" || pathname.startsWith("/client/")) return "client-preview";
  return "admin";
}

export function getAdminViewModeTarget(mode: AdminViewMode): "/" | "/client" {
  return mode === "admin" ? "/" : "/client";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/client-preview-mode.test.ts`

Expected: PASS.

### Task 2: Wire Preview Switch Into The UI

**Files:**
- Modify: `src/components/top-bar.tsx`
- Modify: `src/routes/client.tsx`

**Interfaces:**
- Consumes: helper functions from `src/lib/client-preview-mode.ts`
- Produces: visible admin-only **Admin / Client Preview** switch and client portal return action.

- [ ] **Step 1: Update the admin top bar**

Replace the existing `Use Admin / Client` control with a mode-aware segmented control that links to `/` and `/client`.

- [ ] **Step 2: Update the client portal header**

For admin users, show `Client Preview` labeling, a short preview note, and a `Return to Admin` link. For client users, keep the existing client portal labeling and sign-out behavior.

- [ ] **Step 3: Run focused lint and tests**

Run: `npx eslint src/lib/client-preview-mode.ts src/lib/client-preview-mode.test.ts src/components/top-bar.tsx src/routes/client.tsx`

Run: `npm run test`

Expected: both commands exit 0.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: build exits 0. Existing chunk-size warnings are acceptable.

- [ ] **Step 5: Commit and push**

Commit message: `Add admin client preview mode`

Push `main` to GitHub so Vercel can deploy.
