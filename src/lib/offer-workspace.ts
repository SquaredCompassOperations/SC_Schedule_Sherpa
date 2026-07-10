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
  if (row.current_stage === "submission" && row.submission_status === "not_started")
    return "Generate eOffer package";
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
