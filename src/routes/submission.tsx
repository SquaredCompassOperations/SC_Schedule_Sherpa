import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, StatusPill } from "@/components/ui-primitives";
import {
  useSubmission,
  setReceipt,
  addEvent,
  removeEvent,
  addEventAttachments,
  removeEventAttachment,
  lockArchive,
  unlockArchive,
  EVENT_KIND_META,
  type TrackerEventKind,
} from "@/lib/submission-store";
import { useEntity } from "@/lib/intake-store";
import { categoryFor } from "@/lib/file-ingest";

export const Route = createFileRoute("/submission")({
  head: () => ({ meta: [{ title: "Submission Tracker — ScheduleBuilder" }] }),
  component: SubmissionPage,
});

function fmt(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const EVENT_KINDS: TrackerEventKind[] = [
  "co_assigned",
  "clarification_requested",
  "clarification_responded",
  "negotiation",
  "final_proposal_revision",
  "awarded",
  "rejected",
  "withdrawn",
  "note",
];

function toneClass(tone: "success" | "warning" | "info" | "destructive" | "muted") {
  switch (tone) {
    case "success":
      return "bg-success/10 text-success border-success/30";
    case "warning":
      return "bg-warning/10 text-warning border-warning/30";
    case "info":
      return "bg-primary/10 text-primary border-primary/30";
    case "destructive":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function SubmissionPage() {
  const sub = useSubmission();
  const entity = useEntity();
  const defaultPoc = entity.pocName || entity.name || "Authorized Negotiator";
  const submitted = !!sub.receipt;
  const awarded = sub.events.some((e) => e.kind === "awarded");

  // Receipt form
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [submittedBy, setSubmittedBy] = useState(defaultPoc);
  const [portal, setPortal] = useState("eOffer.gsa.gov");
  const [notes, setNotes] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);

  // New event form
  const [evKind, setEvKind] = useState<TrackerEventKind>("co_assigned");
  const [evTitle, setEvTitle] = useState("");
  const [evDetail, setEvDetail] = useState("");
  const [evActor, setEvActor] = useState("GSA");
  const [evFiles, setEvFiles] = useState<File[]>([]);

  // Archive form
  const [archiveNotes, setArchiveNotes] = useState("");

  const saveReceipt = () => {
    if (!confirmationNumber.trim()) return;
    setReceipt({
      confirmationNumber: confirmationNumber.trim(),
      submittedAt: Date.now(),
      submittedBy: submittedBy.trim() || defaultPoc,
      portal: portal.trim() || "eOffer.gsa.gov",
      notes: notes.trim(),
      attachmentName: attachment?.name ?? null,
    });
  };

  const clearReceipt = () => {
    if (sub.locked) return;
    setReceipt(null);
  };

  const postEvent = () => {
    if (!evTitle.trim()) return;
    addEvent({
      kind: evKind,
      ts: Date.now(),
      title: evTitle.trim(),
      detail: evDetail.trim(),
      actor: evActor.trim() || "GSA",
      attachments: evFiles.map((f) => ({
        name: f.name,
        size: f.size,
        category: categoryFor(f.name) ?? "Correspondence",
      })),
    });
    setEvTitle("");
    setEvDetail("");
    setEvFiles([]);
  };

  const attachToEvent = (eventId: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    addEventAttachments(
      eventId,
      Array.from(fileList).map((f) => ({
        name: f.name,
        size: f.size,
        category: categoryFor(f.name) ?? "Correspondence",
      })),
    );
  };

  const fmtBytes = (n: number) =>
    n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

  const lock = () => {
    if (!submitted) return;
    lockArchive({
      archivedAt: Date.now(),
      archivedBy: sub.receipt?.submittedBy ?? defaultPoc,
      snapshotName: `eOffer_Snapshot_${(entity.cage !== "—" ? entity.cage : "offer")}_${new Date().toISOString().slice(0, 10)}.zip`,
      notes: archiveNotes.trim(),
    });
    setArchiveNotes("");
  };

  return (
    <>
      <PageHeader
        eyebrow="Final Step • Post-Submission"
        title="Submission Tracker"
        description="Capture the eOffer confirmation, log post-submission activity from the GSA contracting officer, and lock the offer once a final disposition is reached."
        actions={
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Status</div>
              <div
                className={`text-sm font-bold ${
                  awarded
                    ? "text-success"
                    : submitted
                      ? "text-primary"
                      : "text-muted-foreground"
                }`}
              >
                {awarded ? "Awarded" : submitted ? "Submitted" : "Not Submitted"}
              </div>
            </div>
            {sub.locked && (
              <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest bg-success/10 text-success border border-success/30 rounded-sm">
                Locked
              </span>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        {/* LEFT — receipt + tracker */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Receipt */}
          <Panel
            title="Submission Receipt"
            trailing={
              submitted ? (
                <StatusPill status="complete" />
              ) : (
                <StatusPill status="pending" />
              )
            }
          >
            {!submitted ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  After uploading the package on{" "}
                  <a
                    href="https://eoffer.gsa.gov"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    eOffer.gsa.gov
                  </a>
                  , capture the confirmation here. This advances the Status Tracker to{" "}
                  <span className="font-bold">Submitted</span>.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Confirmation #">
                    <input
                      value={confirmationNumber}
                      onChange={(e) => setConfirmationNumber(e.target.value)}
                      placeholder="e.g. eO-2026-0049213"
                      className="w-full px-2 py-1.5 bg-background border border-border rounded-sm text-xs font-mono"
                    />
                  </Field>
                  <Field label="Portal">
                    <input
                      value={portal}
                      onChange={(e) => setPortal(e.target.value)}
                      className="w-full px-2 py-1.5 bg-background border border-border rounded-sm text-xs font-mono"
                    />
                  </Field>
                  <Field label="Submitted By">
                    <input
                      value={submittedBy}
                      onChange={(e) => setSubmittedBy(e.target.value)}
                      className="w-full px-2 py-1.5 bg-background border border-border rounded-sm text-xs"
                    />
                  </Field>
                  <Field label="Receipt screenshot (optional)">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                      className="w-full text-[10px] file:mr-2 file:py-1 file:px-2 file:border file:border-border file:bg-muted file:text-xs file:font-bold file:uppercase file:rounded-sm"
                    />
                  </Field>
                </div>
                <Field label="Notes">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Anything the CO or portal flagged at upload…"
                    className="w-full px-2 py-1.5 bg-background border border-border rounded-sm text-xs"
                  />
                </Field>
                <button
                  onClick={saveReceipt}
                  disabled={!confirmationNumber.trim()}
                  className="text-xs font-bold uppercase tracking-widest px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Log Submission
                </button>
              </div>
            ) : (
              <div className="space-y-2 text-xs font-mono">
                <Row k="Confirmation #" v={sub.receipt!.confirmationNumber} />
                <Row k="Portal" v={sub.receipt!.portal} />
                <Row k="Submitted At" v={fmt(sub.receipt!.submittedAt)} />
                <Row k="Submitted By" v={sub.receipt!.submittedBy} />
                {sub.receipt!.attachmentName && (
                  <Row k="Receipt File" v={sub.receipt!.attachmentName} />
                )}
                {sub.receipt!.notes && (
                  <div className="border-t border-border/50 pt-2">
                    <div className="text-muted-foreground">Notes</div>
                    <div className="text-foreground whitespace-pre-wrap">{sub.receipt!.notes}</div>
                  </div>
                )}
                {!sub.locked && (
                  <button
                    onClick={clearReceipt}
                    className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 border border-border rounded-sm hover:bg-muted mt-2"
                  >
                    Clear Receipt
                  </button>
                )}
              </div>
            )}
          </Panel>

          {/* Post-submission tracker */}
          <Panel title="Post-Submission Tracker">
            {!submitted ? (
              <p className="text-xs text-muted-foreground">
                Log the submission receipt above to start tracking GSA contracting officer activity.
              </p>
            ) : (
              <>
                {!sub.locked && (
                  <div className="border border-border rounded-sm bg-surface p-3 mb-3 space-y-2">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      Add event
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={evKind}
                        onChange={(e) => setEvKind(e.target.value as TrackerEventKind)}
                        className="px-2 py-1.5 bg-background border border-border rounded-sm text-xs"
                      >
                        {EVENT_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {EVENT_KIND_META[k].label}
                          </option>
                        ))}
                      </select>
                      <input
                        value={evActor}
                        onChange={(e) => setEvActor(e.target.value)}
                        placeholder="Actor (GSA / Team / CO name)"
                        className="px-2 py-1.5 bg-background border border-border rounded-sm text-xs"
                      />
                      <input
                        value={evTitle}
                        onChange={(e) => setEvTitle(e.target.value)}
                        placeholder="Title"
                        className="px-2 py-1.5 bg-background border border-border rounded-sm text-xs"
                      />
                    </div>
                    <textarea
                      value={evDetail}
                      onChange={(e) => setEvDetail(e.target.value)}
                      rows={2}
                      placeholder="Detail (e.g. CO requested clarification on LCAT 0301 mapping)"
                      className="w-full px-2 py-1.5 bg-background border border-border rounded-sm text-xs"
                    />
                    <button
                      onClick={postEvent}
                      disabled={!evTitle.trim()}
                      className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Add Event
                    </button>
                  </div>
                )}

                <ol className="space-y-2">
                  {sub.events.length === 0 && (
                    <li className="text-xs text-muted-foreground italic">No events logged yet.</li>
                  )}
                  {sub.events.map((e) => {
                    const meta = EVENT_KIND_META[e.kind];
                    return (
                      <li
                        key={e.id}
                        className="border border-border rounded-sm bg-surface p-3 flex gap-3"
                      >
                        <div
                          className={`shrink-0 h-fit px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase border rounded-sm ${toneClass(
                            meta.tone,
                          )}`}
                        >
                          {meta.label}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-foreground">{e.title}</div>
                          {e.detail && (
                            <div className="text-xs text-foreground/80 mt-0.5 whitespace-pre-wrap">
                              {e.detail}
                            </div>
                          )}
                          <div className="text-[10px] font-mono text-muted-foreground mt-1">
                            {fmt(e.ts)} · {e.actor}
                          </div>
                        </div>
                        {!sub.locked && (
                          <button
                            onClick={() => removeEvent(e.id)}
                            className="self-start text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive"
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </Panel>
        </div>

        {/* RIGHT — archive/lock + summary */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Panel title="Offer Disposition">
            <ul className="text-xs space-y-2">
              <Disposition label="Submitted" on={submitted} />
              <Disposition
                label="CO Assigned"
                on={sub.events.some((e) => e.kind === "co_assigned")}
              />
              <Disposition
                label="In Negotiation"
                on={sub.events.some(
                  (e) =>
                    e.kind === "clarification_requested" ||
                    e.kind === "negotiation" ||
                    e.kind === "final_proposal_revision",
                )}
              />
              <Disposition label="Awarded" on={awarded} tone="success" />
              <Disposition
                label="Rejected"
                on={sub.events.some((e) => e.kind === "rejected")}
                tone="destructive"
              />
            </ul>
          </Panel>

          <Panel title="Archive & Lock">
            {sub.locked ? (
              <div className="space-y-2 text-xs">
                <div className="border border-success/30 bg-success/5 rounded-sm p-3">
                  <div className="font-bold text-success uppercase text-[10px] tracking-widest mb-1">
                    Offer Locked
                  </div>
                  <div className="font-mono text-foreground break-all">
                    {sub.archive!.snapshotName}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground mt-1">
                    {fmt(sub.archive!.archivedAt)} · {sub.archive!.archivedBy}
                  </div>
                  {sub.archive!.notes && (
                    <div className="text-xs mt-2 whitespace-pre-wrap">{sub.archive!.notes}</div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Upstream modules are read-only against this snapshot. Unlock only if a contract
                  modification or post-award refresh is authorized.
                </p>
                <button
                  onClick={unlockArchive}
                  className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm hover:bg-muted"
                >
                  Unlock for Modification
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Once the offer reaches final disposition (award, rejection, or withdrawal),
                  archive the package to lock all modules as read-only and create an immutable
                  audit snapshot.
                </p>
                <textarea
                  value={archiveNotes}
                  onChange={(e) => setArchiveNotes(e.target.value)}
                  rows={2}
                  placeholder="Disposition note (e.g. Awarded under contract GS-35F-1234X)…"
                  className="w-full px-2 py-1.5 bg-background border border-border rounded-sm text-xs"
                />
                <button
                  onClick={lock}
                  disabled={!submitted}
                  className="w-full text-xs font-bold uppercase tracking-widest px-3 py-2 bg-success text-success-foreground rounded-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Archive & Lock Offer
                </button>
                {!submitted && (
                  <div className="text-[10px] font-mono text-muted-foreground">
                    Log a submission receipt to enable archiving.
                  </div>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Next Steps">
            <ol className="text-xs space-y-2 list-decimal list-inside text-foreground">
              <li>
                Watch{" "}
                <a
                  href="https://eoffer.gsa.gov"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  eOffer
                </a>{" "}
                inbox for CO assignment
              </li>
              <li>Log every clarification request &amp; response above</li>
              <li>On award, file the contract # under Awarded event</li>
              <li>Archive &amp; lock to freeze the offer record</li>
            </ol>
            <div className="border-t border-border mt-3 pt-3">
              <Link
                to="/export"
                className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
              >
                ← Back to Export
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border/50 py-1.5 gap-3">
      <span className="text-muted-foreground shrink-0">{k}</span>
      <span className="font-bold text-foreground text-right break-all">{v}</span>
    </div>
  );
}

function Disposition({
  label,
  on,
  tone = "info",
}: {
  label: string;
  on: boolean;
  tone?: "info" | "success" | "destructive";
}) {
  const color = on
    ? tone === "success"
      ? "bg-success"
      : tone === "destructive"
        ? "bg-destructive"
        : "bg-primary"
    : "border border-border";
  return (
    <li className="flex items-center gap-2">
      <span className={`size-2 rounded-full ${color}`} />
      <span className={on ? "text-foreground font-bold" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}
