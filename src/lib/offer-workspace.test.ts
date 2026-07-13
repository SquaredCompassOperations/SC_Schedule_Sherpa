import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSelectedOffer,
  deriveOfferWorkspaceCard,
  filterOfferWorkspaceCards,
  getOfferStageMeta,
  getOfferTypeLabel,
  isGsaMasOfferType,
  selectOffer,
  getSelectedOfferId,
  getSelectedOfferType,
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

  it("labels solicitation types using the New Offer dropdown copy", () => {
    expect(getOfferTypeLabel("va_fss")).toBe("VA FSS");
    expect(getOfferTypeLabel("gwac_rfp")).toBe("RFP/RFQ/RFI/RFB");
    expect(getOfferTypeLabel("custom_solicitation")).toBe("Other Solicitation Type");
  });
});

describe("isGsaMasOfferType", () => {
  it("enables MAS readiness only for GSA MAS offers", () => {
    expect(isGsaMasOfferType("gsa_mas")).toBe(true);
    expect(isGsaMasOfferType("va_fss")).toBe(false);
    expect(isGsaMasOfferType("gwac_rfp")).toBe(false);
    expect(isGsaMasOfferType("custom_solicitation")).toBe(false);
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

    expect(
      filterOfferWorkspaceCards(cards, { search: "beta", stage: "intake", blockedOnly: true }),
    ).toHaveLength(1);
    expect(
      filterOfferWorkspaceCards(cards, { search: "acme", stage: "all", blockedOnly: false }),
    ).toHaveLength(1);
  });
});

describe("selected offer helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores and clears the selected offer ID", () => {
    clearSelectedOffer();
    expect(getSelectedOfferId()).toBe(null);
    selectOffer("offer-1", "va_fss");
    expect(getSelectedOfferId()).toBe("offer-1");
    expect(getSelectedOfferType()).toBe("va_fss");
    clearSelectedOffer();
    expect(getSelectedOfferId()).toBe(null);
    expect(getSelectedOfferType()).toBe("gsa_mas");
  });

  it("keeps selection changes working when storage is unavailable", () => {
    vi.stubGlobal("window", {
      localStorage: {
        setItem: () => {
          throw new Error("storage unavailable");
        },
        removeItem: () => {
          throw new Error("storage unavailable");
        },
      },
    });

    expect(() => selectOffer("offer-2")).not.toThrow();
    expect(getSelectedOfferId()).toBe("offer-2");
    expect(() => clearSelectedOffer()).not.toThrow();
    expect(getSelectedOfferId()).toBe(null);
  });
});
