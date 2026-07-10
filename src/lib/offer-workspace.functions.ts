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
