import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useStatus } from "@/lib/status-data";
import { CLIENT } from "@/lib/mock-data";
import { useEntity, useIntake, DOC_LABELS, type DocKey } from "@/lib/intake-store";
import { useReadiness, readinessStatus } from "@/lib/readiness-store";
import { listOfferWorkspaces } from "@/lib/offer-workspace.functions";
import { selectOffer } from "@/lib/offer-workspace";

export const Route = createFileRoute("/client/")({
  component: ClientOverview,
});

const REQUIRED_DOCS: DocKey[] = [
  "compensationPlan",
  "uotPolicy",
  "corporatePriceList",
  "companyLogo",
  "pnlYear1",
  "pnlYear2",
  "balanceYear1",
  "balanceYear2",
];

function StepCard({
  step,
  label,
  status,
  to,
  detail,
}: {
  step: number;
  label: string;
  status: "complete" | "in_progress" | "not_started";
  to: string;
  detail: string;
}) {
  const color =
    status === "complete"
      ? "border-success bg-success/10"
      : status === "in_progress"
        ? "border-warning bg-warning/10"
        : "border-border bg-card";
  const badge =
    status === "complete" ? "Complete" : status === "in_progress" ? "In progress" : "Not started";
  const badgeColor =
    status === "complete"
      ? "text-success"
      : status === "in_progress"
        ? "text-warning"
        : "text-muted-foreground";

  return (
    <Link to={to} className={`block border rounded-sm p-5 hover:opacity-90 transition ${color}`}>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        Step {step}
      </div>
      <div className="text-lg font-bold mt-1">{label}</div>
      <div className="text-xs text-muted-foreground mt-1">{detail}</div>
      <div className={`text-[10px] font-mono uppercase tracking-widest mt-3 ${badgeColor}`}>
        ● {badge}
      </div>
    </Link>
  );
}

function ClientOverview() {
  const workspaces = useQuery({
    queryKey: ["client-offer-workspaces"],
    queryFn: () => listOfferWorkspaces(),
  });
  const status = useStatus();
  const entity = useEntity();
  const intake = useIntake();
  const readiness = useReadiness();
  const navigate = useNavigate();

  const readinessState = readinessStatus(readiness);
  const uploadedCount = REQUIRED_DOCS.filter((k) => intake.documents[k]).length;
  const missingCount = REQUIRED_DOCS.length - uploadedCount;
  const docsState: "complete" | "in_progress" | "not_started" =
    intake.clientSubmittedAt && missingCount === 0
      ? "complete"
      : uploadedCount > 0 || intake.clientSubmittedAt
        ? "in_progress"
        : "not_started";

  // On first visit (nothing started), nudge into MAS Readiness.
  useEffect(() => {
    if (readinessState === "not_started" && uploadedCount === 0) {
      navigate({ to: "/client/readiness", replace: true });
    }
  }, [readinessState, uploadedCount, navigate]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Your GSA MAS Offer
        </div>
        <h1 className="text-3xl font-bold mt-1">{entity.name !== "—" ? entity.name : CLIENT.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {CLIENT.schedule} · {CLIENT.solicitation}
        </p>
      </div>

      <div className="border border-border rounded-sm bg-card">
        <div className="px-4 py-3 border-b border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Assigned Workspaces
        </div>
        {workspaces.isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading assigned workspaces...</div>
        ) : workspaces.isError ? (
          <div className="p-4 text-sm text-destructive">{(workspaces.error as Error).message}</div>
        ) : (workspaces.data ?? []).length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No offer workspaces have been assigned to this account yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(workspaces.data ?? []).map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => selectOffer(workspace.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted"
              >
                <span>
                  <span className="block text-sm font-bold">{workspace.organizationName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {workspace.offerTypeLabel} · {workspace.stageLabel} · {workspace.readinessPercent}% ready
                  </span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  Select
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Your steps
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StepCard
            step={1}
            label="MAS Readiness Assessment"
            status={readinessState}
            to="/client/readiness"
            detail={
              readinessState === "complete"
                ? "Submitted — thanks!"
                : readinessState === "in_progress"
                  ? "Pick up where you left off."
                  : "Quick questionnaire to confirm eligibility."
            }
          />
          <StepCard
            step={2}
            label="Corporate Documents"
            status={docsState}
            to="/client/documents"
            detail={
              docsState === "complete"
                ? "All required documents submitted."
                : `${uploadedCount}/${REQUIRED_DOCS.length} uploaded · ${missingCount} missing`
            }
          />
          <StepCard
            step={3}
            label="Review & Sign-Off"
            status="not_started"
            to="/client/review"
            detail="Sign off on deliverables when our team marks them ready."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border rounded-sm p-5 bg-card">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Overall Progress</div>
          <div className="text-4xl font-mono font-bold text-primary mt-1 leading-none">
            {status.composite}%
          </div>
          <div className="mt-3 h-2 bg-muted rounded-sm overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${status.composite}%` }} />
          </div>
        </div>
        <div className="border border-border rounded-sm p-5 bg-card">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Current Stage</div>
          <div className="text-xl font-bold mt-1">{status.currentStage.label}</div>
          <div className="text-xs text-muted-foreground mt-1">{status.currentStage.description}</div>
        </div>
        <div className="border border-border rounded-sm p-5 bg-card">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">What we need</div>
          <div className="text-xl font-bold mt-1">
            {status.openItems.filter((i) => i.owner === "Client").length} open
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Items the team is waiting on you for.
          </div>
        </div>
      </div>
    </div>
  );
}
