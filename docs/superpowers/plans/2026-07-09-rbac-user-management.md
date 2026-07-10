# RBAC User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend foundation for `admin` and `client` access, with `@squaredcompass.com` users automatically granted admin access and all other users defaulting to client access.

**Architecture:** Put role decision rules in a small shared TypeScript module and mirror the same trusted rule in a Supabase migration trigger. Keep route gating in the app, but make Supabase RLS and admin-only server functions the real backend boundary. User-management operations run only through TanStack server functions after checking the caller's `admin` role.

**Tech Stack:** Supabase Auth, Postgres/RLS migrations, TanStack React Start server functions, Supabase JS v2, TypeScript, Vitest.

## Global Constraints

- Final app roles are exactly `admin` and `client`.
- Any authenticated email ending in `@squaredcompass.com` receives `admin`.
- Every other authenticated email receives `client`.
- Signup metadata must not determine role.
- Clients must never be able to grant themselves admin access.
- Public tables keep Row Level Security enabled.
- Supabase service-role access stays server-only.
- No UI user-management page is included in this backend phase.

---

## File Structure

- Create `src/lib/rbac.ts`: shared app role constants, email-domain decision helper, and role normalizer.
- Create `src/lib/rbac.test.ts`: unit tests for role decision and normalization.
- Create `supabase/migrations/20260709224000_admin_client_rbac.sql`: database role migration, trusted signup trigger, RLS policy updates.
- Modify `src/integrations/supabase/types.ts`: generated-style app role enum update from `team | client` to `admin | client`.
- Modify `src/lib/auth-context.tsx`: consume shared `AppRole` and normalize database role rows.
- Modify `src/routes/__root.tsx`: route-gate explicitly on `admin` and `client`.
- Modify `src/routes/login.tsx`: send `admin` users to the admin workspace and `client` users to `/client`.
- Create `src/lib/user-management.ts`: pure helpers for admin checks, user row merging, and safe role input parsing.
- Create `src/lib/user-management.test.ts`: tests for user-management helpers.
- Create `src/lib/user-management.functions.ts`: admin-only TanStack server functions.
- No `src/routeTree.gen.ts` change is required unless a later task adds a route.

---

### Task 1: Shared Role Helpers

**Files:**
- Create: `src/lib/rbac.ts`
- Create: `src/lib/rbac.test.ts`

**Interfaces:**
- Produces: `type AppRole = "admin" | "client"`
- Produces: `roleForEmail(email: string | null | undefined): AppRole`
- Produces: `normalizeAppRole(role: unknown): AppRole`
- Produces: `isAdminRole(role: unknown): role is "admin"`
- Consumes: none

- [ ] **Step 1: Write failing role-helper tests**

Create `src/lib/rbac.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isAdminRole, normalizeAppRole, roleForEmail } from "./rbac";

describe("roleForEmail", () => {
  it("grants admin to squaredcompass.com emails", () => {
    expect(roleForEmail("rodney@squaredcompass.com")).toBe("admin");
  });

  it("treats mixed-case squaredcompass.com emails as admin", () => {
    expect(roleForEmail("Operations@SquaredCompass.com")).toBe("admin");
  });

  it("does not grant admin to lookalike domains", () => {
    expect(roleForEmail("person@squaredcompass.com.example")).toBe("client");
    expect(roleForEmail("person@example-squaredcompass.com")).toBe("client");
  });

  it("defaults external, empty, and missing emails to client", () => {
    expect(roleForEmail("client@example.com")).toBe("client");
    expect(roleForEmail("")).toBe("client");
    expect(roleForEmail(null)).toBe("client");
    expect(roleForEmail(undefined)).toBe("client");
  });
});

describe("normalizeAppRole", () => {
  it("preserves admin and client", () => {
    expect(normalizeAppRole("admin")).toBe("admin");
    expect(normalizeAppRole("client")).toBe("client");
  });

  it("treats legacy, unknown, and missing roles as client", () => {
    expect(normalizeAppRole("team")).toBe("client");
    expect(normalizeAppRole("owner")).toBe("client");
    expect(normalizeAppRole(null)).toBe("client");
  });
});

describe("isAdminRole", () => {
  it("only accepts admin", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("client")).toBe(false);
    expect(isAdminRole("team")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/rbac.test.ts`

Expected: FAIL because `src/lib/rbac.ts` does not exist.

- [ ] **Step 3: Add shared role helper implementation**

Create `src/lib/rbac.ts`:

```ts
export const ADMIN_EMAIL_DOMAIN = "@squaredcompass.com";

export type AppRole = "admin" | "client";

export function isAdminEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase().endsWith(ADMIN_EMAIL_DOMAIN);
}

export function roleForEmail(email: string | null | undefined): AppRole {
  return isAdminEmail(email) ? "admin" : "client";
}

export function normalizeAppRole(role: unknown): AppRole {
  return role === "admin" ? "admin" : "client";
}

export function isAdminRole(role: unknown): role is "admin" {
  return role === "admin";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/rbac.test.ts`

Expected: PASS with all `rbac.test.ts` tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rbac.ts src/lib/rbac.test.ts
git commit -m "Add shared RBAC role helpers"
```

---

### Task 2: Supabase RBAC Migration

**Files:**
- Create: `supabase/migrations/20260709224000_admin_client_rbac.sql`

**Interfaces:**
- Consumes: role names from Task 1: `admin`, `client`
- Produces: database enum `public.app_role` containing `admin`, `client`
- Produces: `public.role_for_email(text) -> public.app_role`
- Produces: `public.is_admin() -> boolean`
- Produces: one `public.user_roles` row per user

- [ ] **Step 1: Write migration SQL**

Create `supabase/migrations/20260709224000_admin_client_rbac.sql`:

```sql
BEGIN;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role);
DROP FUNCTION IF EXISTS public.role_for_email(TEXT);

-- Keep the highest-trust existing role per user before switching to one role per user.
WITH ranked_roles AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY
        CASE WHEN role::text = 'team' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS role_rank
  FROM public.user_roles
)
DELETE FROM public.user_roles ur
USING ranked_roles rr
WHERE ur.id = rr.id
  AND rr.role_rank > 1;

CREATE TYPE public.app_role_new AS ENUM ('admin', 'client');

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE public.app_role_new
  USING (
    CASE
      WHEN role::text = 'team' THEN 'admin'
      WHEN role::text = 'admin' THEN 'admin'
      ELSE 'client'
    END
  )::public.app_role_new;

DROP TYPE public.app_role;
ALTER TYPE public.app_role_new RENAME TO app_role;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

CREATE OR REPLACE FUNCTION public.role_for_email(_email TEXT)
RETURNS public.app_role
LANGUAGE SQL
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN right(lower(coalesce(_email, '')), length('@squaredcompass.com')) = '@squaredcompass.com'
        THEN 'admin'::public.app_role
      ELSE 'client'::public.app_role
    END
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, company)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'company', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    company = EXCLUDED.company;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, public.role_for_email(NEW.email))
  ON CONFLICT (user_id) DO UPDATE
  SET role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins update all profiles" ON public.profiles;

CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Admins view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Admins update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;

CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Admins view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.is_admin());

REVOKE EXECUTE ON FUNCTION public.role_for_email(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMIT;
```

- [ ] **Step 2: Run SQL syntax smoke check**

Run: `npx tsc --noEmit`

Expected: PASS. This command does not validate SQL, but it confirms no TypeScript files have been disturbed before app wiring begins.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260709224000_admin_client_rbac.sql
git commit -m "Add admin client RBAC migration"
```

---

### Task 3: App Role Wiring

**Files:**
- Modify: `src/integrations/supabase/types.ts`
- Modify: `src/lib/auth-context.tsx`
- Modify: `src/routes/__root.tsx`
- Modify: `src/routes/login.tsx`
- Test: `src/lib/rbac.test.ts`

**Interfaces:**
- Consumes: `AppRole`, `normalizeAppRole`, `isAdminRole` from `src/lib/rbac.ts`
- Produces: frontend role handling that recognizes `admin` and `client`

- [ ] **Step 1: Update generated-style Supabase role types**

Change `src/integrations/supabase/types.ts` enum entries:

```ts
Enums: {
  app_role: "admin" | "client"
}
```

Change constants at the bottom:

```ts
export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "client"],
    },
  },
} as const
```

- [ ] **Step 2: Update auth context role type and normalization**

In `src/lib/auth-context.tsx`, replace the local `AppRole` type with an import:

```ts
import { clearGoogleProviderTokens, persistGoogleProviderTokens } from "@/lib/google-auth";
import { normalizeAppRole, type AppRole } from "@/lib/rbac";
```

Remove:

```ts
export type AppRole = "team" | "client";
```

Change the role assignment in `loadProfile`:

```ts
setRole(normalizeAppRole(roleRow?.role));
```

- [ ] **Step 3: Update login redirect logic**

In `src/routes/login.tsx`, add:

```ts
import { isAdminRole } from "@/lib/rbac";
```

Replace:

```ts
navigate({ to: role === "client" ? "/client" : "/", replace: true });
```

With:

```ts
navigate({ to: isAdminRole(role) ? "/" : "/client", replace: true });
```

- [ ] **Step 4: Update root route gate**

In `src/routes/__root.tsx`, add:

```ts
import { isAdminRole } from "@/lib/rbac";
```

Inside `AuthGate`, add:

```ts
const isAdmin = isAdminRole(role);
```

Replace the client redirect condition with:

```ts
if (user && !isAdmin && !isClientRoute && !isPublic) {
  navigate({ to: "/client", replace: true });
}
```

Replace:

```ts
if (!user || (role === "client" && !isClientRoute)) return null;
```

With:

```ts
if (!user || (!isAdmin && !isClientRoute)) return null;
```

Leave this existing behavior in place so admins may still open client routes directly when needed:

```ts
if (isClientRoute && user) return <>{children}</>;
```

- [ ] **Step 5: Run targeted tests and typecheck**

Run: `npm test -- src/lib/rbac.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/integrations/supabase/types.ts src/lib/auth-context.tsx src/routes/__root.tsx src/routes/login.tsx
git commit -m "Wire app roles to admin and client"
```

---

### Task 4: Admin User-Management Backend

**Files:**
- Create: `src/lib/user-management.ts`
- Create: `src/lib/user-management.test.ts`
- Create: `src/lib/user-management.functions.ts`

**Interfaces:**
- Consumes: `AppRole`, `normalizeAppRole` from `src/lib/rbac.ts`
- Consumes: `requireSupabaseAuth` middleware from `src/integrations/supabase/auth-middleware.ts`
- Consumes: `supabaseAdmin` from `src/integrations/supabase/client.server.ts`
- Produces: `ManagedUser`
- Produces: `mergeUsersWithProfiles(authUsers, profiles, roles): ManagedUser[]`
- Produces: `listManagedUsers`
- Produces: `updateManagedUserProfile`
- Produces: `setManagedUserRole`

- [ ] **Step 1: Write failing helper tests**

Create `src/lib/user-management.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mergeUsersWithProfiles, parseManagedRole } from "./user-management";

describe("parseManagedRole", () => {
  it("accepts admin and client", () => {
    expect(parseManagedRole("admin")).toBe("admin");
    expect(parseManagedRole("client")).toBe("client");
  });

  it("rejects legacy and unknown roles", () => {
    expect(() => parseManagedRole("team")).toThrow("Invalid role");
    expect(() => parseManagedRole("owner")).toThrow("Invalid role");
  });
});

describe("mergeUsersWithProfiles", () => {
  it("combines auth users, profiles, and roles into stable admin records", () => {
    const users = mergeUsersWithProfiles(
      [
        {
          id: "admin-id",
          email: "ops@squaredcompass.com",
          created_at: "2026-07-09T01:00:00Z",
          last_sign_in_at: "2026-07-09T02:00:00Z",
        },
        {
          id: "client-id",
          email: "client@example.com",
          created_at: "2026-07-09T03:00:00Z",
          last_sign_in_at: null,
        },
      ],
      [
        { id: "admin-id", full_name: "Ops User", company: "Squared Compass" },
        { id: "client-id", full_name: "Client User", company: "Example LLC" },
      ],
      [
        { user_id: "admin-id", role: "admin" },
        { user_id: "client-id", role: "client" },
      ],
    );

    expect(users).toEqual([
      {
        id: "admin-id",
        email: "ops@squaredcompass.com",
        fullName: "Ops User",
        company: "Squared Compass",
        role: "admin",
        createdAt: "2026-07-09T01:00:00Z",
        lastSignInAt: "2026-07-09T02:00:00Z",
      },
      {
        id: "client-id",
        email: "client@example.com",
        fullName: "Client User",
        company: "Example LLC",
        role: "client",
        createdAt: "2026-07-09T03:00:00Z",
        lastSignInAt: null,
      },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/user-management.test.ts`

Expected: FAIL because `src/lib/user-management.ts` does not exist.

- [ ] **Step 3: Add user-management helper implementation**

Create `src/lib/user-management.ts`:

```ts
import { normalizeAppRole, type AppRole } from "./rbac";

export type AuthUserSummary = {
  id: string;
  email?: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
};

export type ProfileSummary = {
  id: string;
  full_name: string | null;
  company: string | null;
};

export type RoleSummary = {
  user_id: string;
  role: AppRole | string | null;
};

export type ManagedUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  company: string | null;
  role: AppRole;
  createdAt: string | null;
  lastSignInAt: string | null;
};

export function parseManagedRole(role: unknown): AppRole {
  if (role === "admin" || role === "client") return role;
  throw new Error("Invalid role");
}

export function mergeUsersWithProfiles(
  authUsers: AuthUserSummary[],
  profiles: ProfileSummary[],
  roles: RoleSummary[],
): ManagedUser[] {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const rolesByUserId = new Map(roles.map((role) => [role.user_id, role]));

  return authUsers.map((user) => {
    const profile = profilesById.get(user.id);
    const role = rolesByUserId.get(user.id);

    return {
      id: user.id,
      email: user.email ?? null,
      fullName: profile?.full_name ?? null,
      company: profile?.company ?? null,
      role: normalizeAppRole(role?.role),
      createdAt: user.created_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
    };
  });
}
```

- [ ] **Step 4: Run helper tests**

Run: `npm test -- src/lib/user-management.test.ts`

Expected: PASS.

- [ ] **Step 5: Add admin-only server functions**

Create `src/lib/user-management.functions.ts`:

```ts
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { mergeUsersWithProfiles, parseManagedRole, type ManagedUser } from "./user-management";

const UpdateProfileSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().max(200).nullable(),
  company: z.string().max(200).nullable(),
});

const SetRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.union([z.literal("admin"), z.literal("client")]),
});

async function requireAdmin(callerSupabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await callerSupabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) throw new Error("Could not verify admin access");
  if (!data) throw new Error("Forbidden: admin access required");
}

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await requireAdmin(context.supabase, context.userId);

    const [{ data: authData, error: authError }, { data: profiles, error: profileError }, { data: roles, error: roleError }] =
      await Promise.all([
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        supabaseAdmin.from("profiles").select("id, full_name, company"),
        supabaseAdmin.from("user_roles").select("user_id, role"),
      ]);

    if (authError) throw new Error("Could not load users");
    if (profileError) throw new Error("Could not load profiles");
    if (roleError) throw new Error("Could not load roles");

    return mergeUsersWithProfiles(authData.users, profiles ?? [], roles ?? []);
  });

export const updateManagedUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateProfileSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName,
        company: data.company,
      })
      .eq("id", data.userId);

    if (error) throw new Error("Could not update user profile");
    return { ok: true };
  });

export const setManagedUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetRoleSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const role = parseManagedRole(data.role);

    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role }, { onConflict: "user_id" });

    if (error) throw new Error("Could not update user role");
    return { ok: true };
  });
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test -- src/lib/user-management.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/user-management.ts src/lib/user-management.test.ts src/lib/user-management.functions.ts
git commit -m "Add admin user management backend"
```

---

### Task 5: Full Verification and Rollout Notes

**Files:**
- Modify: `docs/superpowers/specs/2026-07-09-rbac-user-management-design.md`

**Interfaces:**
- Consumes: all previous tasks
- Produces: verified branch ready for PR and SQL deployment

- [ ] **Step 1: Run focused tests**

Run: `npm test -- src/lib/rbac.test.ts src/lib/user-management.test.ts src/lib/google-auth.test.ts`

Expected: PASS for all three test files.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS. Vite may print chunk-size warnings; those are acceptable if the build exits with code 0.

- [ ] **Step 4: Add rollout note to spec**

Append this section to `docs/superpowers/specs/2026-07-09-rbac-user-management-design.md`:

```md
## Implementation Rollout Note

The implementation branch adds the SQL migration, role wiring, and admin-only user-management server functions. Production rollout requires applying `supabase/migrations/20260709224000_admin_client_rbac.sql` to Supabase before relying on `admin` roles in production.
```

- [ ] **Step 5: Commit verification note**

```bash
git add docs/superpowers/specs/2026-07-09-rbac-user-management-design.md
git commit -m "Document RBAC rollout note"
```

- [ ] **Step 6: Prepare final branch summary**

Run: `git log --oneline main..HEAD`

Expected: shows the design commit, plan commit, and task implementation commits.

Run: `git status -sb`

Expected: clean working tree on `rbac-user-management`.
