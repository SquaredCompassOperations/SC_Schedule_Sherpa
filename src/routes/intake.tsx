import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { extractBusinessIdentity } from "@/lib/intake-extract.functions";
import { fetchDriveFile, listDriveFiles, type GDriveFile } from "@/lib/gdrive.functions";
import { detectPnlLoss } from "@/lib/financials-check.functions";
import { lookupSbaCertifications, extractSbaCertsFromImage } from "@/lib/sba-lookup.functions";
import {
  DOC_LABELS,
  PAST_PERFORMANCE_CATEGORIES,
  addNegotiator,
  addPastPerformance,
  patchCompanyAddress,
  patchCorporate,
  patchMailingAddress,
  removeNegotiator,
  removePastPerformance,
  setDocument,
  setMailingSame,
  setNegotiator,
  setSbaCerts,
  useIntake,
  type Address,
  type CorporateInfo,
  type DocEntry,
  type DocKey,
  type Negotiator,
  type PastPerformanceCategory,
} from "@/lib/intake-store";

export const Route = createFileRoute("/intake")({
  head: () => ({ meta: [{ title: "Client Intake — ScheduleBuilder" }] }),
  component: IntakePage,
});

const STEPS = [
  { id: 0, label: "Corporate Information" },
  { id: 1, label: "Corporate Documents" },
  { id: 2, label: "Authorized Negotiators" },
  { id: 3, label: "Socioeconomic Status" },
];

function IntakePage() {
  const [step, setStep] = useState(0);
  const intake = useIntake();

  return (
    <>
      <PageHeader
        eyebrow="Module 1 • Intake & Readiness"
        title="Client Intake"
        description="SC uploads the client's SAM.gov profile to pre-populate Corporate Information, then completes documents, authorized negotiators, and confirms socioeconomic status."
      />

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-3">
          <Panel title={`Step ${step + 1} of ${STEPS.length}`}>
            <ol className="space-y-1">
              {STEPS.map((s, i) => (
                <li key={s.id}>
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
                    {s.label}
                  </button>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>

        <div className="col-span-12 lg:col-span-9">
          <Panel title={STEPS[step].label}>
            {step === 0 ? <CorporateInfoStep intake={intake} /> : null}
            {step === 1 ? <CorporateDocumentsStep intake={intake} /> : null}
            {step === 2 ? <NegotiatorsStep intake={intake} /> : null}
            {step === 3 ? <SocioeconomicStep intake={intake} /> : null}

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
              <button
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                className="text-xs font-medium px-4 py-2 border border-border rounded-sm hover:bg-muted disabled:opacity-30"
              >
                ← Previous
              </button>
              <div className="text-[10px] font-mono text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </div>
              <button
                onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}
                disabled={step === STEPS.length - 1}
                className="text-xs font-bold uppercase tracking-widest px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-30"
              >
                Save & Continue →
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Step 1 — Corporate Information
// ============================================================================

const CORP_FIELDS: { key: keyof CorporateInfo; label: string; hint?: string }[] = [
  { key: "uei", label: "UEI Number", hint: "12-character SAM.gov UEI" },
  { key: "cageCode", label: "CAGE Code", hint: "5-char CAGE/NCAGE from SAM.gov" },
  { key: "orgType", label: "Type of Organization" },
  { key: "parentUei", label: "Common Parent UEI Number" },
  { key: "legalName", label: "Company Name" },
  { key: "dba", label: "Doing Business As (DBA)" },
  { key: "ein", label: "EIN" },
  { key: "businessTypes", label: "Business Types registered in SAM" },
  { key: "samStatus", label: "SAM Status" },
  { key: "samExpires", label: "SAM Expiration Date" },
  { key: "website", label: "Business Website" },
  { key: "naicsPrimary", label: "Primary NAICS" },
  { key: "entityStartDate", label: "Entity Start Date", hint: "Used to derive Years in Business" },
  { key: "yearsInBusiness", label: "Years in Business" },
];

function CorporateInfoStep({ intake }: { intake: ReturnType<typeof useIntake> }) {
  return (
    <div className="space-y-6">
      <SamProfileExtractor />

      <div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Company Details
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {CORP_FIELDS.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              hint={f.hint}
              value={intake.corporate[f.key] ?? ""}
              onChange={(v) => patchCorporate({ [f.key]: v } as Partial<CorporateInfo>)}
            />
          ))}
        </div>
      </div>

      <AddressBlock
        label="Company Address"
        value={intake.companyAddress}
        onChange={patchCompanyAddress}
      />

      <div>
        <label className="flex items-center gap-2 text-xs text-foreground mb-3">
          <input
            type="checkbox"
            checked={intake.mailingSame}
            onChange={(e) => setMailingSame(e.target.checked)}
          />
          Mailing address is the same as the company address
        </label>
        {!intake.mailingSame ? (
          <AddressBlock
            label="Mailing Address"
            value={intake.mailingAddress}
            onChange={patchMailingAddress}
          />
        ) : null}
      </div>
    </div>
  );
}

function AddressBlock({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Address;
  onChange: (patch: Partial<Address>) => void;
}) {
  const fields: { key: keyof Address; label: string }[] = [
    { key: "street1", label: "Street 1" },
    { key: "street2", label: "Street 2" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "zip", label: "Zip / Postal Code" },
    { key: "country", label: "Country" },
  ];
  return (
    <div>
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
        {label}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {fields.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            value={value[f.key]}
            onChange={(v) => onChange({ [f.key]: v } as Partial<Address>)}
          />
        ))}
      </div>
    </div>
  );
}

// SAM profile extractor — uploads PDF/Drive doc, runs Gemini extraction, pushes
// into intake store (including addresses).
const EXTRACT_ACCEPT = ".pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg,.tif,.tiff";
const EXTRACT_MAX_BYTES = 12 * 1024 * 1024;

function SamProfileExtractor() {
  const extract = useServerFn(extractBusinessIdentity);
  const fetchDrive = useServerFn(fetchDriveFile);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showDrive, setShowDrive] = useState(false);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "working"; name: string }
    | { kind: "done"; name: string; count: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const apply = (fields: Record<string, string>) => {
    const corp: Partial<CorporateInfo> = {};
    const addr: Partial<Address> = {};
    const mail: Partial<Address> = {};
    const map: Record<string, [Record<string, unknown>, string]> = {
      uei: [corp, "uei"],
      orgType: [corp, "orgType"],
      parentUei: [corp, "parentUei"],
      legalName: [corp, "legalName"],
      dba: [corp, "dba"],
      ein: [corp, "ein"],
      businessTypes: [corp, "businessTypes"],
      samStatus: [corp, "samStatus"],
      samExpires: [corp, "samExpires"],
      website: [corp, "website"],
      naicsPrimary: [corp, "naicsPrimary"],
      entityStartDate: [corp, "entityStartDate"],
      addrStreet1: [addr, "street1"],
      addrStreet2: [addr, "street2"],
      addrCity: [addr, "city"],
      addrState: [addr, "state"],
      addrZip: [addr, "zip"],
      addrCountry: [addr, "country"],
      mailStreet1: [mail, "street1"],
      mailStreet2: [mail, "street2"],
      mailCity: [mail, "city"],
      mailState: [mail, "state"],
      mailZip: [mail, "zip"],
      mailCountry: [mail, "country"],
    };
    for (const [k, v] of Object.entries(fields)) {
      const target = map[k];
      if (target) (target[0] as Record<string, string>)[target[1]] = v;
    }
    if (Object.keys(corp).length) patchCorporate(corp);
    if (Object.keys(addr).length) patchCompanyAddress(addr);
    if (Object.keys(mail).length) {
      patchMailingAddress(mail);
      setMailingSame(false);
    }
  };

  const runExtraction = async (payload: {
    filename: string;
    mediaType: string;
    dataBase64: string;
  }) => {
    setStatus({ kind: "working", name: payload.filename });
    try {
      const res = await extract({ data: payload });
      const count = Object.keys(res.fields).length;
      if (count === 0) {
        setStatus({
          kind: "error",
          message: "No fields could be extracted from this document.",
        });
        return;
      }
      apply(res.fields);
      setStatus({ kind: "done", name: payload.filename, count });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Extraction failed.",
      });
    }
  };

  const handle = async (file: File) => {
    if (file.size > EXTRACT_MAX_BYTES) {
      setStatus({ kind: "error", message: "File exceeds 12 MB limit." });
      return;
    }
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    await runExtraction({
      filename: file.name,
      mediaType: file.type || "application/octet-stream",
      dataBase64: btoa(binary),
    });
  };

  const handleDrivePick = async (file: GDriveFile) => {
    setShowDrive(false);
    setStatus({ kind: "working", name: file.name });
    try {
      const payload = await fetchDrive({ data: { fileId: file.id } });
      await runExtraction(payload);
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Drive import failed.",
      });
    }
  };

  return (
    <div className="border border-dashed border-primary/40 bg-primary/5 rounded-sm p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-widest text-foreground">
            Upload SAM.gov Profile
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Upload the client's SAM.gov entity registration printout to auto-fill
            Company Details, addresses, and SAM status.
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1">
            PDF · DOC/DOCX · TXT · RTF · PNG · JPG · TIF · max 12 MB
          </div>
        </div>
        <div className="shrink-0 flex gap-2">
          <button
            onClick={() => setShowDrive(true)}
            disabled={status.kind === "working"}
            className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-border bg-background rounded-sm hover:bg-muted disabled:opacity-50"
          >
            ⛁ From Drive
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={status.kind === "working"}
            className="text-xs font-bold uppercase tracking-widest px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {status.kind === "working" ? "Extracting…" : "Upload & Extract"}
          </button>
        </div>
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
        <div className="mt-3 text-[11px] font-mono text-destructive">{status.message}</div>
      ) : null}
      {showDrive ? (
        <DrivePicker onPick={handleDrivePick} onClose={() => setShowDrive(false)} />
      ) : null}
    </div>
  );
}

// ============================================================================
// Step 2 — Corporate Documents
// ============================================================================

const DOC_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.rtf,.txt,.png,.jpg,.jpeg,.tif,.tiff,.zip,.json,.xml,.msg,.eml,.odt,.ods,.md";

const DOC_ORDER: DocKey[] = [
  "compensationPlan",
  "uotPolicy",
  "corporatePriceList",
  "pnlYear1",
  "pnlYear2",
  "balanceYear1",
  "balanceYear2",
];

function CorporateDocumentsStep({ intake }: { intake: ReturnType<typeof useIntake> }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-muted-foreground mb-3">
        Check off each item; upload the corresponding file. Uploads feed the master
        record and become source artifacts for the compliance matrix and eOffer
        package.
      </div>
      {DOC_ORDER.map((k) => (
        <DocRow key={k} docKey={k} entry={intake.documents[k]} />
      ))}
      <PastPerformanceSection entries={intake.pastPerformance} />
    </div>
  );
}

function PastPerformanceSection({
  entries,
}: {
  entries: ReturnType<typeof useIntake>["pastPerformance"];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<PastPerformanceCategory>(
    PAST_PERFORMANCE_CATEGORIES[0],
  );

  const handle = (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      addPastPerformance({
        filename: f.name,
        size: f.size,
        uploadedAt: Date.now(),
        category,
      });
    }
  };

  return (
    <div className="mt-4 p-3 border border-border rounded-sm bg-card space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={entries.length > 0}
          readOnly
          className="shrink-0"
          aria-label="Past Performance Information"
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-foreground">Past Performance Information</div>
          <div className="text-[10px] font-mono text-muted-foreground">
            Capability Statement(s), Case Studies, References, Project Experience, CPARS.
            Multiple files allowed.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PastPerformanceCategory)}
          className="text-[11px] font-mono px-2 py-1.5 border border-border rounded-sm bg-background"
        >
          {PAST_PERFORMANCE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={() => inputRef.current?.click()}
          className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border bg-background rounded-sm hover:bg-muted"
        >
          Upload File(s)
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={DOC_ACCEPT}
          className="hidden"
          onChange={(e) => {
            handle(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {entries.length > 0 ? (
        <div className="border border-border rounded-sm divide-y divide-border bg-background">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-3 py-2 text-xs">
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground w-32 shrink-0">
                {e.category}
              </span>
              <span className="flex-1 truncate font-mono">{e.filename}</span>
              <span className="text-[10px] font-mono text-muted-foreground w-16 text-right">
                {(e.size / 1024).toFixed(0)} KB
              </span>
              <button
                onClick={() => removePastPerformance(e.id)}
                className="text-[10px] font-mono text-muted-foreground hover:text-destructive"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[10px] font-mono text-muted-foreground">No files uploaded.</div>
      )}
    </div>
  );
}

function DocRow({ docKey, entry }: { docKey: DocKey; entry?: DocEntry }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const checkLoss = useServerFn(detectPnlLoss);
  const [analyzing, setAnalyzing] = useState(false);
  const isPnl = docKey === "pnlYear1" || docKey === "pnlYear2";

  const handle = async (file: File) => {
    const entry: DocEntry = {
      filename: file.name,
      size: file.size,
      uploadedAt: Date.now(),
    };

    if (isPnl && file.size <= EXTRACT_MAX_BYTES) {
      // Async loss detection — don't block the upload toggle.
      setAnalyzing(true);
      try {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        const CHUNK = 0x8000;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        const res = await checkLoss({
          data: {
            filename: file.name,
            mediaType: file.type || "application/octet-stream",
            dataBase64: btoa(binary),
          },
        });
        entry.loss = res.loss;
      } catch {
        entry.loss = null;
      } finally {
        setAnalyzing(false);
      }
    }

    setDocument(docKey, entry);
  };

  return (
    <div className="flex items-center gap-3 p-3 border border-border rounded-sm bg-card">
      <input
        type="checkbox"
        checked={!!entry}
        readOnly
        className="shrink-0"
        aria-label={DOC_LABELS[docKey]}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground">{DOC_LABELS[docKey]}</div>
        {entry ? (
          <div className="text-[10px] font-mono text-muted-foreground truncate">
            {entry.filename} · {(entry.size / 1024).toFixed(0)} KB
            {isPnl && entry.loss === true ? (
              <span className="ml-2 text-destructive">⚠ Net loss detected</span>
            ) : null}
            {isPnl && entry.loss === false ? (
              <span className="ml-2 text-success">✓ Profitable</span>
            ) : null}
            {analyzing ? <span className="ml-2">Analyzing…</span> : null}
          </div>
        ) : (
          <div className="text-[10px] font-mono text-muted-foreground">Not uploaded</div>
        )}
      </div>
      {entry ? (
        <button
          onClick={() => setDocument(docKey, null)}
          className="text-[10px] font-mono text-muted-foreground hover:text-destructive px-2 py-1"
        >
          Remove
        </button>
      ) : null}
      <button
        onClick={() => inputRef.current?.click()}
        className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border bg-background rounded-sm hover:bg-muted"
      >
        {entry ? "Replace" : "Upload"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={DOC_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ============================================================================
// Step 3 — Authorized Negotiators
// ============================================================================

function NegotiatorsStep({ intake }: { intake: ReturnType<typeof useIntake> }) {
  return (
    <div className="space-y-5">
      <div className="text-[11px] text-muted-foreground">
        Add up to four authorized negotiators. The first negotiator is the Primary
        contact. Either US Phone (XXX-XXX-XXXX) or International Phone is required.
      </div>
      {intake.negotiators.map((n, i) => (
        <NegotiatorCard
          key={i}
          index={i}
          negotiator={n}
          primary={i === 0}
          canRemove={intake.negotiators.length > 1}
        />
      ))}
      {intake.negotiators.length < 4 ? (
        <button
          onClick={addNegotiator}
          className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-border bg-background rounded-sm hover:bg-muted"
        >
          + Add Negotiator
        </button>
      ) : (
        <div className="text-[10px] font-mono text-muted-foreground">
          Maximum of 4 negotiators reached.
        </div>
      )}
    </div>
  );
}

function NegotiatorCard({
  index,
  negotiator,
  primary,
  canRemove,
}: {
  index: number;
  negotiator: Negotiator;
  primary: boolean;
  canRemove: boolean;
}) {
  const fields: { key: keyof Negotiator; label: string; hint?: string }[] = [
    { key: "name", label: "Name" },
    { key: "title", label: "Title" },
    { key: "email", label: "Email" },
    { key: "phoneUs", label: "Phone (US)", hint: "XXX-XXX-XXXX" },
    { key: "phoneIntl", label: "Phone (International)", hint: "Free-form" },
    { key: "faxUs", label: "Fax (US)" },
    { key: "faxIntl", label: "Fax (International)" },
  ];
  return (
    <div className="border border-border rounded-sm p-4 bg-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-xs font-bold uppercase tracking-widest">
            Negotiator {index + 1}
          </div>
          {primary ? (
            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/30 rounded-sm">
              Primary
            </span>
          ) : null}
        </div>
        {canRemove ? (
          <button
            onClick={() => removeNegotiator(index)}
            className="text-[10px] font-mono text-muted-foreground hover:text-destructive"
          >
            Remove
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {fields.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            hint={f.hint}
            value={(negotiator[f.key] as string) ?? ""}
            onChange={(v) => setNegotiator(index, { [f.key]: v } as Partial<Negotiator>)}
          />
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs mt-4">
        <input
          type="checkbox"
          checked={negotiator.authorizedToSign}
          onChange={(e) => setNegotiator(index, { authorizedToSign: e.target.checked })}
        />
        Authorized to sign
      </label>
    </div>
  );
}

// ============================================================================
// Step 4 — Socioeconomic Status
// ============================================================================

function SocioeconomicStep({ intake }: { intake: ReturnType<typeof useIntake> }) {
  const lookup = useServerFn(lookupSbaCertifications);
  const extractImg = useServerFn(extractSbaCertsFromImage);
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "working"; via: "scan" | "image" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const run = async () => {
    if (!intake.corporate.uei) {
      setStatus({ kind: "error", message: "Enter the UEI in Step 1 first." });
      return;
    }
    setStatus({ kind: "working", via: "scan" });
    try {
      const res = await lookup({ data: { uei: intake.corporate.uei } });
      setSbaCerts(res.certs);
      if (res.error) {
        setStatus({
          kind: "error",
          message: `${res.error}. Try uploading a screenshot of the SBA profile row instead.`,
        });
      } else if (res.certs.length === 0) {
        setStatus({
          kind: "error",
          message:
            "Scan returned no certifications. If the SBA profile shows some, upload a screenshot below.",
        });
      } else {
        setStatus({ kind: "idle" });
      }
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "SBA lookup failed.",
      });
    }
  };

  const onImage = async (file: File | null) => {
    if (!file) return;
    setStatus({ kind: "working", via: "image" });
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const dataBase64 = btoa(binary);
      const res = await extractImg({
        data: {
          filename: file.name,
          mediaType: file.type || "image/png",
          dataBase64,
        },
      });
      setSbaCerts(res.certs);
      if (res.error) setStatus({ kind: "error", message: res.error });
      else if (res.certs.length === 0)
        setStatus({ kind: "error", message: "No certifications detected in the image." });
      else setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Image extraction failed.",
      });
    }
  };


  return (
    <div className="space-y-5">
      <div className="border border-dashed border-primary/40 bg-primary/5 rounded-sm p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-widest text-foreground">
              SBA Small Business Search
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Scans{" "}
              <a
                href="https://search.certifications.sba.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                search.certifications.sba.gov
              </a>{" "}
              using the UEI from Step 1 and parses active SBA certifications.
            </div>
            <div className="text-[10px] font-mono text-muted-foreground mt-1">
              UEI: {intake.corporate.uei || "(not set)"}
            </div>
          </div>
          <button
            onClick={run}
            disabled={status.kind === "working" || !intake.corporate.uei}
            className="shrink-0 text-xs font-bold uppercase tracking-widest px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {status.kind === "working" && status.via === "scan" ? "Scanning…" : "Scan SBA"}
          </button>
        </div>
        {status.kind === "error" ? (
          <div className="mt-3 text-[11px] font-mono text-destructive">{status.message}</div>
        ) : null}

        <div className="mt-4 pt-4 border-t border-primary/20">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Fallback — upload SBA profile screenshot
          </div>
          <div className="text-[11px] text-muted-foreground mb-2">
            If the scan fails or misses certifications, upload a screenshot of the SBA Small
            Business Search result row (with the green badges visible) and we&apos;ll extract them.
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-3 py-2 bg-secondary text-secondary-foreground rounded-sm hover:bg-secondary/80 cursor-pointer">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => onImage(e.target.files?.[0] ?? null)}
              disabled={status.kind === "working"}
            />
            {status.kind === "working" && status.via === "image"
              ? "Extracting…"
              : "Upload screenshot"}
          </label>
        </div>
      </div>


      <div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Active Certifications
        </div>
        {intake.sbaCerts.length === 0 ? (
          <div className="text-[11px] font-mono text-muted-foreground p-4 border border-dashed border-border rounded-sm text-center">
            {intake.sbaScannedAt
              ? "No active SBA certifications detected for this UEI."
              : "Run an SBA scan to populate certifications."}
          </div>
        ) : (
          <ul className="space-y-2">
            {intake.sbaCerts.map((c, i) => (
              <li
                key={`${c.program}-${i}`}
                className="flex items-center justify-between p-3 border border-border rounded-sm bg-card"
              >
                <div>
                  <div className="text-sm font-bold">{c.program}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    Status: {c.status}
                    {c.expiration ? ` · Expires ${c.expiration}` : ""}
                  </div>
                </div>
                <span
                  className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-sm border ${
                    c.status === "Active"
                      ? "bg-success/10 text-success border-success/30"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        {intake.sbaScannedAt ? (
          <div className="text-[10px] font-mono text-muted-foreground mt-2">
            Last scanned {new Date(intake.sbaScannedAt).toLocaleString()}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================================
// Shared field + drive picker
// ============================================================================

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-border bg-background rounded-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
      />
      {hint ? <div className="text-[10px] text-muted-foreground mt-1">{hint}</div> : null}
    </div>
  );
}

function DrivePicker({
  onPick,
  onClose,
}: {
  onPick: (file: GDriveFile) => void;
  onClose: () => void;
}) {
  const listFiles = useServerFn(listDriveFiles);
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<GDriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    const t = setTimeout(async () => {
      try {
        const res = await listFiles({ data: { query: query || undefined } });
        if (!cancelled) setFiles(res.files);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load Drive");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, listFiles]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-background border border-border rounded-sm w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl"
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-widest">
            Import from Google Drive
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ✕
          </button>
        </div>
        <div className="px-4 py-3 border-b border-border">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files by name…"
            className="w-full px-3 py-2 text-sm border border-border bg-background rounded-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-6 text-[11px] font-mono text-muted-foreground text-center">
              Loading…
            </div>
          ) : err ? (
            <div className="p-6 text-[11px] font-mono text-destructive text-center">{err}</div>
          ) : files.length === 0 ? (
            <div className="p-6 text-[11px] font-mono text-muted-foreground text-center">
              No files found.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {files.map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => onPick(f)}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted/50 flex items-center gap-3"
                  >
                    {f.iconLink ? (
                      <img src={f.iconLink} alt="" className="w-4 h-4 shrink-0" />
                    ) : (
                      <span className="w-4 h-4 shrink-0" />
                    )}
                    <span className="text-xs font-mono truncate flex-1">{f.name}</span>
                    <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                      {f.modifiedTime?.slice(0, 10) ?? ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
