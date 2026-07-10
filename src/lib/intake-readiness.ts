import {
  DOC_LABELS,
  REQUIRED_CORPORATE_KEYS,
  type IntakeState,
  type Negotiator,
} from "./intake-store";

export type ReadinessStatus = "complete" | "partial" | "missing";

export type ReadinessCategory = {
  name: string;
  status: ReadinessStatus;
  detail: string;
  effort: string;
  weight: number;
  action?: { label: string; href: string };
};

export const INTAKE_COMPLETION_COMPOSITE_THRESHOLD = 90;

function negotiatorComplete(n: Negotiator) {
  const hasPhone = !!(n.phoneUs.trim() || n.phoneIntl.trim());
  return !!(n.name.trim() && n.title.trim() && n.email.trim() && hasPhone);
}

function corporateCompleteness(intake: IntakeState): { score: number; missing: string[] } {
  const missing: string[] = [];
  for (const k of REQUIRED_CORPORATE_KEYS) {
    if (!intake.corporate[k]?.trim()) missing.push(k);
  }
  const required = REQUIRED_CORPORATE_KEYS.length;
  const filled = required - missing.length;
  const addr = intake.companyAddress;
  const addrOk = !!(addr.street1 && addr.city && addr.state && addr.zip);
  const score = Math.round(((filled + (addrOk ? 1 : 0)) / (required + 1)) * 100);
  if (!addrOk) missing.push("companyAddress");
  return { score, missing };
}

export function buildIntakeReadinessCategories(intake: IntakeState): ReadinessCategory[] {
  const cats: ReadinessCategory[] = [];

  const corp = corporateCompleteness(intake);
  cats.push({
    name: "Corporate Information",
    status: corp.score >= 100 ? "complete" : corp.score >= 60 ? "partial" : "missing",
    detail:
      corp.score >= 100
        ? "All required SAM fields and the company address are present."
        : `Missing: ${corp.missing.join(", ") || "address"}`,
    effort: corp.score >= 100 ? "0 hr" : corp.score >= 60 ? "≤ 1 hr" : "1–2 hr",
    weight: 20,
    action: corp.score < 100 ? { label: "Open Step 1", href: "/intake" } : undefined,
  });

  const completeNegs = intake.negotiators.filter(negotiatorComplete);
  const primaryOk = intake.negotiators[0] && negotiatorComplete(intake.negotiators[0]);
  cats.push({
    name: "Authorized Negotiators",
    status: primaryOk && completeNegs.length >= 1 ? "complete" : "missing",
    detail:
      completeNegs.length === 0
        ? "No negotiators with required fields completed."
        : `${completeNegs.length} of ${intake.negotiators.length} negotiator(s) complete${
            primaryOk ? "" : " (Primary incomplete)"
          }.`,
    effort: primaryOk ? "0 hr" : "≤ 30 min",
    weight: 10,
    action: !primaryOk ? { label: "Open Step 3", href: "/intake" } : undefined,
  });

  const pp = intake.pastPerformance;
  const ppCount = pp.length;
  cats.push({
    name: "Past Performance",
    status: ppCount === 0 ? "missing" : ppCount < 2 ? "partial" : "complete",
    detail:
      ppCount === 0
        ? "No past performance documentation uploaded."
        : `${ppCount} file${ppCount === 1 ? "" : "s"} uploaded (${Array.from(
            new Set(pp.map((p) => p.category)),
          ).join(", ")}).`,
    effort: ppCount >= 2 ? "0 hr" : "1–3 hr",
    weight: 15,
    action: ppCount < 2 ? { label: "Open Step 2", href: "/intake" } : undefined,
  });

  const pnl1 = intake.documents.pnlYear1;
  const pnl2 = intake.documents.pnlYear2;
  const bal1 = intake.documents.balanceYear1;
  const bal2 = intake.documents.balanceYear2;
  const pnlCount = [pnl1, pnl2].filter(Boolean).length;
  const balCount = [bal1, bal2].filter(Boolean).length;
  const hasLoss = [pnl1, pnl2].some((d) => d?.loss === true);
  const finStatus: ReadinessStatus =
    pnlCount === 2 && balCount === 2 ? "complete" : pnlCount + balCount > 0 ? "partial" : "missing";

  let finDetail = `${pnlCount}/2 P&L · ${balCount}/2 Balance Sheets uploaded.`;
  if (hasLoss) {
    finDetail +=
      " Net loss detected on at least one P&L — explanation required from Primary Negotiator.";
  }

  const primaryEmail = intake.negotiators[0]?.email;
  const lossMailto =
    hasLoss && primaryEmail
      ? `mailto:${encodeURIComponent(primaryEmail)}?subject=${encodeURIComponent(
          "Explanation Requested: Net Loss on Submitted P&L",
        )}&body=${encodeURIComponent(
          `Hi ${intake.negotiators[0]?.name || "there"},\n\nWhile preparing your GSA MAS submission, our readiness review detected a net loss on one of the submitted P&L statements (${
            intake.corporate.legalName || "your organization"
          }). GSA evaluators will expect a brief written explanation of the contributing factors and any corrective actions taken.\n\nPlease reply with a short narrative we can include in the financial responsibility section of the offer.\n\nThanks,\nScheduleBuilder`,
        )}`
      : undefined;

  cats.push({
    name: "Financial Documents",
    status: finStatus,
    detail: finDetail,
    effort: finStatus === "complete" ? (hasLoss ? "≤ 1 hr" : "0 hr") : "1–2 hr",
    weight: 25,
    action: lossMailto
      ? { label: "Email Primary Negotiator", href: lossMailto }
      : finStatus !== "complete"
        ? { label: "Open Step 2", href: "/intake" }
        : undefined,
  });

  const policies: { key: keyof typeof DOC_LABELS; have: boolean }[] = [
    { key: "compensationPlan", have: !!intake.documents.compensationPlan },
    { key: "uotPolicy", have: !!intake.documents.uotPolicy },
    { key: "corporatePriceList", have: !!intake.documents.corporatePriceList },
  ];
  const haveCount = policies.filter((p) => p.have).length;
  const missingPol = policies.filter((p) => !p.have).map((p) => DOC_LABELS[p.key]);
  cats.push({
    name: "Corporate Policy Documents",
    status: haveCount === 3 ? "complete" : haveCount > 0 ? "partial" : "missing",
    detail:
      haveCount === 3
        ? "Compensation Plan, UOT Policy, and Corporate Price List(s) all uploaded."
        : `Missing: ${missingPol.join("; ")}`,
    effort: haveCount === 3 ? "0 hr" : `${3 - haveCount}–${(3 - haveCount) * 2} hr`,
    weight: 30,
    action: haveCount < 3 ? { label: "Open Step 2", href: "/intake" } : undefined,
  });

  return cats;
}

export function calculateReadinessComposite(categories: ReadinessCategory[]) {
  const total = categories.reduce((acc, c) => {
    const score = c.status === "complete" ? 100 : c.status === "partial" ? 50 : 0;
    return acc + score * (c.weight / 100);
  }, 0);
  return Math.round(total);
}

export function calculateIntakeReadinessComposite(intake: IntakeState) {
  return calculateReadinessComposite(buildIntakeReadinessCategories(intake));
}

export function isIntakeReadyForCompletion(
  intake: IntakeState,
  threshold = INTAKE_COMPLETION_COMPOSITE_THRESHOLD,
) {
  return calculateIntakeReadinessComposite(intake) >= threshold;
}
