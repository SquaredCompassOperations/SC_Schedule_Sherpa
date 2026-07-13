import type { SelectedSin } from "@/lib/automation-store";
import type { DocState } from "@/lib/doc-store";
import type { CorporateInfo } from "@/lib/intake-store";
import type { OfferWorkspaceCard } from "@/lib/offer-workspace";

export type RegistrationSource = Pick<
  CorporateInfo,
  "legalName" | "uei" | "cageCode" | "samStatus" | "samExpires"
>;

export function buildRegistrationItems(
  source: RegistrationSource,
  card?: OfferWorkspaceCard,
): Array<{ label: string; status: "ok" | "gap"; note: string }> {
  const hasAnyIntake = Object.values(source).some((value) => String(value ?? "").trim());
  if (!hasAnyIntake && !card?.authorizedNegotiatorStatus && !card?.readinessPercent) return [];

  const items: Array<{ label: string; status: "ok" | "gap"; note: string }> = [];
  if (source.samStatus || source.samExpires) {
    const active = source.samStatus.toLowerCase().includes("active");
    items.push({
      label: "SAM.gov Active Registration",
      status: active ? "ok" : "gap",
      note: source.samExpires
        ? `Expires ${source.samExpires}`
        : source.samStatus || "Verify status",
    });
  }
  if (source.uei) {
    items.push({ label: "UEI Issued", status: "ok", note: source.uei });
  }
  if (source.cageCode) {
    items.push({ label: "CAGE Code", status: "ok", note: source.cageCode });
  }
  if (card?.authorizedNegotiatorStatus && card.authorizedNegotiatorStatus !== "missing") {
    items.push({
      label: "eOffer Digital Cert",
      status: card.authorizedNegotiatorStatus === "ready" ? "ok" : "gap",
      note:
        card.authorizedNegotiatorStatus === "ready"
          ? "Authorized negotiator ready"
          : "Authorized negotiator pending",
    });
  }
  if (card && card.readinessPercent > 0) {
    items.push({
      label: "Readiness Assessment",
      status: card.readinessPercent >= 90 ? "ok" : "gap",
      note: `${card.readinessPercent}% complete`,
    });
  }
  return items;
}

export function buildComplianceRows(docs: Record<string, DocState>) {
  return Object.entries(docs)
    .filter(([, doc]) =>
      Boolean(doc.text || doc.sourceFile || doc.status === "review" || doc.status === "final"),
    )
    .map(([name, doc]) => ({
      ref: doc.source === "client-upload" ? "Upload" : "Draft",
      req: name,
      source:
        doc.sourceFile?.filename ??
        (doc.source === "client-upload" ? "Client upload" : "Document Generator"),
      status: doc.status === "final" ? "valid" : doc.status === "review" ? "review" : "missing",
    }));
}

export function buildSinRows(selectedSins: Array<SelectedSin | string>) {
  return selectedSins.map((sin, index) => {
    if (typeof sin === "string") {
      return {
        code: sin,
        title: index === 0 ? "Selected scope" : "Additional scope",
        confidence: Math.max(58, 96 - index * 12),
      };
    }
    return sin;
  });
}
