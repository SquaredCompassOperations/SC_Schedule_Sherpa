import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  deriveOfferWorkspaceCard,
  type OfferWorkspaceCard,
  type OfferWorkspaceRow,
} from "./offer-workspace";

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
  organizationId?: string;
  organizationName?: string;
  offerName: string;
  clientEmail?: string;
  solicitationNumber?: string;
};

export type CreateOfferWorkspaceResult = {
  organizationId: string;
  offerId: string;
};

export type OrganizationOption = {
  id: string;
  legalName: string;
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

export async function listOrganizations(
  client: WorkspaceClient = supabase,
): Promise<OrganizationOption[]> {
  const { data, error } = await client
    .from("organizations")
    .select("id, legal_name")
    .order("legal_name", { ascending: true });

  if (error) {
    throw new Error(`Could not load organizations: ${error.message}`);
  }

  return (data ?? []).map((organization) => ({
    id: organization.id,
    legalName: organization.legal_name,
  }));
}

export async function createOfferWorkspace(
  input: CreateOfferWorkspaceInput,
  client: WorkspaceClient = supabase,
): Promise<CreateOfferWorkspaceResult> {
  const organizationId = input.organizationId?.trim() || null;
  const organizationName = input.organizationName?.trim() || null;
  const offerName = input.offerName.trim();
  const clientEmail = input.clientEmail?.trim().toLowerCase() || null;
  const solicitationNumber = input.solicitationNumber?.trim() || null;

  if (!organizationId && !organizationName) throw new Error("Organization name is required");
  if (!offerName) throw new Error("Offer name is required");

  const { data, error } = await client.rpc("create_offer_workspace", {
    p_organization_id: organizationId,
    p_organization_name: organizationName,
    p_offer_name: offerName,
    p_client_email: clientEmail,
    p_solicitation_number: solicitationNumber,
  });

  if (error) {
    throw new Error(`Could not create offer workspace: ${error.message}`);
  }

  const result = data?.[0];
  if (!result) throw new Error("Could not create offer workspace: the transaction returned no workspace");

  return { organizationId: result.organization_id, offerId: result.offer_id };
}

export async function logOfferActivity(
  input: {
    offerId: string;
    module: string;
    action: string;
    target?: string | null;
    visibility?: Database["public"]["Enums"]["offer_activity_visibility"];
  },
  client: WorkspaceClient = supabase,
) {
  const { error } = await client.rpc("log_offer_activity", {
    p_offer_id: input.offerId,
    p_module: input.module,
    p_action: input.action,
    p_target: input.target ?? null,
    p_visibility: input.visibility ?? "admin",
  });

  if (error) {
    throw new Error(`Could not log offer activity: ${error.message}`);
  }
}
