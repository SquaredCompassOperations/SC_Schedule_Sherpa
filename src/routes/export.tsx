import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import JSZip from "jszip";
import { PageHeader, Panel, StatusPill } from "@/components/ui-primitives";
import { COMPLIANCE_MATRIX, EXPORT_BUNDLE, CLIENT, DOCUMENT_QUEUE } from "@/lib/mock-data";
import { useDocStore, COMPLIANCE_DOC_LINKS } from "@/lib/doc-store";


export const Route = createFileRoute("/export")({
  head: () => ({ meta: [{ title: "Export eOffer Package — ScheduleBuilder" }] }),
  component: ExportPage,
});

type ExportRecord = {
  id: string;
  ts: number;
  filename: string;
  bytes: number;
  docCount: number;
};

function ExportPage() {
  const docs = useDocStore();
  const [downloading, setDownloading] = useState(false);
  const [history, setHistory] = useState<ExportRecord[]>([]);
  const [copied, setCopied] = useState(false);

  // Helper: map a doc kind → finalized status from the live doc store.
  const isKindFinal = (kind: string) => {
    const d = DOCUMENT_QUEUE.find((x) => x.kind === kind);
    if (!d) return false;
    return docs[d.name]?.status === "final";
  };
  const isDocNa = (name: string) => !!docs[name]?.na;

  // Compliance gaps: a row is a blocker only if it is still "missing" AND no
  // linked document in the generator has been finalized for that ref.
  const missingCompliance = COMPLIANCE_MATRIX.filter((r) => {
    if (r.status !== "missing") return false;
    const linkedKind = COMPLIANCE_DOC_LINKS[r.ref];
    if (linkedKind && isKindFinal(linkedKind)) return false;
    return true;
  });

  // The pair: Relevant Project Experience OR Startup Springboard Substitution.
  // At least one must be finalized; N/A on both is not allowed.
  const PAIR_KINDS = new Set(["relevant-project", "startup-springboard"]);
  const relevantDoc = DOCUMENT_QUEUE.find((d) => d.kind === "relevant-project");
  const springboardDoc = DOCUMENT_QUEUE.find((d) => d.kind === "startup-springboard");
  const pairSatisfied =
    (relevantDoc && docs[relevantDoc.name]?.status === "final" && !docs[relevantDoc.name]?.na) ||
    (springboardDoc && docs[springboardDoc.name]?.status === "final" && !docs[springboardDoc.name]?.na);

  // Non-final docs: skip N/A docs, and skip the pair (handled separately).
  const nonFinalDocs = DOCUMENT_QUEUE.filter((d) => {
    if (PAIR_KINDS.has(d.kind)) return false;
    if (isDocNa(d.name)) return false;
    return (docs[d.name]?.status ?? "draft") !== "final";
  });

  const blockers = useMemo(() => {
    const list: { id: string; label: string; href: string }[] = [];
    missingCompliance.forEach((m) =>
      list.push({ id: `comp-${m.ref}`, label: `Compliance gap · ${m.ref} ${m.req}`, href: "/compliance" }),
    );
    nonFinalDocs.forEach((d) =>
      list.push({
        id: `doc-${d.name}`,
        label: `Document not finalized · ${d.name}`,
        href: "/documents",
      }),
    );
    if (!pairSatisfied) {
      list.push({
        id: "doc-pair",
        label:
          "Finalize either Relevant Project Experience or Startup Springboard Substitution",
        href: "/documents",
      });
    }
    return list;
  }, [missingCompliance, nonFinalDocs, pairSatisfied]);


  const ready = blockers.length === 0;

  const eofferText = [
    `Offeror Name: ${CLIENT.name}`,
    `UEI: ${CLIENT.uei}`,
    `CAGE Code: ${CLIENT.cage}`,
    `Solicitation: ${CLIENT.solicitation}`,
    `Schedule: ${CLIENT.schedule}`,
    `Proposed SINs: 54151S`,
    `Authorized Negotiator: ${CLIENT.poc}`,
  ].join("\n");

  const copyEOffer = async () => {
    await navigator.clipboard.writeText(eofferText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const generateZip = async () => {
    setDownloading(true);
    const zip = new JSZip();

    // Folder bundle (placeholders for binaries we don't yet generate)
    for (const b of EXPORT_BUNDLE) {
      const folder = zip.folder(b.folder);
      if (!folder) continue;
      for (const f of b.files) {
        folder.file(f, fileContent(f));
      }
    }

    // Real document drafts from the doc store → /02_Technical/drafts/
    const drafts = zip.folder("02_Technical")?.folder("drafts");
    let docCount = 0;
    if (drafts) {
      for (const d of DOCUMENT_QUEUE) {
        const state = docs[d.name];
        if (!state?.text) continue;
        drafts.file(`${d.name}.txt`, state.text);
        docCount++;
      }
    }

    // Compliance matrix CSV → /05_Compliance/Compliance_Matrix.csv
    const csv =
      "Ref,Requirement,Status\n" +
      COMPLIANCE_MATRIX.map(
        (r) => `"${r.ref}","${r.req.replace(/"/g, '""')}",${r.status}`,
      ).join("\n");
    zip.folder("05_Compliance")?.file("Compliance_Matrix.csv", csv);

    // eOffer field-ready text → root
    zip.file("eOffer_Fields.txt", eofferText);

    // Manifest
    const now = new Date();
    const manifest = [
      "eOffer Package Manifest",
      "=======================",
      `Generated: ${now.toISOString()}`,
      "",
      "Offeror",
      "-------",
      `Name:          ${CLIENT.name}`,
      `UEI:           ${CLIENT.uei}`,
      `CAGE:          ${CLIENT.cage}`,
      `Solicitation:  ${CLIENT.solicitation}`,
      `Schedule:      ${CLIENT.schedule}`,
      `Negotiator:    ${CLIENT.poc}`,
      "",
      "Contents",
      "--------",
      ...EXPORT_BUNDLE.flatMap((b) => [`/${b.folder}/`, ...b.files.map((f) => `  - ${f}`)]),
      `  - 02_Technical/drafts/  (${docCount} document drafts)`,
      "/05_Compliance/Compliance_Matrix.csv",
      "/eOffer_Fields.txt",
      "",
      "Submission",
      "----------",
      "Submit through eOffer.gsa.gov by the Authorized Negotiator.",
      "This package was prepared by ScheduleBuilder and is not auto-submitted.",
    ].join("\n");
    zip.file("00_Manifest.txt", manifest);

    const blob = await zip.generateAsync({ type: "blob" });
    const filename = `eOffer_Package_${CLIENT.cage}_${now.toISOString().slice(0, 10)}.zip`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    setHistory((prev) => [
      {
        id: `${now.getTime()}`,
        ts: now.getTime(),
        filename,
        bytes: blob.size,
        docCount,
      },
      ...prev,
    ]);
    setDownloading(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Final Step • Human Submission Required"
        title="eOffer Package Exporter"
        description="Builds the final folder structure, document package, pricing files, and signed forms tracker. Submission is performed manually by the Authorized Negotiator."
        actions={
          <button
            onClick={generateZip}
            disabled={!ready || downloading}
            className="text-xs font-bold uppercase tracking-widest px-5 py-3 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading
              ? "Building Zip…"
              : ready
                ? "Generate eOffer Zip"
                : `Resolve ${blockers.length} Blocker${blockers.length === 1 ? "" : "s"}`}
          </button>
        }
      />

      {!ready && (
        <div className="mb-6 border border-destructive/30 bg-destructive/5 rounded-sm p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-destructive mb-2">
            Export Blocked — {blockers.length} item{blockers.length === 1 ? "" : "s"}
          </div>
          <ul className="text-xs space-y-1">
            {blockers.map((b) => (
              <li key={b.id} className="flex justify-between font-mono gap-3">
                <span className="text-foreground truncate">{b.label}</span>
                <Link to={b.href} className="text-primary hover:underline shrink-0">
                  Resolve →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <Panel title="Package Folder Structure" className="p-0">
            <div className="divide-y divide-border">
              {EXPORT_BUNDLE.map((b) => (
                <div key={b.folder} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-foreground">/{b.folder}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {b.files.length} files
                    </span>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {b.files.map((f) => (
                      <li
                        key={f}
                        className="text-[11px] font-mono text-muted-foreground flex items-center gap-2 border border-border rounded-sm px-2 py-1 bg-surface"
                      >
                        <span className="size-1.5 bg-success rounded-full shrink-0" />
                        <span className="truncate">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs font-bold text-foreground">
                    /02_Technical/drafts
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {DOCUMENT_QUEUE.length} documents · synced from generator
                  </span>
                </div>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {DOCUMENT_QUEUE.map((d) => {
                    const st = docs[d.name]?.status ?? "draft";
                    return (
                      <li
                        key={d.name}
                        className="text-[11px] font-mono flex items-center gap-2 border border-border rounded-sm px-2 py-1 bg-surface"
                      >
                        <span
                          className={`size-1.5 rounded-full shrink-0 ${
                            st === "final"
                              ? "bg-success"
                              : st === "review"
                                ? "bg-warning"
                                : "bg-muted-foreground"
                          }`}
                        />
                        <span className="truncate flex-1 text-muted-foreground">{d.name}.txt</span>
                        <StatusPill status={st} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </Panel>

          <Panel
            title="eOffer Field-Ready Text"
            trailing={
              <button
                onClick={copyEOffer}
                className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 border border-border rounded-sm hover:bg-muted"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            }
          >
            <div className="space-y-2 text-[11px] font-mono">
              <Row k="Offeror Name" v={CLIENT.name} />
              <Row k="UEI" v={CLIENT.uei} />
              <Row k="CAGE Code" v={CLIENT.cage} />
              <Row k="Solicitation" v={CLIENT.solicitation} />
              <Row k="Schedule" v={CLIENT.schedule} />
              <Row k="Proposed SINs" v="54151S" />
              <Row k="Authorized Negotiator" v={CLIENT.poc} />
            </div>
          </Panel>

          {history.length > 0 && (
            <Panel title="Export History">
              <ul className="divide-y divide-border text-xs">
                {history.map((h) => (
                  <li key={h.id} className="py-2 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-bold text-foreground truncate">{h.filename}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {new Date(h.ts).toLocaleString()} · {(h.bytes / 1024).toFixed(1)} KB ·{" "}
                        {h.docCount} drafts
                      </div>
                    </div>
                    <StatusPill status="complete" />
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Panel title="Signed Forms Tracker">
            <ul className="space-y-2 text-xs">
              {[
                ["SF1449 Cover", "approved"],
                ["Agent Authorization Letter", "pending"],
                ["Reps & Certs (SAM)", "approved"],
                ["Subcontracting Plan", "na"],
              ].map(([name, status]) => (
                <li
                  key={name}
                  className="flex justify-between items-center border border-border rounded-sm px-2 py-1.5"
                >
                  <span>{name}</span>
                  <StatusPill status={status} />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Final Submission Checklist">
            <ol className="text-xs space-y-2 list-decimal list-inside text-foreground">
              <li>Download .zip package</li>
              <li>Verify FAS ID & digital cert</li>
              <li>
                Log in to{" "}
                <a
                  href="https://eoffer.gsa.gov"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  eOffer portal
                </a>
              </li>
              <li>Upload package by section</li>
              <li>Authorized Negotiator certifies</li>
              <li>Submit and capture confirmation</li>
            </ol>
          </Panel>

          <Panel title="Notice">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              ScheduleBuilder prepares an eOffer-ready package but does not submit on behalf of the
              offeror. The Authorized Negotiator is solely responsible for certification and submission
              through eOffer.gsa.gov.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}

function fileContent(filename: string): string {
  const stub = `[PLACEHOLDER] This is a generated placeholder for ${filename}.\nReplace with the final document before eOffer submission.\n`;
  if (filename.endsWith(".xlsx")) return stub + "(Binary .xlsx content would be embedded here)";
  if (filename.endsWith(".pdf")) return stub + "(Binary .pdf content would be embedded here)";
  return stub;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border/50 py-1.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-bold text-foreground">{v}</span>
    </div>
  );
}
