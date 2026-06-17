import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef } from "react";
import {
  useIntake,
  setDocument,
  submitClientIntake,
  DOC_LABELS,
  type DocKey,
} from "@/lib/intake-store";
import { useReadiness, readinessStatus } from "@/lib/readiness-store";

export const Route = createFileRoute("/client/documents")({
  head: () => ({ meta: [{ title: "Corporate Documents — ScheduleBuilder" }] }),
  component: ClientDocuments,
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

function DocRow({ docKey }: { docKey: DocKey }) {
  const intake = useIntake();
  const entry = intake.documents[docKey];
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File) => {
    setDocument(docKey, {
      filename: file.name,
      size: file.size,
      uploadedAt: Date.now(),
    });
  };

  return (
    <li className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">{DOC_LABELS[docKey]}</div>
        {entry ? (
          <div className="text-[11px] font-mono text-muted-foreground truncate">
            {entry.filename} · {(entry.size / 1024).toFixed(0)} KB · uploaded{" "}
            {new Date(entry.uploadedAt).toLocaleDateString()}
          </div>
        ) : (
          <div className="text-[11px] font-mono text-warning">Missing</div>
        )}
      </div>
      {entry ? (
        <span className="text-[10px] font-mono uppercase tracking-widest text-success border border-success/40 bg-success/10 px-2 py-0.5 rounded-sm">
          Uploaded
        </span>
      ) : (
        <span className="text-[10px] font-mono uppercase tracking-widest text-warning border border-warning/40 bg-warning/10 px-2 py-0.5 rounded-sm">
          Required
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 border border-border rounded-sm hover:bg-muted"
      >
        {entry ? "Replace" : "Upload"}
      </button>
      {entry && (
        <button
          onClick={() => setDocument(docKey, null)}
          className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 border border-border rounded-sm hover:bg-muted text-destructive"
        >
          Remove
        </button>
      )}
    </li>
  );
}

function ClientDocuments() {
  const intake = useIntake();
  const readiness = useReadiness();
  const navigate = useNavigate();

  const uploadedCount = REQUIRED_DOCS.filter((k) => intake.documents[k]).length;
  const missingCount = REQUIRED_DOCS.length - uploadedCount;
  const readinessDone = readinessStatus(readiness) === "complete";
  const canSubmit = readinessDone && uploadedCount > 0;
  const submitted = intake.clientSubmittedAt != null;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Step 2 — Corporate Documents
        </div>
        <h1 className="text-3xl font-bold mt-1">Upload your corporate documents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload what you have today. You can submit a partial set for our Intake &amp; Readiness
          team to begin review; anything still missing will be requested back from you.
        </p>
      </div>

      {!readinessDone && (
        <div className="border border-warning bg-warning/10 rounded-sm p-4 text-sm">
          Please complete the{" "}
          <Link to="/client/readiness" className="font-bold underline">
            MAS Readiness Assessment
          </Link>{" "}
          first.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border border-border rounded-sm bg-card p-4">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Uploaded</div>
          <div className="text-3xl font-mono font-bold text-success">{uploadedCount}</div>
        </div>
        <div className="border border-border rounded-sm bg-card p-4">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Missing</div>
          <div className={`text-3xl font-mono font-bold ${missingCount === 0 ? "text-success" : "text-warning"}`}>
            {missingCount}
          </div>
        </div>
        <div className="border border-border rounded-sm bg-card p-4">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Status</div>
          <div className={`text-sm font-bold mt-2 ${submitted ? "text-success" : "text-foreground"}`}>
            {submitted ? "Submitted for Intake & Readiness" : "Awaiting submission"}
          </div>
          {submitted && (
            <div className="text-[11px] font-mono text-muted-foreground mt-1">
              {new Date(intake.clientSubmittedAt!).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <div className="border border-border rounded-sm bg-card">
        <div className="px-4 py-3 border-b border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Required documents
        </div>
        <ul>
          {REQUIRED_DOCS.map((k) => (
            <DocRow key={k} docKey={k} />
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="text-xs text-muted-foreground">
          {missingCount > 0
            ? `${missingCount} item${missingCount === 1 ? "" : "s"} still missing — you can still submit what you have.`
            : "All required documents uploaded."}
        </div>
        <button
          onClick={() => {
            submitClientIntake();
            navigate({ to: "/client" });
          }}
          disabled={!canSubmit}
          className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-sm disabled:opacity-40"
        >
          {submitted ? "Re-submit for Intake & Readiness" : "Submit for Intake & Readiness"}
        </button>
      </div>
    </div>
  );
}
