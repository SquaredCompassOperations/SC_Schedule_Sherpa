import type { OfferType, OfferWorkspaceCard } from "@/lib/offer-workspace";

export function buildActiveClientOptions(cards: OfferWorkspaceCard[]): Array<{
  id: string;
  label: string;
  detail: string;
  offerType: OfferType;
}> {
  return cards.map((card) => ({
    id: card.id,
    label: card.organizationName,
    detail: card.name,
    offerType: card.offerType,
  }));
}
