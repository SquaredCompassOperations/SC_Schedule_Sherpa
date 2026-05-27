import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, StatusPill } from "@/components/ui-primitives";
import { REVIEW_GATES } from "@/lib/mock-data";

export const Route = createFileRoute("/review")({
  head: () => ({ meta: [{ title: "Review Workflow — ScheduleBuilder" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  return (
    <>
      <PageHeader
        eyebrow="Approval Gates"
        title="Review Workflow"
        description="Sequential approval gates before the eOffer package can be exported. Authorized Negotiator certification is the final human-controlled step."
      />

      <Panel className="p-0">
        <ol className="divide-y divide-border">
          {REVIEW_GATES.map((g, i) => (
            <li key={g.stage} className="p-4 flex items-center gap-4">
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
              <button className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm hover:bg-muted">
                Open
              </button>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="mt-6 p-4 border border-warning/30 bg-warning/5 rounded-sm text-xs text-foreground">
        <span className="font-bold">Important:</span> ScheduleBuilder prepares an eOffer-ready package but does
        not submit on behalf of the offeror. The Authorized Negotiator must certify and submit through eOffer.
      </div>
    </>
  );
}
