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
