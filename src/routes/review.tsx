import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, StatusPill } from "@/components/ui-primitives";
import { REVIEW_GATES } from "@/lib/mock-data";

export const Route = createFileRoute("/review")({
  head: () => ({ meta: [{ title: "Review Workflow — ScheduleBuilder" }] }),
  component: ReviewPage,
});

type GateStatus = "approved" | "in_review" | "pending";

function ReviewPage() {
  const [gates, setGates] = useState(
    REVIEW_GATES.map((g) => ({ ...g, status: g.status as GateStatus, expanded: false })),
  );

  const updateStatus = (index: number, status: GateStatus) => {
    setGates((prev) =>
      prev.map((g, i) => (i === index ? { ...g, status } : g)),
    );
  };

  const toggleExpand = (index: number) => {
    setGates((prev) =>
      prev.map((g, i) => (i === index ? { ...g, expanded: !g.expanded } : g)),
    );
  };

  const approvedCount = gates.filter((g) => g.status === "approved").length;
  const allApproved = approvedCount === gates.length;

  return (
    <>
      <PageHeader
        eyebrow="Approval Gates"
        title="Review Workflow"
        description="Sequential approval gates before the eOffer package can be exported. Authorized Negotiator certification is the final human-controlled step."
        actions={
          <div className="text-right">
            <div className="text-[10px] font-mono text-muted-foreground uppercase">Approved</div>
            <div className={`text-2xl font-mono font-bold leading-none ${allApproved ? "text-success" : "text-primary"}`}>
              {approvedCount}/{gates.length}
            </div>
          </div>
        }
      />

      <Panel className="p-0">
        <ol className="divide-y divide-border">
          {gates.map((g, i) => (
            <li key={g.stage}>
              <div className="p-4 flex items-center gap-4">
                <div className={`size-9 rounded-sm flex items-center justify-center font-mono font-bold text-sm shrink-0 ${
                  g.status === "approved" ? "bg-success text-success-foreground" :
                  g.status === "in_review" ? "bg-warning text-background" :
                  "bg-muted text-muted-foreground border border-border"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-foreground">{g.stage}</div>
                  <div className="text-[11px] font-mono text-muted-foreground">Owner: {g.owner}</div>
                </div>
                <StatusPill status={g.status} />
                <button
                  onClick={() => toggleExpand(i)}
                  className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm hover:bg-muted"
                >
                  {g.expanded ? "Close" : "Open"}
                </button>
              </div>
              {g.expanded && (
                <div className="px-4 pb-4 pl-[4.5rem]">
                  <div className="border border-border rounded-sm p-3 bg-surface text-xs space-y-2">
                    <p className="text-muted-foreground">
                      Review all deliverables for <span className="font-bold text-foreground">{g.stage}</span> before changing status.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(i, "approved")}
                        className="px-3 py-1 bg-success text-success-foreground rounded-sm font-bold text-[10px] uppercase tracking-widest hover:opacity-90"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateStatus(i, "in_review")}
                        className="px-3 py-1 bg-warning text-background rounded-sm font-bold text-[10px] uppercase tracking-widest hover:opacity-90"
                      >
                        In Review
                      </button>
                      <button
                        onClick={() => updateStatus(i, "pending")}
                        className="px-3 py-1 bg-muted text-foreground border border-border rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-muted/80"
                      >
                        Reset to Pending
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      </Panel>

      {allApproved && (
        <div className="mt-6 p-4 border border-success/30 bg-success/5 rounded-sm text-xs text-foreground">
          <span className="font-bold">All gates approved.</span> The eOffer package is ready for export. Navigate to <a href="/export" className="text-primary underline">Export eOffer</a> to build the final package.
        </div>
      )}

      <div className="mt-6 p-4 border border-warning/30 bg-warning/5 rounded-sm text-xs text-foreground">
        <span className="font-bold">Important:</span> ScheduleBuilder prepares an eOffer-ready package but does
        not submit on behalf of the offeror. The Authorized Negotiator must certify and submit through eOffer.
      </div>
    </>
  );
}
