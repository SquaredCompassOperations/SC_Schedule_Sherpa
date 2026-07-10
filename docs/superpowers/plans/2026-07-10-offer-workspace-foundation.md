# Offer Workspace Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Supabase-backed offer workspace foundation, admin workspace board, selected workspace shell, and assigned-client workspace entry point for the Offer Automation Workspace rebuild.

**Architecture:** Add offer workspace tables and RLS first, then create focused TypeScript domain helpers and Supabase access functions. The UI reads workspace cards from Supabase, stores only the selected offer ID locally, and leaves existing workflow modules in place until follow-up plans migrate them one at a time.

**Tech Stack:** Supabase/Postgres, Supabase RLS, TanStack Router, TanStack Query, React 19, TypeScript, Vitest, Tailwind CSS, lucide-react.

## Global Constraints

- First fully supported workflow is `gsa_mas`.
- Offer type shape must allow later expansion to `va_fss`, `gwac_rfp`, and `custom_solicitation`.
- Squared Compass emails ending in `@squaredcompass.com` keep automatic `admin` access.
- Admin users can see and manage all workspaces.
- Client users can see only workspaces where they are active members or invited by matching email.
- Supabase is the source of truth for organizations, offers, memberships, and workspace activity.
- Local storage may store only the selected offer ID and temporary unsaved UI state.
- Product-facing copy should use `Offer Automation Workspace`, not `ScheduleBuilder`.
- Do not migrate intake, readiness, automation, documents, pricing, review, export, or submission state in this plan.

---

## Scope Check

The approved spec covers the full product rebuild. This plan intentionally implements only the first independently shippable slice:

1. Supabase workspace schema and access rules.
2. Type-safe workspace card/status derivation.
3. Supabase read/create helpers.
4. Admin workspace board.
5. Selected workspace shell and client assigned-workspace entry.

Follow-up plans should migrate one workflow module at a time into offer-scoped Supabase state.

## File Structure

- `supabase/migrations/20260710090000_offer_workspace_foundation.sql`: creates offer workspace enums, tables, helper functions, grants, triggers, and RLS policies.
- `src/integrations/supabase/types.ts`: generated-style TypeScript table and enum definitions for the new schema.
- `src/lib/offer-workspace.ts`: pure domain types, stage metadata, card derivation, filter helpers, and selected-offer utilities.
- `src/lib/offer-workspace.test.ts`: Vitest coverage for domain helpers.
- `src/lib/offer-workspace.functions.ts`: Supabase access functions for listing, reading, creating, and selecting workspace records.
- `src/lib/offer-workspace.functions.test.ts`: Vitest coverage for query composition and error handling using focused fake Supabase clients.
- `src/components/workspace-board.tsx`: admin board UI grouped by stage with filters and next-action cards.
- `src/components/selected-workspace-banner.tsx`: compact selected workspace summary for the app shell.
- `src/routes/index.tsx`: admin landing route becomes the workspace board.
- `src/components/top-bar.tsx`: product naming and selected workspace summary.
- `src/components/app-sidebar.tsx`: product navigation wording and workspace-aware labels.
- `src/routes/client.index.tsx`: client entry shows assigned workspaces before the existing client workflow cards.

---

### Task 1: Add Supabase Workspace Schema And RLS

**Files:**
- Create: `supabase/migrations/20260710090000_offer_workspace_foundation.sql`
- Modify: `src/integrations/supabase/types.ts`

**Interfaces:**
- Produces: public tables `organizations`, `offers`, `offer_members`, `offer_activity`.
- Produces: public functions `is_offer_member(uuid)`, `can_access_offer(uuid)`, `can_access_organization(uuid)`.
- Produces: enums `offer_type`, `offer_stage`, `offer_status`, `offer_member_role`, `offer_activity_visibility`.
- Later tasks consume these tables and enums through `Database["public"]`.

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260710090000_offer_workspace_foundation.sql` with this SQL:

```sql
BEGIN;

CREATE TYPE public.offer_type AS ENUM (
  'gsa_mas',
  'va_fss',
  'gwac_rfp',
  'custom_solicitation'
);

CREATE TYPE public.offer_stage AS ENUM (
  'intake',
  'readiness',
  'automation',
  'review',
  'submission',
  'post_submission'
);

CREATE TYPE public.offer_status AS ENUM (
  'active',
  'blocked',
  'submitted',
  'awarded',
  'archived'
);

CREATE TYPE public.offer_member_role AS ENUM (
  'admin_lead',
  'reviewer',
  'client_contributor',
  'authorized_negotiator',
  'viewer'
);

CREATE TYPE public.offer_activity_visibility AS ENUM (
  'admin',
  'client'
);

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL,
  dba TEXT,
  website TEXT,
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  offer_type public.offer_type NOT NULL DEFAULT 'gsa_mas',
  solicitation_number TEXT,
  agency TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  current_stage public.offer_stage NOT NULL DEFAULT 'intake',
  status public.offer_status NOT NULL DEFAULT 'active',
  readiness_percent INTEGER NOT NULL DEFAULT 0 CHECK (readiness_percent >= 0 AND readiness_percent <= 100),
  documents_in_review INTEGER NOT NULL DEFAULT 0 CHECK (documents_in_review >= 0),
  open_client_items INTEGER NOT NULL DEFAULT 0 CHECK (open_client_items >= 0),
  authorized_negotiator_email TEXT,
  authorized_negotiator_status TEXT NOT NULL DEFAULT 'missing',
  submission_status TEXT NOT NULL DEFAULT 'not_started',
  selected_sins JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_submission_date DATE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.offer_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_email TEXT,
  role public.offer_member_role NOT NULL DEFAULT 'client_contributor',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR invitation_email IS NOT NULL)
);

CREATE UNIQUE INDEX offer_members_offer_user_unique
  ON public.offer_members (offer_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX offer_members_offer_invitation_email_unique
  ON public.offer_members (offer_id, lower(invitation_email))
  WHERE invitation_email IS NOT NULL;

CREATE TABLE public.offer_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  visibility public.offer_activity_visibility NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX offers_organization_id_idx ON public.offers (organization_id);
CREATE INDEX offers_current_stage_idx ON public.offers (current_stage);
CREATE INDEX offers_status_idx ON public.offers (status);
CREATE INDEX offer_members_offer_id_idx ON public.offer_members (offer_id);
CREATE INDEX offer_members_user_id_idx ON public.offer_members (user_id);
CREATE INDEX offer_members_invitation_email_idx ON public.offer_members (lower(invitation_email));
CREATE INDEX offer_activity_offer_id_created_at_idx ON public.offer_activity (offer_id, created_at DESC);

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER offers_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER offer_members_updated_at
  BEFORE UPDATE ON public.offer_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.is_offer_member(_offer_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.offer_members om
    WHERE om.offer_id = _offer_id
      AND om.is_active
      AND (
        om.user_id = auth.uid()
        OR lower(om.invitation_email) = lower(auth.jwt()->>'email')
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_offer(_offer_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR public.is_offer_member(_offer_id)
$$;

CREATE OR REPLACE FUNCTION public.can_access_organization(_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.offers o
    WHERE o.organization_id = _organization_id
      AND public.is_offer_member(o.id)
  )
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_members TO authenticated;
GRANT SELECT, INSERT ON public.offer_activity TO authenticated;
GRANT ALL ON public.organizations TO service_role;
GRANT ALL ON public.offers TO service_role;
GRANT ALL ON public.offer_members TO service_role;
GRANT ALL ON public.offer_activity TO service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins create organizations"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Users view accessible organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (public.can_access_organization(id));

CREATE POLICY "Admins update organizations"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete organizations"
  ON public.organizations FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins create offers"
  ON public.offers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Users view accessible offers"
  ON public.offers FOR SELECT
  TO authenticated
  USING (public.can_access_offer(id));

CREATE POLICY "Admins update offers"
  ON public.offers FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete offers"
  ON public.offers FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins create offer members"
  ON public.offer_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Users view accessible offer members"
  ON public.offer_members FOR SELECT
  TO authenticated
  USING (public.can_access_offer(offer_id));

CREATE POLICY "Admins update offer members"
  ON public.offer_members FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete offer members"
  ON public.offer_members FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins create offer activity"
  ON public.offer_activity FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Users view accessible offer activity"
  ON public.offer_activity FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (
      visibility = 'client'::public.offer_activity_visibility
      AND public.is_offer_member(offer_id)
    )
  );

REVOKE EXECUTE ON FUNCTION public.is_offer_member(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_offer(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_organization(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_offer_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_offer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_organization(UUID) TO authenticated;

COMMIT;
```

- [ ] **Step 2: Update generated-style Supabase types**

Modify `src/integrations/supabase/types.ts` by adding table entries for `organizations`, `offers`, `offer_members`, and `offer_activity` under `Database["public"]["Tables"]`. Use these exact table shapes:

```ts
      organizations: {
        Row: {
          created_at: string
          dba: string | null
          id: string
          legal_name: string
          primary_contact_email: string | null
          primary_contact_name: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          dba?: string | null
          id?: string
          legal_name: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          dba?: string | null
          id?: string
          legal_name?: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      offers: {
        Row: {
          agency: string | null
          archived_at: string | null
          authorized_negotiator_email: string | null
          authorized_negotiator_status: string
          created_at: string
          current_stage: Database["public"]["Enums"]["offer_stage"]
          documents_in_review: number
          id: string
          name: string
          offer_type: Database["public"]["Enums"]["offer_type"]
          open_client_items: number
          organization_id: string
          owner_user_id: string | null
          readiness_percent: number
          selected_sins: Json
          solicitation_number: string | null
          status: Database["public"]["Enums"]["offer_status"]
          submission_status: string
          target_submission_date: string | null
          updated_at: string
        }
        Insert: {
          agency?: string | null
          archived_at?: string | null
          authorized_negotiator_email?: string | null
          authorized_negotiator_status?: string
          created_at?: string
          current_stage?: Database["public"]["Enums"]["offer_stage"]
          documents_in_review?: number
          id?: string
          name: string
          offer_type?: Database["public"]["Enums"]["offer_type"]
          open_client_items?: number
          organization_id: string
          owner_user_id?: string | null
          readiness_percent?: number
          selected_sins?: Json
          solicitation_number?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          submission_status?: string
          target_submission_date?: string | null
          updated_at?: string
        }
        Update: {
          agency?: string | null
          archived_at?: string | null
          authorized_negotiator_email?: string | null
          authorized_negotiator_status?: string
          created_at?: string
          current_stage?: Database["public"]["Enums"]["offer_stage"]
          documents_in_review?: number
          id?: string
          name?: string
          offer_type?: Database["public"]["Enums"]["offer_type"]
          open_client_items?: number
          organization_id?: string
          owner_user_id?: string | null
          readiness_percent?: number
          selected_sins?: Json
          solicitation_number?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          submission_status?: string
          target_submission_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_members: {
        Row: {
          created_at: string
          id: string
          invitation_email: string | null
          is_active: boolean
          offer_id: string
          role: Database["public"]["Enums"]["offer_member_role"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invitation_email?: string | null
          is_active?: boolean
          offer_id: string
          role?: Database["public"]["Enums"]["offer_member_role"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invitation_email?: string | null
          is_active?: boolean
          offer_id?: string
          role?: Database["public"]["Enums"]["offer_member_role"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_members_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_activity: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          module: string
          offer_id: string
          target: string | null
          visibility: Database["public"]["Enums"]["offer_activity_visibility"]
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          module: string
          offer_id: string
          target?: string | null
          visibility?: Database["public"]["Enums"]["offer_activity_visibility"]
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          module?: string
          offer_id?: string
          target?: string | null
          visibility?: Database["public"]["Enums"]["offer_activity_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "offer_activity_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
```

Add these functions under `Database["public"]["Functions"]`:

```ts
      can_access_offer: {
        Args: {
          _offer_id: string
        }
        Returns: boolean
      }
      can_access_organization: {
        Args: {
          _organization_id: string
        }
        Returns: boolean
      }
      is_offer_member: {
        Args: {
          _offer_id: string
        }
        Returns: boolean
      }
```

Add these enums under `Database["public"]["Enums"]`:

```ts
      offer_activity_visibility: "admin" | "client"
      offer_member_role:
        | "admin_lead"
        | "reviewer"
        | "client_contributor"
        | "authorized_negotiator"
        | "viewer"
      offer_stage:
        | "intake"
        | "readiness"
        | "automation"
        | "review"
        | "submission"
        | "post_submission"
      offer_status: "active" | "blocked" | "submitted" | "awarded" | "archived"
      offer_type: "gsa_mas" | "va_fss" | "gwac_rfp" | "custom_solicitation"
```

Update `Constants.public.Enums` to include:

```ts
      offer_activity_visibility: ["admin", "client"],
      offer_member_role: [
        "admin_lead",
        "reviewer",
        "client_contributor",
        "authorized_negotiator",
        "viewer",
      ],
      offer_stage: [
        "intake",
        "readiness",
        "automation",
        "review",
        "submission",
        "post_submission",
      ],
      offer_status: ["active", "blocked", "submitted", "awarded", "archived"],
      offer_type: ["gsa_mas", "va_fss", "gwac_rfp", "custom_solicitation"],
```

- [ ] **Step 3: Verify TypeScript still compiles**

Run:

```bash
npm run build
```

Expected: Vite completes successfully with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260710090000_offer_workspace_foundation.sql src/integrations/supabase/types.ts
git commit -m "Add offer workspace schema"
```

---

### Task 2: Add Pure Offer Workspace Domain Helpers

**Files:**
- Create: `src/lib/offer-workspace.ts`
- Create: `src/lib/offer-workspace.test.ts`

**Interfaces:**
- Consumes: `Database["public"]["Tables"]["offers"]["Row"]`, `Database["public"]["Tables"]["organizations"]["Row"]`, and offer enums from Task 1.
- Produces: `OfferWorkspaceRow`, `OfferWorkspaceCard`, `deriveOfferWorkspaceCard(row)`, `filterOfferWorkspaceCards(cards, filters)`, `getOfferStageMeta(stage)`, `getOfferTypeLabel(type)`, `selectOffer(id)`, `clearSelectedOffer()`, `getSelectedOfferId()`, `useSelectedOfferId()`.

- [ ] **Step 1: Write failing tests**

Create `src/lib/offer-workspace.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  clearSelectedOffer,
  deriveOfferWorkspaceCard,
  filterOfferWorkspaceCards,
  getOfferStageMeta,
  getOfferTypeLabel,
  selectOffer,
  getSelectedOfferId,
  type OfferWorkspaceRow,
} from "./offer-workspace";

const baseRow: OfferWorkspaceRow = {
  id: "offer-1",
  organization_id: "org-1",
  name: "Acme GSA MAS Offer",
  offer_type: "gsa_mas",
  solicitation_number: "47QSMD20R0001",
  agency: "GSA",
  owner_user_id: "admin-1",
  current_stage: "review",
  status: "active",
  readiness_percent: 82,
  documents_in_review: 3,
  open_client_items: 2,
  authorized_negotiator_email: "signer@acme.com",
  authorized_negotiator_status: "ready",
  submission_status: "not_started",
  selected_sins: [{ code: "541611" }],
  target_submission_date: "2026-08-15",
  archived_at: null,
  created_at: "2026-07-10T00:00:00Z",
  updated_at: "2026-07-10T12:00:00Z",
  organizations: {
    id: "org-1",
    legal_name: "Acme LLC",
    dba: null,
    website: "https://acme.example",
    primary_contact_name: "Avery Client",
    primary_contact_email: "avery@acme.example",
    status: "active",
    created_at: "2026-07-10T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
};

describe("getOfferTypeLabel", () => {
  it("labels the first supported GSA MAS offer type", () => {
    expect(getOfferTypeLabel("gsa_mas")).toBe("GSA MAS");
  });
});

describe("getOfferStageMeta", () => {
  it("returns stable display metadata for review", () => {
    expect(getOfferStageMeta("review")).toEqual({
      label: "Review",
      order: 4,
      description: "Documents, compliance matrix, and approvals",
    });
  });
});

describe("deriveOfferWorkspaceCard", () => {
  it("maps a Supabase row into the board card shape", () => {
    expect(deriveOfferWorkspaceCard(baseRow)).toMatchObject({
      id: "offer-1",
      organizationName: "Acme LLC",
      name: "Acme GSA MAS Offer",
      offerTypeLabel: "GSA MAS",
      stageLabel: "Review",
      readinessPercent: 82,
      documentsInReview: 3,
      openClientItems: 2,
      nextAction: "Resolve 2 client item(s)",
    });
  });

  it("prioritizes blocked status in the next action", () => {
    expect(
      deriveOfferWorkspaceCard({
        ...baseRow,
        status: "blocked",
        open_client_items: 0,
      }).nextAction,
    ).toBe("Clear blocker");
  });
});

describe("filterOfferWorkspaceCards", () => {
  it("filters by search, stage, and blocked state", () => {
    const cards = [
      deriveOfferWorkspaceCard(baseRow),
      deriveOfferWorkspaceCard({
        ...baseRow,
        id: "offer-2",
        name: "Beta Intake",
        status: "blocked",
        current_stage: "intake",
        organizations: { ...baseRow.organizations!, legal_name: "Beta Inc" },
      }),
    ];

    expect(filterOfferWorkspaceCards(cards, { search: "beta", stage: "intake", blockedOnly: true })).toHaveLength(1);
    expect(filterOfferWorkspaceCards(cards, { search: "acme", stage: "all", blockedOnly: false })).toHaveLength(1);
  });
});

describe("selected offer helpers", () => {
  it("stores and clears the selected offer ID", () => {
    clearSelectedOffer();
    expect(getSelectedOfferId()).toBe(null);
    selectOffer("offer-1");
    expect(getSelectedOfferId()).toBe("offer-1");
    clearSelectedOffer();
    expect(getSelectedOfferId()).toBe(null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test -- src/lib/offer-workspace.test.ts
```

Expected: FAIL because `src/lib/offer-workspace.ts` does not exist.

- [ ] **Step 3: Implement the helper module**

Create `src/lib/offer-workspace.ts`:

```ts
import { useSyncExternalStore } from "react";
import type { Database, Json } from "@/integrations/supabase/types";

export type OfferType = Database["public"]["Enums"]["offer_type"];
export type OfferStage = Database["public"]["Enums"]["offer_stage"];
export type OfferStatus = Database["public"]["Enums"]["offer_status"];
export type OfferMemberRole = Database["public"]["Enums"]["offer_member_role"];
export type OfferRow = Database["public"]["Tables"]["offers"]["Row"];
export type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];

export type OfferWorkspaceRow = OfferRow & {
  organizations: OrganizationRow | null;
};

export type OfferWorkspaceCard = {
  id: string;
  organizationName: string;
  name: string;
  offerType: OfferType;
  offerTypeLabel: string;
  stage: OfferStage;
  stageLabel: string;
  stageOrder: number;
  status: OfferStatus;
  readinessPercent: number;
  documentsInReview: number;
  openClientItems: number;
  authorizedNegotiatorStatus: string;
  submissionStatus: string;
  solicitationNumber: string | null;
  selectedSinCodes: string[];
  targetSubmissionDate: string | null;
  updatedAt: string;
  nextAction: string;
};

export type OfferWorkspaceFilters = {
  search: string;
  stage: OfferStage | "all";
  blockedOnly: boolean;
};

const SELECTED_OFFER_KEY = "selected-offer-id";
let selectedOfferId = readSelectedOffer();
const selectedListeners = new Set<() => void>();

function readSelectedOffer(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SELECTED_OFFER_KEY);
  } catch {
    return null;
  }
}

function emitSelectedOffer() {
  selectedListeners.forEach((listener) => listener());
}

export function getSelectedOfferId(): string | null {
  return selectedOfferId;
}

export function useSelectedOfferId(): string | null {
  return useSyncExternalStore(
    (listener) => {
      selectedListeners.add(listener);
      return () => selectedListeners.delete(listener);
    },
    getSelectedOfferId,
    getSelectedOfferId,
  );
}

export function selectOffer(id: string) {
  selectedOfferId = id;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SELECTED_OFFER_KEY, id);
  }
  emitSelectedOffer();
}

export function clearSelectedOffer() {
  selectedOfferId = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SELECTED_OFFER_KEY);
  }
  emitSelectedOffer();
}

export const OFFER_STAGE_META: Record<
  OfferStage,
  { label: string; order: number; description: string }
> = {
  intake: {
    label: "Intake",
    order: 1,
    description: "Corporate profile, files, and negotiators",
  },
  readiness: {
    label: "Readiness",
    order: 2,
    description: "MAS readiness score and blockers",
  },
  automation: {
    label: "Automation",
    order: 3,
    description: "Narratives, market validation, authorization, and pricing",
  },
  review: {
    label: "Review",
    order: 4,
    description: "Documents, compliance matrix, and approvals",
  },
  submission: {
    label: "Submission",
    order: 5,
    description: "eOffer package checklist and confirmation",
  },
  post_submission: {
    label: "Post-Submission",
    order: 6,
    description: "CO activity, clarifications, and final disposition",
  },
};

export function getOfferStageMeta(stage: OfferStage) {
  return OFFER_STAGE_META[stage];
}

export function getOfferTypeLabel(type: OfferType): string {
  const labels: Record<OfferType, string> = {
    gsa_mas: "GSA MAS",
    va_fss: "VA FSS",
    gwac_rfp: "GWAC/RFP",
    custom_solicitation: "Custom Solicitation",
  };
  return labels[type];
}

function extractSinCodes(value: Json): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "code" in item && typeof item.code === "string") {
        return item.code;
      }
      return null;
    })
    .filter((code): code is string => Boolean(code));
}

function nextActionFor(row: OfferWorkspaceRow): string {
  if (row.status === "blocked") return "Clear blocker";
  if (row.open_client_items > 0) return `Resolve ${row.open_client_items} client item(s)`;
  if (row.documents_in_review > 0) return `Review ${row.documents_in_review} document(s)`;
  if (row.authorized_negotiator_status !== "ready") return "Confirm authorized negotiator";
  if (row.current_stage === "submission" && row.submission_status === "not_started") return "Generate eOffer package";
  if (row.current_stage === "post_submission") return "Track post-submission activity";
  return `Continue ${getOfferStageMeta(row.current_stage).label}`;
}

export function deriveOfferWorkspaceCard(row: OfferWorkspaceRow): OfferWorkspaceCard {
  const stageMeta = getOfferStageMeta(row.current_stage);
  return {
    id: row.id,
    organizationName: row.organizations?.legal_name ?? "Unassigned organization",
    name: row.name,
    offerType: row.offer_type,
    offerTypeLabel: getOfferTypeLabel(row.offer_type),
    stage: row.current_stage,
    stageLabel: stageMeta.label,
    stageOrder: stageMeta.order,
    status: row.status,
    readinessPercent: row.readiness_percent,
    documentsInReview: row.documents_in_review,
    openClientItems: row.open_client_items,
    authorizedNegotiatorStatus: row.authorized_negotiator_status,
    submissionStatus: row.submission_status,
    solicitationNumber: row.solicitation_number,
    selectedSinCodes: extractSinCodes(row.selected_sins),
    targetSubmissionDate: row.target_submission_date,
    updatedAt: row.updated_at,
    nextAction: nextActionFor(row),
  };
}

export function filterOfferWorkspaceCards(
  cards: OfferWorkspaceCard[],
  filters: OfferWorkspaceFilters,
): OfferWorkspaceCard[] {
  const search = filters.search.trim().toLowerCase();
  return cards.filter((card) => {
    const matchesSearch =
      !search ||
      card.name.toLowerCase().includes(search) ||
      card.organizationName.toLowerCase().includes(search) ||
      card.offerTypeLabel.toLowerCase().includes(search) ||
      (card.solicitationNumber ?? "").toLowerCase().includes(search);
    const matchesStage = filters.stage === "all" || card.stage === filters.stage;
    const matchesBlocked = !filters.blockedOnly || card.status === "blocked";
    return matchesSearch && matchesStage && matchesBlocked;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm run test -- src/lib/offer-workspace.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/offer-workspace.ts src/lib/offer-workspace.test.ts
git commit -m "Add offer workspace domain helpers"
```

---

### Task 3: Add Supabase Workspace Access Functions

**Files:**
- Create: `src/lib/offer-workspace.functions.ts`
- Create: `src/lib/offer-workspace.functions.test.ts`

**Interfaces:**
- Consumes: `deriveOfferWorkspaceCard(row)` from Task 2.
- Produces: `listOfferWorkspaces(client?)`, `getOfferWorkspace(offerId, client?)`, `createOfferWorkspace(input, client?)`, `logOfferActivity(input, client?)`.

- [ ] **Step 1: Write failing tests**

Create `src/lib/offer-workspace.functions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createOfferWorkspace,
  getOfferWorkspace,
  listOfferWorkspaces,
  logOfferActivity,
} from "./offer-workspace.functions";

function listClient(data: unknown, error: Error | null = null) {
  return {
    from: (table: string) => {
      expect(table).toBe("offers");
      return {
        select: (selection: string) => {
          expect(selection).toContain("organizations");
          return {
            order: async (column: string, options: { ascending: boolean }) => {
              expect(column).toBe("updated_at");
              expect(options).toEqual({ ascending: false });
              return { data, error };
            },
          };
        },
      };
    },
  };
}

function getClient(data: unknown, error: Error | null = null) {
  return {
    from: (table: string) => {
      expect(table).toBe("offers");
      return {
        select: () => ({
          eq: (column: string, value: string) => {
            expect(column).toBe("id");
            expect(value).toBe("offer-1");
            return {
              maybeSingle: async () => ({ data, error }),
            };
          },
        }),
      };
    },
  };
}

describe("listOfferWorkspaces", () => {
  it("maps Supabase rows into cards", async () => {
    const cards = await listOfferWorkspaces(
      listClient([
        {
          id: "offer-1",
          organization_id: "org-1",
          name: "Acme GSA MAS Offer",
          offer_type: "gsa_mas",
          solicitation_number: "47QSMD20R0001",
          agency: "GSA",
          owner_user_id: null,
          current_stage: "intake",
          status: "active",
          readiness_percent: 25,
          documents_in_review: 0,
          open_client_items: 1,
          authorized_negotiator_email: null,
          authorized_negotiator_status: "missing",
          submission_status: "not_started",
          selected_sins: [],
          target_submission_date: null,
          archived_at: null,
          created_at: "2026-07-10T00:00:00Z",
          updated_at: "2026-07-10T00:00:00Z",
          organizations: {
            id: "org-1",
            legal_name: "Acme LLC",
            dba: null,
            website: null,
            primary_contact_name: null,
            primary_contact_email: null,
            status: "active",
            created_at: "2026-07-10T00:00:00Z",
            updated_at: "2026-07-10T00:00:00Z",
          },
        },
      ]) as never,
    );

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      id: "offer-1",
      organizationName: "Acme LLC",
      nextAction: "Resolve 1 client item(s)",
    });
  });

  it("throws a readable error when listing fails", async () => {
    await expect(listOfferWorkspaces(listClient(null, new Error("RLS denied")) as never)).rejects.toThrow(
      "Could not load offer workspaces: RLS denied",
    );
  });
});

describe("getOfferWorkspace", () => {
  it("returns null when the workspace is missing", async () => {
    await expect(getOfferWorkspace("offer-1", getClient(null) as never)).resolves.toBe(null);
  });
});

describe("createOfferWorkspace", () => {
  it("creates organization, offer, client member, and activity rows in order", async () => {
    const calls: string[] = [];
    const client = {
      from: (table: string) => ({
        insert: (payload: unknown) => {
          calls.push(`${table}:${JSON.stringify(payload)}`);
          if (table === "organizations") {
            return { select: () => ({ single: async () => ({ data: { id: "org-1" }, error: null }) }) };
          }
          if (table === "offers") {
            return { select: () => ({ single: async () => ({ data: { id: "offer-1" }, error: null }) }) };
          }
          return { select: () => ({ single: async () => ({ data: { id: "member-1" }, error: null }) }) };
        },
      }),
    };

    await expect(
      createOfferWorkspace(
        {
          organizationName: "Acme LLC",
          offerName: "Acme GSA MAS Offer",
          clientEmail: "client@acme.example",
          solicitationNumber: "47QSMD20R0001",
        },
        client as never,
      ),
    ).resolves.toEqual({ offerId: "offer-1", organizationId: "org-1" });

    expect(calls[0]).toContain("organizations");
    expect(calls[1]).toContain("offers");
    expect(calls[2]).toContain("offer_members");
  });
});

describe("logOfferActivity", () => {
  it("inserts a client-visible activity row", async () => {
    const inserts: unknown[] = [];
    const client = {
      from: (table: string) => ({
        insert: async (payload: unknown) => {
          expect(table).toBe("offer_activity");
          inserts.push(payload);
          return { error: null };
        },
      }),
    };

    await logOfferActivity(
      {
        offerId: "offer-1",
        module: "Workspace",
        action: "created workspace",
        visibility: "client",
      },
      client as never,
    );

    expect(inserts).toEqual([
      {
        offer_id: "offer-1",
        actor_user_id: null,
        module: "Workspace",
        action: "created workspace",
        target: null,
        visibility: "client",
      },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test -- src/lib/offer-workspace.functions.test.ts
```

Expected: FAIL because `src/lib/offer-workspace.functions.ts` does not exist.

- [ ] **Step 3: Implement Supabase functions**

Create `src/lib/offer-workspace.functions.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { deriveOfferWorkspaceCard, type OfferWorkspaceCard, type OfferWorkspaceRow } from "./offer-workspace";

type WorkspaceClient = SupabaseClient<Database>;

const WORKSPACE_SELECT = `
  id,
  organization_id,
  name,
  offer_type,
  solicitation_number,
  agency,
  owner_user_id,
  current_stage,
  status,
  readiness_percent,
  documents_in_review,
  open_client_items,
  authorized_negotiator_email,
  authorized_negotiator_status,
  submission_status,
  selected_sins,
  target_submission_date,
  archived_at,
  created_at,
  updated_at,
  organizations (
    id,
    legal_name,
    dba,
    website,
    primary_contact_name,
    primary_contact_email,
    status,
    created_at,
    updated_at
  )
`;

export type CreateOfferWorkspaceInput = {
  organizationName: string;
  offerName: string;
  clientEmail?: string;
  solicitationNumber?: string;
};

export type CreateOfferWorkspaceResult = {
  organizationId: string;
  offerId: string;
};

export async function listOfferWorkspaces(
  client: WorkspaceClient = supabase,
): Promise<OfferWorkspaceCard[]> {
  const { data, error } = await client
    .from("offers")
    .select(WORKSPACE_SELECT)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load offer workspaces: ${error.message}`);
  }

  return ((data ?? []) as OfferWorkspaceRow[]).map(deriveOfferWorkspaceCard);
}

export async function getOfferWorkspace(
  offerId: string,
  client: WorkspaceClient = supabase,
): Promise<OfferWorkspaceCard | null> {
  const { data, error } = await client
    .from("offers")
    .select(WORKSPACE_SELECT)
    .eq("id", offerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load offer workspace: ${error.message}`);
  }

  return data ? deriveOfferWorkspaceCard(data as OfferWorkspaceRow) : null;
}

export async function createOfferWorkspace(
  input: CreateOfferWorkspaceInput,
  client: WorkspaceClient = supabase,
): Promise<CreateOfferWorkspaceResult> {
  const organizationName = input.organizationName.trim();
  const offerName = input.offerName.trim();
  const clientEmail = input.clientEmail?.trim().toLowerCase() || null;
  const solicitationNumber = input.solicitationNumber?.trim() || null;

  if (!organizationName) throw new Error("Organization name is required");
  if (!offerName) throw new Error("Offer name is required");

  const { data: organization, error: organizationError } = await client
    .from("organizations")
    .insert({ legal_name: organizationName, primary_contact_email: clientEmail })
    .select("id")
    .single();

  if (organizationError) {
    throw new Error(`Could not create organization: ${organizationError.message}`);
  }

  const { data: offer, error: offerError } = await client
    .from("offers")
    .insert({
      organization_id: organization.id,
      name: offerName,
      offer_type: "gsa_mas",
      solicitation_number: solicitationNumber,
      agency: "GSA",
      current_stage: "intake",
      status: "active",
    })
    .select("id")
    .single();

  if (offerError) {
    throw new Error(`Could not create offer workspace: ${offerError.message}`);
  }

  if (clientEmail) {
    const { error: memberError } = await client
      .from("offer_members")
      .insert({
        offer_id: offer.id,
        invitation_email: clientEmail,
        role: "client_contributor",
        is_active: true,
      })
      .select("id")
      .single();

    if (memberError) {
      throw new Error(`Could not assign client to offer: ${memberError.message}`);
    }
  }

  await logOfferActivity(
    {
      offerId: offer.id,
      module: "Workspace",
      action: "created workspace",
      target: offerName,
      visibility: "client",
    },
    client,
  );

  return { organizationId: organization.id, offerId: offer.id };
}

export async function logOfferActivity(
  input: {
    offerId: string;
    actorUserId?: string | null;
    module: string;
    action: string;
    target?: string | null;
    visibility?: Database["public"]["Enums"]["offer_activity_visibility"];
  },
  client: WorkspaceClient = supabase,
) {
  const { error } = await client.from("offer_activity").insert({
    offer_id: input.offerId,
    actor_user_id: input.actorUserId ?? null,
    module: input.module,
    action: input.action,
    target: input.target ?? null,
    visibility: input.visibility ?? "admin",
  });

  if (error) {
    throw new Error(`Could not log offer activity: ${error.message}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm run test -- src/lib/offer-workspace.functions.test.ts src/lib/offer-workspace.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/offer-workspace.functions.ts src/lib/offer-workspace.functions.test.ts
git commit -m "Add offer workspace data functions"
```

---

### Task 4: Build Admin Workspace Board

**Files:**
- Create: `src/components/workspace-board.tsx`
- Modify: `src/routes/index.tsx`

**Interfaces:**
- Consumes: `listOfferWorkspaces()` from Task 3.
- Consumes: `filterOfferWorkspaceCards()`, `OFFER_STAGE_META`, `selectOffer()` from Task 2.
- Produces: Admin landing page that lists workspaces grouped by stage, filters workspaces, and selects an active workspace.

- [ ] **Step 1: Create the board component**

Create `src/components/workspace-board.tsx`:

```tsx
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, CircleAlert, Clock, FileText, Search, UserCheck } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { PageHeader, StatusPill } from "@/components/ui-primitives";
import { createOfferWorkspace, listOfferWorkspaces } from "@/lib/offer-workspace.functions";
import {
  filterOfferWorkspaceCards,
  OFFER_STAGE_META,
  selectOffer,
  type OfferStage,
  type OfferWorkspaceCard,
} from "@/lib/offer-workspace";

const STAGE_ORDER: OfferStage[] = [
  "intake",
  "readiness",
  "automation",
  "review",
  "submission",
  "post_submission",
];

export function WorkspaceBoard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<OfferStage | "all">("all");
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const query = useQuery({
    queryKey: ["offer-workspaces"],
    queryFn: () => listOfferWorkspaces(),
  });

  const createMutation = useMutation({
    mutationFn: createOfferWorkspace,
    onSuccess: async (result) => {
      selectOffer(result.offerId);
      await queryClient.invalidateQueries({ queryKey: ["offer-workspaces"] });
      setCreateOpen(false);
      navigate({ to: "/status" });
    },
  });

  const filtered = useMemo(
    () =>
      filterOfferWorkspaceCards(query.data ?? [], {
        search,
        stage,
        blockedOnly,
      }),
    [query.data, search, stage, blockedOnly],
  );

  const grouped = useMemo(
    () =>
      STAGE_ORDER.map((stageId) => ({
        stage: stageId,
        meta: OFFER_STAGE_META[stageId],
        cards: filtered.filter((card) => card.stage === stageId),
      })),
    [filtered],
  );

  return (
    <>
      <PageHeader
        eyebrow="Offer Automation Workspace"
        title="Workspace Board"
        description="Manage active offer workspaces, client blockers, document reviews, and submission progress from one board."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen((open) => !open)}
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-3 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground"
          >
            <BriefcaseBusiness className="size-4" />
            New GSA MAS Offer
          </button>
        }
      />

      {createOpen ? (
        <CreateWorkspaceForm
          busy={createMutation.isPending}
          error={createMutation.error ? (createMutation.error as Error).message : null}
          onCancel={() => setCreateOpen(false)}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search client, offer, solicitation, or type"
            className="h-10 w-full rounded-sm border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <select
          value={stage}
          onChange={(event) => setStage(event.target.value as OfferStage | "all")}
          className="h-10 rounded-sm border border-border bg-card px-3 text-sm"
        >
          <option value="all">All stages</option>
          {STAGE_ORDER.map((stageId) => (
            <option key={stageId} value={stageId}>
              {OFFER_STAGE_META[stageId].label}
            </option>
          ))}
        </select>
        <label className="flex h-10 items-center gap-2 rounded-sm border border-border bg-card px-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <input
            type="checkbox"
            checked={blockedOnly}
            onChange={(event) => setBlockedOnly(event.target.checked)}
          />
          Blocked only
        </label>
      </div>

      {query.isLoading ? (
        <div className="rounded-sm border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading workspaces...
        </div>
      ) : query.isError ? (
        <div className="rounded-sm border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          {(query.error as Error).message}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyWorkspaceState hasFilters={Boolean(search || stage !== "all" || blockedOnly)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {grouped
            .filter((group) => group.cards.length > 0)
            .map((group) => (
              <section key={group.stage} className="rounded-sm border border-border bg-surface">
                <div className="border-b border-border px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">
                        {group.meta.label}
                      </h2>
                      <p className="mt-1 text-[11px] text-muted-foreground">{group.meta.description}</p>
                    </div>
                    <span className="font-mono text-lg font-bold text-primary">{group.cards.length}</span>
                  </div>
                </div>
                <div className="space-y-3 p-3">
                  {group.cards.map((card) => (
                    <WorkspaceCard key={card.id} card={card} />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </>
  );
}

function CreateWorkspaceForm({
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: {
    organizationName: string;
    offerName: string;
    clientEmail?: string;
    solicitationNumber?: string;
  }) => void;
}) {
  const [organizationName, setOrganizationName] = useState("");
  const [offerName, setOfferName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [solicitationNumber, setSolicitationNumber] = useState("47QSMD20R0001");

  return (
    <form
      className="mb-6 rounded-sm border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          organizationName,
          offerName,
          clientEmail,
          solicitationNumber,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Client company
          </span>
          <input
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm"
            required
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Offer name
          </span>
          <input
            value={offerName}
            onChange={(event) => setOfferName(event.target.value)}
            className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm"
            required
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Client email
          </span>
          <input
            type="email"
            value={clientEmail}
            onChange={(event) => setClientEmail(event.target.value)}
            className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Solicitation
          </span>
          <input
            value={solicitationNumber}
            onChange={(event) => setSolicitationNumber(event.target.value)}
            className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm"
          />
        </label>
      </div>
      {error ? <div className="mt-3 text-sm text-destructive">{error}</div> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-sm border border-border px-3 py-2 text-xs font-bold uppercase tracking-widest"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-sm bg-primary px-3 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Creating..." : "Create workspace"}
        </button>
      </div>
    </form>
  );
}

function EmptyWorkspaceState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-sm border border-border bg-card p-8 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-sm bg-muted text-muted-foreground">
        <BriefcaseBusiness className="size-5" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-foreground">
        {hasFilters ? "No workspaces match these filters" : "No offer workspaces yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {hasFilters
          ? "Adjust the filters to see active workspaces."
          : "Create the first GSA MAS workspace after the Supabase migration has been applied."}
      </p>
    </div>
  );
}

function WorkspaceCard({ card }: { card: OfferWorkspaceCard }) {
  return (
    <Link
      to="/status"
      onClick={() => selectOffer(card.id)}
      className="block rounded-sm border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-foreground">{card.organizationName}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{card.name}</div>
        </div>
        <StatusPill status={card.status} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <span>{card.offerTypeLabel}</span>
        {card.solicitationNumber ? <span>{card.solicitationNumber}</span> : null}
        {card.selectedSinCodes.length > 0 ? <span>{card.selectedSinCodes.join(", ")}</span> : null}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric icon={<Clock className="size-3" />} label="Ready" value={`${card.readinessPercent}%`} />
        <Metric icon={<FileText className="size-3" />} label="Review" value={String(card.documentsInReview)} />
        <Metric icon={<CircleAlert className="size-3" />} label="Client" value={String(card.openClientItems)} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <UserCheck className="size-3" />
          <span className="truncate">Signer: {card.authorizedNegotiatorStatus}</span>
        </div>
        <div className="text-right text-[10px] font-bold uppercase tracking-widest text-primary">
          {card.nextAction}
        </div>
      </div>
    </Link>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-surface p-2">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Replace the admin landing route**

Replace the contents of `src/routes/index.tsx` with:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceBoard } from "@/components/workspace-board";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Workspace Board — Offer Automation Workspace" },
      {
        name: "description",
        content:
          "Active offer workspace board for GSA MAS submissions, client blockers, document reviews, and eOffer progress.",
      },
    ],
  }),
  component: WorkspaceBoard,
});
```

- [ ] **Step 3: Run focused verification**

Run:

```bash
npm run build
```

Expected: Vite completes successfully with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace-board.tsx src/routes/index.tsx
git commit -m "Add workspace board"
```

---

### Task 5: Add Selected Workspace Shell And Client Entry

**Files:**
- Create: `src/components/selected-workspace-banner.tsx`
- Modify: `src/components/top-bar.tsx`
- Modify: `src/components/app-sidebar.tsx`
- Modify: `src/routes/client.index.tsx`

**Interfaces:**
- Consumes: `useSelectedOfferId()` and `getOfferWorkspace()` from earlier tasks.
- Produces: visible selected workspace summary in the admin shell.
- Produces: client landing page list of assigned workspaces before existing client steps.

- [ ] **Step 1: Create selected workspace banner**

Create `src/components/selected-workspace-banner.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BriefcaseBusiness } from "lucide-react";
import { getOfferWorkspace } from "@/lib/offer-workspace.functions";
import { useSelectedOfferId } from "@/lib/offer-workspace";

export function SelectedWorkspaceBanner() {
  const selectedOfferId = useSelectedOfferId();
  const query = useQuery({
    queryKey: ["selected-offer-workspace", selectedOfferId],
    queryFn: () => (selectedOfferId ? getOfferWorkspace(selectedOfferId) : Promise.resolve(null)),
    enabled: Boolean(selectedOfferId),
  });

  if (!selectedOfferId) {
    return (
      <div className="border-b border-border bg-surface px-4 py-2 text-[11px] text-muted-foreground">
        Select an offer from the workspace board to scope workflow modules.
      </div>
    );
  }

  const workspace = query.data;

  return (
    <div className="border-b border-border bg-surface px-4 py-2">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <BriefcaseBusiness className="size-4 shrink-0 text-primary" />
          {query.isLoading ? (
            <span className="text-muted-foreground">Loading selected workspace...</span>
          ) : workspace ? (
            <span className="truncate">
              <span className="font-bold text-foreground">{workspace.organizationName}</span>
              <span className="text-muted-foreground"> · {workspace.offerTypeLabel} · {workspace.stageLabel}</span>
            </span>
          ) : (
            <span className="text-warning">Selected workspace is no longer available.</span>
          )}
        </div>
        <Link to="/" className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-primary">
          Change workspace
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update the top bar**

Modify `src/components/top-bar.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { clearAllPersisted } from "@/lib/persist";

function resetLocalDrafts() {
  if (typeof window === "undefined") return;
  const ok = window.confirm(
    "Clear local draft data? This clears browser-only trial data from the older modules. Supabase workspaces are not deleted.",
  );
  if (!ok) return;
  clearAllPersisted();
  try {
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }
  window.location.assign("/");
}

export function TopBar() {
  const { user, fullName, signOut, role } = useAuth();
  const initials = (fullName || user?.email || "U")
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card sticky top-0 z-20">
      <div className="flex items-center gap-6">
        <Link to="/" className="font-bold tracking-tighter text-lg uppercase text-foreground">
          Offer Automation <span className="text-primary">Workspace</span>
        </Link>
        <nav className="flex gap-4 text-xs font-medium text-muted-foreground">
          <Link to="/" className="text-foreground border-b-2 border-primary h-12 flex items-center px-1">
            Board
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <div className="text-[10px] font-mono text-muted-foreground hidden md:block">
              {fullName || user.email} · {role}
            </div>
            <button
              onClick={resetLocalDrafts}
              title="Clear browser-only draft data from older modules"
              className="text-[10px] font-bold uppercase tracking-widest border border-border px-2 py-1 rounded-sm hover:bg-muted"
            >
              Clear drafts
            </button>
            <button
              onClick={() => signOut()}
              className="text-[10px] font-bold uppercase tracking-widest border border-border px-2 py-1 rounded-sm hover:bg-muted"
            >
              Sign out
            </button>
            <div className="size-7 bg-foreground rounded-sm flex items-center justify-center text-[10px] text-background font-mono font-bold">
              {initials}
            </div>
          </>
        ) : (
          <Link
            to="/login"
            className="text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground px-3 py-1.5 rounded-sm"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Mount the selected workspace banner in the root shell**

Modify `src/routes/__root.tsx`:

1. Add this import:

```tsx
import { SelectedWorkspaceBanner } from "@/components/selected-workspace-banner";
```

2. In the authenticated admin shell, render the banner after `<GsaRefreshBanner />`:

```tsx
      <GsaRefreshBanner />
      <SelectedWorkspaceBanner />
      <div className="flex grow">
```

3. Update root metadata titles from `ScheduleBuilder — GSA MAS / VA FSS Offer Automation` to `Offer Automation Workspace`.

- [ ] **Step 4: Update sidebar wording**

Modify `src/components/app-sidebar.tsx` by changing:

```ts
const groups = [
  { id: "Status", label: "Workspace Status" },
  { id: "Intake", label: "Intake & Readiness" },
  { id: "Engine", label: "Automation" },
  { id: "Final", label: "Review & Submission" },
];
```

Change the export link text from:

```tsx
Export eOffer Package
```

to:

```tsx
Build eOffer Package
```

- [ ] **Step 5: Add assigned workspace list to the client entry**

Modify `src/routes/client.index.tsx` so the top of `ClientOverview()` loads workspaces and renders a compact list above the existing steps:

```tsx
  const workspaces = useQuery({
    queryKey: ["client-offer-workspaces"],
    queryFn: () => listOfferWorkspaces(),
  });
```

Add these imports:

```tsx
import { useQuery } from "@tanstack/react-query";
import { listOfferWorkspaces } from "@/lib/offer-workspace.functions";
import { selectOffer } from "@/lib/offer-workspace";
```

Render this block after the page heading:

```tsx
      <div className="border border-border rounded-sm bg-card">
        <div className="px-4 py-3 border-b border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Assigned Workspaces
        </div>
        {workspaces.isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading assigned workspaces...</div>
        ) : workspaces.isError ? (
          <div className="p-4 text-sm text-destructive">{(workspaces.error as Error).message}</div>
        ) : (workspaces.data ?? []).length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No offer workspaces have been assigned to this account yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(workspaces.data ?? []).map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => selectOffer(workspace.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted"
              >
                <span>
                  <span className="block text-sm font-bold">{workspace.organizationName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {workspace.offerTypeLabel} · {workspace.stageLabel} · {workspace.readinessPercent}% ready
                  </span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  Select
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
```

- [ ] **Step 6: Run verification**

Run:

```bash
npm run build
npm run test -- src/lib/offer-workspace.test.ts src/lib/offer-workspace.functions.test.ts
```

Expected: build succeeds and both test files pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/selected-workspace-banner.tsx src/components/top-bar.tsx src/components/app-sidebar.tsx src/routes/__root.tsx src/routes/client.index.tsx
git commit -m "Add selected workspace shell"
```

---

### Task 6: Final Validation And Rollout Notes

**Files:**
- Modify: `docs/superpowers/plans/2026-07-10-offer-workspace-foundation.md`

**Interfaces:**
- Consumes: all previous task outputs.
- Produces: a verified foundation branch ready for PR review and Supabase SQL application.

- [ ] **Step 1: Run full local verification**

Run:

```bash
npm run test
npm run build
```

Expected: all Vitest tests pass and Vite build succeeds.

- [ ] **Step 2: Inspect changed files**

Run:

```bash
git status --short
git diff --check
```

Expected: no untracked files except intentional source changes before commit; `git diff --check` prints no output.

- [ ] **Step 3: Commit any final plan note updates**

If this plan file was updated during execution to mark discovered verification details, commit those updates:

```bash
git add docs/superpowers/plans/2026-07-10-offer-workspace-foundation.md
git commit -m "Document offer workspace foundation verification"
```

Expected: if the file was unchanged, Git prints `nothing to commit`; that is acceptable.

- [ ] **Step 4: Prepare PR summary**

Use this PR summary:

```markdown
## Summary

- Added Supabase offer workspace foundation tables, enums, helper functions, grants, and RLS policies.
- Added type-safe offer workspace domain helpers and Supabase access functions.
- Replaced the admin landing screen with a stage-grouped workspace board.
- Added selected workspace shell context and an assigned-workspace entry point for clients.

## Verification

- `npm run test`
- `npm run build`

## Deployment Notes

- Apply `supabase/migrations/20260710090000_offer_workspace_foundation.sql` in Supabase before relying on workspace board data in production.
- The current workflow modules still use older local stores until follow-up module migration plans are implemented.
```
