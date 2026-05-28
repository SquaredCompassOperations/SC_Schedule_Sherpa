import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { FileUploader } from "@/components/file-uploader";
import { extractBusinessIdentity } from "@/lib/intake-extract.functions";
import { fetchDriveFile, listDriveFiles, type GDriveFile } from "@/lib/gdrive.functions";


export const Route = createFileRoute("/intake")({
  head: () => ({ meta: [{ title: "Client Intake — ScheduleBuilder" }] }),
  component: IntakePage,
});

const STEPS = [
  "Business Identity",
  "SAM & Registrations",
  "Authorized Negotiators",
  "Socioeconomic Status",
  "Corporate Experience",
  "Financials & Policies",
  "Past Performance",
  "Pricing Inputs",
];

type FieldDef = { key: string; label: string; type?: "text" | "textarea"; hint?: string };

const FIELD_SETS: FieldDef[][] = [
  [
    { key: "legalName", label: "Legal Business Name" },
    { key: "uei", label: "UEI", hint: "12-character SAM.gov UEI" },
    { key: "cage", label: "CAGE Code" },
    { key: "ein", label: "EIN" },
    { key: "naicsPrimary", label: "Primary NAICS" },
    { key: "employees", label: "Employee Count" },
  ],
  [
    { key: "samStatus", label: "SAM.gov Status" },
    { key: "samExpires", label: "SAM.gov Expiration" },
    { key: "fasId", label: "FAS ID", hint: "Required for eOffer portal" },
    { key: "eOfferCert", label: "eOffer Digital Cert" },
  ],
  [
    { key: "negName", label: "Negotiator Name" },
    { key: "negTitle", label: "Title" },
    { key: "negEmail", label: "Email" },
    { key: "negPhone", label: "Phone" },
  ],
  [
    { key: "socio", label: "Socioeconomic Status", hint: "SDVOSB, WOSB, HUBZone, 8(a)…" },
    { key: "sbaDate", label: "SBA Verification Date" },
  ],
  [
    { key: "yearsInBusiness", label: "Years in Business" },
    { key: "largestContract", label: "Largest Commercial Contract" },
    { key: "corpOverview", label: "Corporate Overview", type: "textarea" },
  ],
  [
    { key: "pnl", label: "P&L Uploaded" },
    { key: "balanceSheet", label: "Balance Sheet Uploaded" },
    { key: "accountingSystem", label: "Accounting System" },
    { key: "uotPolicy", label: "Uncompensated Overtime Policy" },
  ],
  [
    { key: "ppRefs", label: "Past Performance References", hint: "Min 2 references per SIN" },
    { key: "cpars", label: "CPARS Available" },
  ],
  [
    { key: "cplSource", label: "Commercial Price List Source" },
    { key: "mfcDiscount", label: "Most Favored Customer Discount" },
    { key: "gsaDiscount", label: "Proposed GSA Discount" },
  ],
];

function IntakePage() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});

  const setValue = (k: string, v: string) =>
    setValues((cur) => ({ ...cur, [k]: v }));

  return (
    <>
      <PageHeader
        eyebrow="Master Intake Record"
        title="Client Intake Portal"
        description="Enter once, populate everywhere. This intake feeds the SIN engine, document generator, pricing workbook, compliance matrix, and eOffer export."
      />

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-3">
          <Panel title={`Step ${step + 1} of ${STEPS.length}`}>
            <ol className="space-y-1">
              {STEPS.map((s, i) => (
                <li key={s}>
                  <button
                    onClick={() => setStep(i)}
                    className={`w-full text-left flex items-center gap-3 px-2 py-1.5 rounded-sm text-xs transition-colors ${
                      i === step
                        ? "bg-primary/10 text-primary font-medium"
                        : i < step
                          ? "text-foreground"
                          : "text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className={`size-5 rounded-full font-mono text-[10px] flex items-center justify-center shrink-0 ${
                        i < step
                          ? "bg-success text-success-foreground"
                          : i === step
                            ? "bg-primary text-primary-foreground"
                            : "border border-border"
                      }`}
                    >
                      {i < step ? "✓" : i + 1}
                    </span>
                    {s}
                  </button>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>

        <div className="col-span-12 lg:col-span-9">
          <Panel title={STEPS[step]}>
            {step === 0 ? (
              <IdentityExtractor onExtracted={(f) => setValues((cur) => ({ ...cur, ...f }))} />
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {FIELD_SETS[step]?.map((f) => (
                <Field
                  key={f.key}
                  def={f}
                  value={values[f.key] ?? ""}
                  onChange={(v) => setValue(f.key, v)}
                />
              ))}
            </div>

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
              <button
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                className="text-xs font-medium px-4 py-2 border border-border rounded-sm hover:bg-muted disabled:opacity-30"
              >
                ← Previous
              </button>
              <div className="text-[10px] font-mono text-muted-foreground">
                Auto-saved 2s ago
              </div>
              <button
                onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}
                className="text-xs font-bold uppercase tracking-widest px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90"
              >
                Save & Continue →
              </button>
            </div>
          </Panel>

          <div className="mt-6">
            <Panel
              title="Supporting Documents"
              trailing={
                <span className="text-[10px] font-mono text-muted-foreground">
                  Word · PDF · Excel · CSV · PPT · RTF · Images · Email · ZIP · XML/JSON
                </span>
              }
            >
              <FileUploader />
              <div className="mt-3 text-[10px] font-mono text-muted-foreground">
                Uploads feed the master record and become source artifacts for the compliance matrix and eOffer package.
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({
  def,
  value,
  onChange,
}: {
  def: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
        {def.label}
      </label>
      {def.type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-border bg-background rounded-sm focus:outline-none focus:ring-1 focus:ring-primary h-24"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-border bg-background rounded-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
        />
      )}
      {def.hint ? <div className="text-[10px] text-muted-foreground mt-1">{def.hint}</div> : null}
    </div>
  );
}

const EXTRACT_ACCEPT = ".pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg,.tif,.tiff";
const EXTRACT_MAX_BYTES = 12 * 1024 * 1024;

function IdentityExtractor({
  onExtracted,
}: {
  onExtracted: (fields: Record<string, string>) => void;
}) {
  const extract = useServerFn(extractBusinessIdentity);
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "working"; name: string }
    | { kind: "done"; name: string; count: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const handle = async (file: File) => {
    if (file.size > EXTRACT_MAX_BYTES) {
      setStatus({ kind: "error", message: "File exceeds 12 MB limit for extraction." });
      return;
    }
    setStatus({ kind: "working", name: file.name });
    try {
      const buf = await file.arrayBuffer();
      // base64 encode in chunks to avoid call-stack overflows on large files
      const bytes = new Uint8Array(buf);
      let binary = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const dataBase64 = btoa(binary);
      const res = await extract({
        data: {
          filename: file.name,
          mediaType: file.type || "application/octet-stream",
          dataBase64,
        },
      });
      const count = Object.keys(res.fields).length;
      if (count === 0) {
        setStatus({
          kind: "error",
          message: "No business identity fields could be extracted from this document.",
        });
        return;
      }
      onExtracted(res.fields);
      setStatus({ kind: "done", name: file.name, count });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Extraction failed.",
      });
    }
  };

  return (
    <div className="mb-6 border border-dashed border-primary/40 bg-primary/5 rounded-sm p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-widest text-foreground">
            Auto-fill from document
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Upload an SF-form, SAM.gov registration, W-9, capability statement, or
            similar document. We&apos;ll extract the business identity fields below.
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1">
            PDF · DOC/DOCX · TXT · RTF · PNG · JPG · TIF · max 12 MB
          </div>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={status.kind === "working"}
          className="shrink-0 text-xs font-bold uppercase tracking-widest px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
        >
          {status.kind === "working" ? "Extracting…" : "Upload & Extract"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={EXTRACT_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handle(f);
            e.target.value = "";
          }}
        />
      </div>

      {status.kind === "working" ? (
        <div className="mt-3 text-[11px] font-mono text-muted-foreground">
          Reading {status.name}…
        </div>
      ) : null}
      {status.kind === "done" ? (
        <div className="mt-3 text-[11px] font-mono text-success">
          ✓ Extracted {status.count} field{status.count === 1 ? "" : "s"} from {status.name}
        </div>
      ) : null}
      {status.kind === "error" ? (
        <div className="mt-3 text-[11px] font-mono text-destructive">
          {status.message}
        </div>
      ) : null}
    </div>
  );
}
