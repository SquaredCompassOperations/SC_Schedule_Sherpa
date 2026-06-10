import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, Panel, StatusPill } from "@/components/ui-primitives";
import { DOCUMENT_QUEUE } from "@/lib/mock-data";
import { useDocStore } from "@/lib/doc-store";
import { useAutomation } from "@/lib/automation-store";
import {
  useReview,
  patchGate,
  setCertify,
  type Gate,
  type Comment,
} from "@/lib/review-store";

export const Route = createFileRoute("/review")({
  head: () => ({ meta: [{ title: "Review Workflow — ScheduleBuilder" }] }),
  component: ReviewPage,
});

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReviewPage() {
  const docs = useDocStore();
  const review = useReview();
  const automation = useAutomation();
  const gates = review.gates;
  const { certifyName, certifyTitle, certifyAck } = review;
  const setCertifyName = (v: string) => setCertify({ certifyName: v });
  const setCertifyTitle = (v: string) => setCertify({ certifyTitle: v });
  const setCertifyAck = (v: boolean) => setCertify({ certifyAck: v });

  const [expanded, setExpanded] = useState<number | null>(2);
  const [draftComment, setDraftComment] = useState<Record<number, string>>({});

  const docByName = useMemo(() => new Map(DOCUMENT_QUEUE.map((d) => [d.name, d])), []);
  const docByKind = useMemo(() => new Map(DOCUMENT_QUEUE.map((d) => [d.kind, d])), []);

  const pricingWorkbookStatus = (): "final" | "review" | "draft" => {
    const rows = automation.pricingRows;
    if (!rows || rows.length === 0) return "draft";
    const allComplete = rows.every(
      (r) =>
        r.sin.trim() &&
        r.title.trim() &&
        r.price.trim() &&
        r.description.trim() &&
        r.minimumEducation.trim() &&
        r.minimumYearsExperience.trim() &&
        r.unitOfMeasure.trim(),
    );
    if (!allComplete) return "draft";
    return automation.pricingSavedAt ? "final" : "review";
  };

  const statusFor = (kindOrName: string): "final" | "review" | "draft" | "missing" | "na" => {
    if (kindOrName === "pricing-workbook") return pricingWorkbookStatus();
    const d = docByKind.get(kindOrName);
    const key = d?.name ?? kindOrName;
    return (docs[key]?.status as "final" | "review" | "draft") ?? "draft";
  };

  const isGateUnblocked = (index: number) =>
    gates.slice(0, index).every((g) => g.status === "approved");

  const deliverablesReady = (g: Gate) =>
    g.deliverables.every((name) => {
      if (name.includes("|")) {
        return name.split("|").some((alt) => statusFor(alt) === "final");
      }
      return statusFor(name) === "final";
    });

  const updateGate = (index: number, patch: Partial<Gate>) => patchGate(index, patch);

  const approve = (index: number) => {
    const g = gates[index];
    if (!isGateUnblocked(index)) return;
    if (g.stage === "Authorized Negotiator Certify") {
      if (!certifyName.trim() || !certifyAck) return;
      updateGate(index, {
        status: "approved",
        approvedAt: Date.now(),
        approvedBy: `${certifyName} (${certifyTitle})`,
      });
      return;
    }
    if (!deliverablesReady(g)) return;
    updateGate(index, {
      status: "approved",
      approvedAt: Date.now(),
      approvedBy: g.reviewer,
    });
  };

  const requestChanges = (index: number) =>
    updateGate(index, { status: "changes_requested", approvedAt: null, approvedBy: null });
  const markInReview = (index: number) =>
    updateGate(index, { status: "in_review", approvedAt: null, approvedBy: null });
  const reset = (index: number) =>
    updateGate(index, { status: "pending", approvedAt: null, approvedBy: null });

  const addComment = (index: number) => {
    const text = (draftComment[index] ?? "").trim();
    if (!text) return;
    const c: Comment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      author: gates[index].reviewer || "Reviewer",
      text,
      ts: Date.now(),
    };
    updateGate(index, { comments: [...gates[index].comments, c] });
    setDraftComment((p) => ({ ...p, [index]: "" }));
  };

  const approvedCount = gates.filter((g) => g.status === "approved").length;
  const allApproved = approvedCount === gates.length;
  const changesCount = gates.filter((g) => g.status === "changes_requested").length;

  return (
    <>
      <PageHeader
        eyebrow="Approval Gates"
        title="Review Workflow"
        description="Sequential approval gates before the eOffer package can be exported. Each gate enforces deliverable readiness; the final gate captures Authorized Negotiator certification."
        actions={
          <div className="flex items-center gap-6">
            {changesCount > 0 && (
              <div className="text-right">
                <div className="text-[10px] font-mono text-muted-foreground uppercase">Changes</div>
                <div className="text-2xl font-mono font-bold leading-none text-destructive">{changesCount}</div>
              </div>
            )}
            <div className="text-right">
              <div className="text-[10px] font-mono text-muted-foreground uppercase">Approved</div>
              <div
                className={`text-2xl font-mono font-bold leading-none ${allApproved ? "text-success" : "text-primary"}`}
              >
                {approvedCount}/{gates.length}
              </div>
            </div>
          </div>
        }
      />

      <Panel className="p-0">
        <ol className="divide-y divide-border">
          {gates.map((g, i) => {
            const unblocked = isGateUnblocked(i);
            const ready = deliverablesReady(g);
            const isOpen = expanded === i;
            const isCertify = g.stage === "Authorized Negotiator Certify";

            return (
              <li key={g.stage}>
                <div className="p-4 flex items-center gap-4">
                  <div
                    className={`size-9 rounded-sm flex items-center justify-center font-mono font-bold text-sm shrink-0 ${
                      g.status === "approved"
                        ? "bg-success text-success-foreground"
                        : g.status === "in_review"
                          ? "bg-warning text-background"
                          : g.status === "changes_requested"
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground flex items-center gap-2">
                      {g.stage}
                      {!unblocked && (
                        <span className="text-[10px] font-mono uppercase text-muted-foreground border border-border px-1.5 py-0.5 rounded-sm">
                          Locked
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      Reviewer: {g.reviewer}
                      {g.approvedAt && g.approvedBy && (
                        <> · Approved by {g.approvedBy} · {fmtTime(g.approvedAt)}</>
                      )}
                    </div>
                  </div>
                  <StatusPill status={g.status} />
                  <button
                    onClick={() => setExpanded(isOpen ? null : i)}
                    className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm hover:bg-muted"
                  >
                    {isOpen ? "Close" : "Open"}
                  </button>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 pl-[4.5rem] space-y-3">
                    {/* Reviewer */}
                    <div className="flex items-center gap-2 text-xs">
                      <label className="text-[10px] font-mono uppercase text-muted-foreground w-20">
                        Reviewer
                      </label>
                      <input
                        value={g.reviewer}
                        onChange={(e) => updateGate(i, { reviewer: e.target.value })}
                        className="flex-1 px-2 py-1 bg-surface border border-border rounded-sm text-xs"
                      />
                      <span className="text-[10px] font-mono text-muted-foreground">
                        Role: {g.owner}
                      </span>
                    </div>

                    {/* Deliverables checklist */}
                    {g.deliverables.length > 0 && (
                      <div className="border border-border rounded-sm bg-surface">
                        <div className="px-3 py-2 border-b border-border text-[10px] font-mono uppercase text-muted-foreground flex items-center justify-between">
                          <span>Required deliverables</span>
                          <span className={ready ? "text-success" : "text-warning"}>
                            {ready ? "All final" : "Pending docs"}
                          </span>
                        </div>
                        <ul className="divide-y divide-border">
                          {g.deliverables.map((name) => {
                            if (name === "pricing-workbook") {
                              const st = statusFor(name);
                              return (
                                <li key={name} className="px-3 py-2 flex items-center gap-3 text-xs">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-foreground truncate">Pricing Workbook</div>
                                    <div className="text-[10px] font-mono text-muted-foreground">
                                      pricing-workbook · all areas filled
                                    </div>
                                  </div>
                                  <StatusPill status={st} />
                                  <Link
                                    to="/pricing-workbook"
                                    className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 border border-border rounded-sm hover:bg-muted"
                                  >
                                    Open
                                  </Link>
                                </li>
                              );
                            }
                            if (name.includes("|")) {
                              const alts = name.split("|");
                              const anyFinal = alts.some((a) => statusFor(a) === "final");
                              return (
                                <li key={name} className="px-3 py-2 text-xs">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="flex-1 text-[10px] font-mono uppercase text-muted-foreground">
                                      One of the following (either satisfies this requirement)
                                    </div>
                                    <StatusPill status={anyFinal ? "final" : "draft"} />
                                  </div>
                                  <ul className="space-y-1">
                                    {alts.map((alt) => {
                                      const d = docByKind.get(alt) ?? docByName.get(alt);
                                      const st = statusFor(alt);
                                      return (
                                        <li key={alt} className="flex items-center gap-3 pl-3 border-l border-dashed border-border">
                                          <div className="flex-1 min-w-0">
                                            <div className="font-bold text-foreground truncate">{d?.name ?? alt}</div>
                                            <div className="text-[10px] font-mono text-muted-foreground">{alt}</div>
                                          </div>
                                          <StatusPill status={st} />
                                          <Link
                                            to="/documents"
                                            className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 border border-border rounded-sm hover:bg-muted"
                                          >
                                            Open
                                          </Link>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </li>
                              );
                            }
                            const d = docByKind.get(name) ?? docByName.get(name);
                            const st = statusFor(name);
                            return (
                              <li key={name} className="px-3 py-2 flex items-center gap-3 text-xs">
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-foreground truncate">
                                    {d?.name ?? name}
                                  </div>
                                  <div className="text-[10px] font-mono text-muted-foreground">{name}</div>
                                </div>
                                <StatusPill status={st} />
                                <Link
                                  to="/documents"
                                  className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 border border-border rounded-sm hover:bg-muted"
                                >
                                  Open
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {/* Certify form */}
                    {isCertify && (
                      <div className="border border-border rounded-sm bg-surface p-3 space-y-2">
                        <div className="text-[10px] font-mono uppercase text-muted-foreground">
                          Authorized Negotiator Certification
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={certifyName}
                            onChange={(e) => setCertifyName(e.target.value)}
                            placeholder="Full legal name"
                            className="px-2 py-1.5 bg-background border border-border rounded-sm text-xs"
                          />
                          <input
                            value={certifyTitle}
                            onChange={(e) => setCertifyTitle(e.target.value)}
                            placeholder="Title"
                            className="px-2 py-1.5 bg-background border border-border rounded-sm text-xs"
                          />
                        </div>
                        <label className="flex items-start gap-2 text-[11px] text-foreground">
                          <input
                            type="checkbox"
                            checked={certifyAck}
                            onChange={(e) => setCertifyAck(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>
                            I certify that I am authorized to negotiate and bind the offeror, and that
                            all representations, certifications, and pricing in this offer are accurate
                            and current as of the submission date.
                          </span>
                        </label>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => approve(i)}
                        disabled={
                          !unblocked ||
                          (!isCertify && !ready) ||
                          (isCertify && (!certifyName.trim() || !certifyAck))
                        }
                        className="px-3 py-1 bg-success text-success-foreground rounded-sm font-bold text-[10px] uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isCertify ? "Certify & Approve" : "Approve"}
                      </button>
                      <button
                        onClick={() => markInReview(i)}
                        disabled={!unblocked}
                        className="px-3 py-1 bg-warning text-background rounded-sm font-bold text-[10px] uppercase tracking-widest hover:opacity-90 disabled:opacity-40"
                      >
                        Mark In Review
                      </button>
                      <button
                        onClick={() => requestChanges(i)}
                        disabled={!unblocked}
                        className="px-3 py-1 bg-destructive text-destructive-foreground rounded-sm font-bold text-[10px] uppercase tracking-widest hover:opacity-90 disabled:opacity-40"
                      >
                        Request Changes
                      </button>
                      <button
                        onClick={() => reset(i)}
                        className="px-3 py-1 bg-muted text-foreground border border-border rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-muted/80"
                      >
                        Reset
                      </button>
                      {!unblocked && (
                        <span className="text-[10px] font-mono text-muted-foreground self-center">
                          Prior gates must approve first
                        </span>
                      )}
                      {unblocked && !ready && !isCertify && (
                        <span className="text-[10px] font-mono text-warning self-center">
                          Deliverables not finalized
                        </span>
                      )}
                    </div>

                    {/* Comments / audit trail */}
                    <div className="border border-border rounded-sm bg-surface">
                      <div className="px-3 py-2 border-b border-border text-[10px] font-mono uppercase text-muted-foreground">
                        Comments & audit trail ({g.comments.length})
                      </div>
                      <ul className="divide-y divide-border max-h-48 overflow-y-auto">
                        {g.comments.length === 0 && (
                          <li className="px-3 py-2 text-[11px] text-muted-foreground italic">
                            No comments yet.
                          </li>
                        )}
                        {g.comments.map((c) => (
                          <li key={c.id} className="px-3 py-2 text-xs">
                            <div className="text-[10px] font-mono text-muted-foreground">
                              {c.author} · {fmtTime(c.ts)}
                            </div>
                            <div className="text-foreground">{c.text}</div>
                          </li>
                        ))}
                      </ul>
                      <div className="p-2 border-t border-border flex gap-2">
                        <input
                          value={draftComment[i] ?? ""}
                          onChange={(e) =>
                            setDraftComment((p) => ({ ...p, [i]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") addComment(i);
                          }}
                          placeholder="Add a review note…"
                          className="flex-1 px-2 py-1 bg-background border border-border rounded-sm text-xs"
                        />
                        <button
                          onClick={() => addComment(i)}
                          className="px-3 py-1 border border-border rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-muted"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </Panel>

      {allApproved ? (
        <div className="mt-6 p-4 border border-success/30 bg-success/5 rounded-sm text-xs text-foreground">
          <span className="font-bold">All gates approved.</span> The eOffer package is ready for export.{" "}
          <Link to="/export" className="text-primary underline">
            Build the final package →
          </Link>
        </div>
      ) : (
        <div className="mt-6 p-4 border border-warning/30 bg-warning/5 rounded-sm text-xs text-foreground">
          <span className="font-bold">Export blocked.</span> {gates.length - approvedCount} gate
          {gates.length - approvedCount === 1 ? "" : "s"} still need approval before the eOffer package
          can be exported.
        </div>
      )}

      <div className="mt-3 p-4 border border-border bg-surface rounded-sm text-[11px] text-muted-foreground">
        <span className="font-bold text-foreground">Note:</span> ScheduleBuilder prepares an eOffer-ready
        package but does not submit on behalf of the offeror. The Authorized Negotiator must certify and
        submit through eOffer.
      </div>
    </>
  );
}
