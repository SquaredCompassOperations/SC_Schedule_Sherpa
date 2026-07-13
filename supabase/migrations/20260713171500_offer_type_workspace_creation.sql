BEGIN;

DROP FUNCTION IF EXISTS public.create_offer_workspace(TEXT, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.create_offer_workspace(
  p_organization_name TEXT DEFAULT NULL,
  p_offer_name TEXT DEFAULT NULL,
  p_client_email TEXT DEFAULT NULL,
  p_solicitation_number TEXT DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL,
  p_offer_type public.offer_type DEFAULT 'gsa_mas'
)
RETURNS TABLE (organization_id UUID, offer_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organization_id UUID;
  v_offer_id UUID;
  v_organization_name TEXT;
  v_offer_name TEXT;
  v_client_email TEXT;
  v_offer_type public.offer_type;
  v_agency TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create offer workspaces' USING ERRCODE = '42501';
  END IF;

  v_organization_name := NULLIF(btrim(p_organization_name), '');
  v_offer_name := NULLIF(btrim(p_offer_name), '');
  v_client_email := NULLIF(lower(btrim(p_client_email)), '');
  v_offer_type := COALESCE(p_offer_type, 'gsa_mas'::public.offer_type);
  v_agency := CASE v_offer_type
    WHEN 'gsa_mas' THEN 'GSA'
    WHEN 'va_fss' THEN 'VA'
    WHEN 'gwac_rfp' THEN NULL
    ELSE NULL
  END;

  IF p_organization_id IS NULL AND v_organization_name IS NULL THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

  IF v_offer_name IS NULL THEN
    RAISE EXCEPTION 'Offer name is required';
  END IF;

  IF p_organization_id IS NULL THEN
    INSERT INTO public.organizations (legal_name, primary_contact_email)
    VALUES (v_organization_name, v_client_email)
    RETURNING id INTO v_organization_id;
  ELSE
    SELECT id
    INTO v_organization_id
    FROM public.organizations
    WHERE id = p_organization_id;

    IF v_organization_id IS NULL THEN
      RAISE EXCEPTION 'Organization % does not exist', p_organization_id;
    END IF;
  END IF;

  INSERT INTO public.offers (
    organization_id,
    name,
    offer_type,
    solicitation_number,
    agency,
    owner_user_id,
    current_stage,
    status
  )
  VALUES (
    v_organization_id,
    v_offer_name,
    v_offer_type,
    NULLIF(btrim(p_solicitation_number), ''),
    v_agency,
    auth.uid(),
    'intake',
    'active'
  )
  RETURNING id INTO v_offer_id;

  INSERT INTO public.offer_members (offer_id, user_id, role, is_active)
  VALUES (v_offer_id, auth.uid(), 'admin_lead', true);

  IF v_client_email IS NOT NULL THEN
    INSERT INTO public.offer_members (offer_id, invitation_email, role, is_active)
    VALUES (v_offer_id, v_client_email, 'client_contributor', true);
  END IF;

  INSERT INTO public.offer_activity (
    offer_id,
    actor_user_id,
    module,
    action,
    target,
    visibility
  )
  VALUES (
    v_offer_id,
    auth.uid(),
    'Workspace',
    'created workspace',
    v_offer_name,
    'client'
  );

  RETURN QUERY SELECT v_organization_id, v_offer_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_offer_workspace(TEXT, TEXT, TEXT, TEXT, UUID, public.offer_type) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_offer_workspace(TEXT, TEXT, TEXT, TEXT, UUID, public.offer_type) TO authenticated;

COMMIT;
