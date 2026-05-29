import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader, Panel } from "@/components/ui-primitives";
import {
  REQUIRED_CORPORATE_KEYS,
  DOC_LABELS,
  useIntake,
  type IntakeState,
  type Negotiator,
} from "@/lib/intake-store";

export const Route = createFileRoute("/readiness")({
  head: () => ({ meta: [{ title: "Readiness Assessment — ScheduleBuilder" }] }),
  component: ReadinessPage,
});

type Status = "complete" | "partial" | "missing";

type Category = {
  name: string;
  status: Status;
  detail: string;
  effort: string;
  weight: number;
  action?: { label: string; href: string };
};

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
  // Address: must have street1, city, state, zip
  const addr = intake.companyAddress;
  const addrOk = !!(addr.street1 && addr.city && addr.state && addr.zip);
  const score = Math.round(((filled + (addrOk ? 1 : 0)) / (required + 1)) * 100);
  if (!addrOk) missing.push("companyAddress");
  return { score, missing };
}

function ReadinessPage() {
  const intake = useIntake();

  const categories = useMemo<Category[]>(() => {
    const cats: Category[] = [];

    // 1. Corporate information completeness
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

    // 2. Authorized negotiators
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

    // 3. Past performance uploaded
    const pp = intake.pastPerformance;
    const ppCount = pp.length;
    cats.push({
      name: "Past Performance",
      status: ppCount === 0 ? "missing" : ppCount < 2 ? "partial" : "complete",
      detail:
        ppCount === 0
          ? "No past performance documentation uploaded."
          : `${ppCount} file${ppCount === 1 ? "" : "s"} uploaded (${
              Array.from(new Set(pp.map((p) => p.category))).join(", ")
            }).`,
      effort: ppCount >= 2 ? "0 hr" : "1–3 hr",
      weight: 15,
      action: ppCount < 2 ? { label: "Open Step 2", href: "/intake" } : undefined,
    });

    // 4. Financial documents
    const pnl1 = intake.documents.pnlYear1;
    const pnl2 = intake.documents.pnlYear2;
    const bal1 = intake.documents.balanceYear1;
    const bal2 = intake.documents.balanceYear2;
    const pnlCount = [pnl1, pnl2].filter(Boolean).length;
    const balCount = [bal1, bal2].filter(Boolean).length;
    const hasLoss = [pnl1, pnl2].some((d) => d?.loss === true);
    const finStatus: Status =
      pnlCount === 2 && balCount === 2 ? "complete" : pnlCount + balCount > 0 ? "partial" : "missing";

    let finDetail = `${pnlCount}/2 P&L · ${balCount}/2 Balance Sheets uploaded.`;
    if (hasLoss) {
      finDetail += " Net loss detected on at least one P&L — explanation required from Primary Negotiator.";
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

    // 5. Corporate policy documents
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
      effort: haveCount === 3 ? "0 hr" : `${(3 - haveCount) * 1}–${(3 - haveCount) * 2} hr`,
      weight: 30,
      action: haveCount < 3 ? { label: "Open Step 2", href: "/intake" } : undefined,
    });

    return cats;
  }, [intake]);

  const composite = useMemo(() => {
    const total = categories.reduce((acc, c) => {
      const s = c.status === "complete" ? 100 : c.status === "partial" ? 50 : 0;
      return acc + s * (c.weight / 100);
    }, 0);
    return Math.round(total);
  }, [categories]);

  return (
    <>
      <PageHeader
        eyebrow="Module 2 • Intake & Readiness"
        title="Readiness Assessment"
        description="Live readiness score and remaining level of effort derived from the Client Intake. Run before locking SINs."
        actions={
          <div className="text-right">
            <div className="text-[10px] font-mono text-muted-foreground uppercase">Composite</div>
            <div className="text-4xl font-mono font-extrabold text-primary leading-none">
              {composite}
            </div>
          </div>
        }
      />

      <Panel title="Readiness Categories" className="p-0">
        <div className="divide-y divide-border">
          {categories.map((c) => (
            <div key={c.name} className="p-4">
              <div className="flex justify-between items-baseline mb-2 gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-foreground">{c.name}</div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{c.detail}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">
                    Effort remaining
                  </div>
                  <div className="text-sm font-mono font-bold text-foreground">{c.effort}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    Weight {c.weight}%
                  </div>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    c.status === "complete"
                      ? "bg-success"
                      : c.status === "partial"
                        ? "bg-warning"
                        : "bg-destructive"
                  }`}
                  style={{
                    width:
                      c.status === "complete" ? "100%" : c.status === "partial" ? "50%" : "8%",
                  }}
                />
              </div>
              {c.action ? (
                <div className="mt-3">
                  <a
                    href={c.action.href}
                    className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 inline-block border border-border bg-background rounded-sm hover:bg-muted"
                  >
                    {c.action.label} →
                  </a>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const cls =
    status === "complete"
      ? "bg-success/10 text-success border-success/30"
      : status === "partial"
        ? "bg-warning/10 text-warning border-warning/30"
        : "bg-destructive/10 text-destructive border-destructive/30";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[9px] font-mono font-bold uppercase border ${cls}`}
    >
      {status}
    </span>
  );
}
