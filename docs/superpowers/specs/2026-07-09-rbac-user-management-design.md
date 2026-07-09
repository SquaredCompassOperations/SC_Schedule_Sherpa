# RBAC and User Management Design

## Objective

Build the backend foundation for two application access levels:

- `admin`: Squared Compass internal users.
- `client`: external client users.

Any authenticated user with an email ending in `@squaredcompass.com` must automatically receive admin access. Every other authenticated user must receive client access by default.

## Current State

The app already has a simple role model in Supabase:

- `public.app_role` currently contains `team` and `client`.
- `public.profiles` stores basic user profile fields.
- `public.user_roles` stores one or more roles per user.
- `public.handle_new_user()` creates the profile and role row after a Supabase Auth user is created.
- The frontend gates routes based on `role === "client"` versus everything else.

The current backend default role assignment is not strict enough for the target policy because it can use signup metadata to choose a role. Role assignment should come from trusted backend logic instead.

## Recommended Model

Rename the internal role from `team` to `admin` so the database, TypeScript types, and UI match the business language.

Final roles:

- `admin`
- `client`

Role assignment:

- If `lower(auth.users.email)` ends with `@squaredcompass.com`, assign `admin`.
- Otherwise assign `client`.
- Ignore user-supplied signup metadata for role assignment.
- Ensure each user has only one effective role.

## Database Changes

Add a new Supabase migration that:

1. Adds `admin` to `public.app_role`.
2. Migrates existing `team` role rows to `admin`.
3. Updates `public.handle_new_user()` so it assigns:
   - `admin` for `@squaredcompass.com`
   - `client` for all other emails
4. Removes `team` from the enum if the Postgres/Supabase migration path supports doing so safely.
5. Adds/updates policies so:
   - users can read their own profile and role,
   - admins can read all profiles and roles,
   - clients cannot read other users,
   - only trusted server-side code can write roles.

If enum removal is risky in the deployed database, keep the old enum value temporarily but stop using it in application code. The important security rule is that no new `team` rows are created.

## Application Changes

Update app code and generated Supabase types so:

- `AppRole` is `"admin" | "client"`.
- Route gating checks explicitly for admin/client.
- Admin users land in the workspace.
- Client users land in `/client`.
- Any unknown or missing role is treated as `client` in the UI, while the backend remains the source of truth.

## User Management Backend

Create admin-only server functions for the first user-management backend surface:

- `listUsers`: returns users with email, full name, company, role, created date, and last sign-in if available.
- `updateUserProfile`: allows admins to update profile fields such as full name and company.
- `setUserRole`: allows admins to change a user between `admin` and `client`, but should be used carefully because domain auto-assignment still governs new users.

Each server function must:

- require a valid Supabase session,
- verify the caller has `admin` role before using service-role access,
- never expose the service-role key to the browser,
- return plain, safe error messages.

## Security Rules

The security boundary is the database and server functions, not the frontend.

- Clients must never be able to grant themselves admin access.
- Signup metadata must not determine role.
- Role writes must happen through migrations, trusted database triggers, or admin-only server functions.
- Public tables must keep Row Level Security enabled.
- Service-role Supabase access must stay server-only.

## Testing Plan

Add tests around the role decision logic where possible:

- `rodney@squaredcompass.com` becomes `admin`.
- mixed-case Squared Compass emails still become `admin`.
- `person@example.com` becomes `client`.
- missing/null email becomes `client`.
- route logic sends admins to workspace and clients to `/client`.

Manual verification after deployment:

1. Sign in with a Squared Compass Google account and verify workspace access.
2. Sign in or create a non-Squared Compass test user and verify client portal access only.
3. Confirm Supabase `user_roles` rows show `admin` or `client`, not `team`.

## Rollout

1. Implement and test locally.
2. Apply the Supabase migration in the SQL editor or through Supabase CLI.
3. Deploy the app to Vercel.
4. Verify one admin account and one client account.
5. Remove or disable any temporary compatibility paths after production verification.

## References

- Supabase User Management: https://supabase.com/docs/guides/auth/managing-user-data
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Admin Users API: https://supabase.com/docs/reference/javascript/auth-admin-listusers

## Implementation Rollout Note

The implementation branch adds the SQL migration, role wiring, and admin-only user-management server functions. Production rollout requires applying `supabase/migrations/20260709224000_admin_client_rbac.sql` to Supabase before relying on `admin` roles in production.

The migration recomputes existing roles from `auth.users.email`, and new-user role assignment also derives from the authenticated email. Managed role updates derive the role from the target user's Supabase auth email and reject a conflicting requested role; legacy `team` assignments do not automatically become `admin`.
