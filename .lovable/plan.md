## Status Tracker — Build Plan

A new sidebar section at the top of the workspace plus a separate client-facing portal, gated by login. Team members see full tooling; clients see a clean status-only view of their own offer.

### Sidebar restructure (internal)
Add a new group **"Status Tracker"** above Intake & Readiness in `app-sidebar.tsx` + `mock-data.ts`:
1. Overview → `/status` (timeline + stage + composite readiness)
2. Milestones → `/status/milestones` (key dates: kickoff, SIN lock, doc review, submission)
3. Open Items → `/status/open-items` (blockers/action items, who-owns-it)
4. Activity Log → `/status/activity` (append-only event feed)

Reuses existing `useReadinessRollup()` for composite score + per-module breakdown. Pulls intake/automation/doc state from existing stores. No new business logic — it's a view layer on what's already tracked.

### Client-facing portal
Separate route tree `/client/*` rendered WITHOUT the internal sidebar:
- `/client` → branded status dashboard (company name, stage, % complete, current focus, next milestone, ETA)
- `/client/timeline` → read-only milestone view
- `/client/messages` → activity feed filtered to client-visible items only

Layout uses its own minimal shell (no left sidebar, no "Export eOffer" button, no module navigation). Header shows company name + sign-out.

### Auth + roles
**Email/password + Google sign-in** via Lovable Cloud.
- New `/login` route (email/password form + Google button)
- New `/signup` route (only team members can self-signup initially; clients are invited by team — for v1 we allow both to self-signup and assign role manually via DB)
- New tables:
  - `profiles` (id → auth.users, full_name, company, created_at)
  - `app_role` enum: `team`, `client`
  - `user_roles` (user_id, role) — separate table per security rules
  - `has_role()` security-definer function
- `/login` redirects:
  - `team` role → `/` (existing workspace)
  - `client` role → `/client`
- Route guards via `_authenticated` pathless layout for `/` (team-only) and `_client` layout for `/client` (client OR team).
- Sign-out button in `top-bar.tsx`.

### Tying client → offer
For v1 a single demo offer exists (the `CLIENT` constant). The client-facing view reads from the same intake-store / readiness rollup. When real multi-tenancy lands later, we'll add an `offers` table with `client_user_id`.

### Files

**Create**
- `src/routes/_authenticated.tsx` — team-only layout (wraps existing `/`, `/sin`, `/sca`, `/documents`, `/market-validation`, `/pricing-workbook`, `/intake`, `/review`, `/export`, `/readiness`)
- `src/routes/_client.tsx` — client layout (no sidebar, branded shell)
- `src/routes/login.tsx`
- `src/routes/signup.tsx`
- `src/routes/status.tsx` (layout w/ tabs) + `status.index.tsx`, `status.milestones.tsx`, `status.open-items.tsx`, `status.activity.tsx`
- `src/routes/_client/index.tsx`, `_client/timeline.tsx`, `_client/messages.tsx`
- `src/lib/status-data.ts` — derives milestones/open items/activity from existing stores + readiness rollup
- `src/lib/auth-context.tsx` — auth provider hook (`useAuth()` returning session, role, signOut)
- Supabase migration: `profiles`, `app_role` enum, `user_roles`, `has_role()`, trigger to auto-create profile on signup, RLS + GRANTs

**Edit**
- `src/lib/mock-data.ts` — add `Status` group, add `/status` items
- `src/components/app-sidebar.tsx` — render new group first
- `src/components/top-bar.tsx` — show signed-in user + sign-out
- `src/routes/__root.tsx` — wrap with auth provider; `onAuthStateChange` cache invalidation
- All existing routes move under `_authenticated/` (folder restructure) OR we add the guard at root layout level — I'll add guard at root for simplicity, redirecting unauth users to `/login`, and clients away from team routes
- `src/start.ts` — confirm `attachSupabaseAuth` is wired

**Migration**
```sql
create type public.app_role as enum ('team', 'client');
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, company text, created_at timestamptz default now());
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, role app_role not null, unique(user_id, role));
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
-- GRANTs + RLS + auto-profile trigger included per platform rules
```

### Scope notes
- Existing localStorage stores (intake, automation, doc) stay client-side for v1 — Status Tracker reads them. Server-side persistence per-user is a follow-up.
- Client role can sign up freely in v1; promotion to `team` requires DB edit (or you tell me to add an admin-invite flow).
- Auto-confirm email is OFF by default (users verify via email) — say if you want it on for demo speed.
- Google sign-in enabled via `configure_social_auth`.

### Out of scope this turn
- Multi-tenant offers table (single demo client for now)
- In-app messaging client↔team
- Email notifications to client on status change

Approve and I'll build it in one pass.
