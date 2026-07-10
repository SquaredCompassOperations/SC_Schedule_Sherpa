# Admin Client Preview Mode Design

## Goal

Admins need an effortless way to view the client portal before telling a client that an update is ready. This is a preview mode, not an impersonation feature and not a database role change.

## Decision

Build an admin-only client preview mode.

When an authenticated user has the `admin` role, the app shows a clear **Admin / Client Preview** switch. Choosing Client Preview routes the admin to `/client` and marks the experience as a preview. Choosing Admin routes the admin back to the main workspace.

Real client users keep the existing client portal experience. They do not see the Admin switch, cannot enter admin routes, and are still governed by Supabase RBAC.

## User Experience

- The admin workspace top bar shows a segmented **Admin / Client Preview** control.
- Selecting **Client Preview** sends the admin to `/client`.
- The client portal header detects admin users and labels the session as **Client Preview**.
- The client portal header gives admins a prominent **Return to Admin** action.
- The client portal may show a concise preview banner to remind admins that they are checking the client-facing view before sending updates.
- Client users see only client-facing labels and sign-out controls.

## Architecture

Add a small client-side preview helper in `src/lib/client-preview-mode.ts`. It owns:

- the preview mode type,
- the default mode for a route,
- the route target for switching modes,
- and whether a signed-in role can access the switch.

The UI uses this helper in:

- `src/components/top-bar.tsx` for the admin workspace switch,
- `src/routes/client.tsx` for the client portal preview label and return action.

The auth context and Supabase role rows stay unchanged.

## Data And Permissions

No database migrations are required.

`role === "admin"` remains the only authority for admin access. Client Preview must never write `user_roles`, alter a Supabase session, or store a fake role in local storage.

## Error Handling

If role data is missing or the user is a client, the switch is hidden. The existing route guard continues to redirect non-admin users away from admin routes.

## Testing

Add unit tests around the preview helper:

- admins can access preview switching,
- clients cannot access preview switching,
- admin mode routes to `/`,
- client preview mode routes to `/client`,
- `/client` defaults to client preview for admins,
- non-client routes default to admin mode for admins.

Run focused tests for the new helper, then run the full test suite and production build.

## Out Of Scope

- Selecting a specific client identity.
- True impersonation.
- Server-side audit logging.
- Workspace-specific client permission simulation.
- Any Supabase schema or RLS changes.
