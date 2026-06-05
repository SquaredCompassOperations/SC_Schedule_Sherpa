import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import JSZip from "jszip";
import { PageHeader, Panel, StatusPill } from "@/components/ui-primitives";
import { COMPLIANCE_MATRIX, EXPORT_BUNDLE, CLIENT, DOCUMENT_QUEUE } from "@/lib/mock-data";
import { useDocStore, COMPLIANCE_DOC_LINKS } from "@/lib/doc-store";
import { useEntity } from "@/lib/intake-store";
import { useAutomation } from "@/lib/automation-store";


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
  const entity = useEntity();
  const automation = useAutomation();
  const [downloading, setDownloading] = useState(false);
  const [history, setHistory] = useState<ExportRecord[]>([]);
  const [copied, setCopied] = useState(false);

  const isKindFinal = (kind: string) => {
    const d = DOCUMENT_QUEUE.find((x) => x.kind === kind);
    if (!d) return false;
    return docs[d.name]?.status === "final";
  };
  const isDocNa = (name: string) => !!docs[name]?.na;

  const missingCompliance = COMPLIANCE_MATRIX.filter((r) => {
    if (r.status !== "missing") return false;
    const linkedKind = COMPLIANCE_DOC_LINKS[r.ref];
    if (linkedKind && isKindFinal(linkedKind)) return false;
    return true;
  });

  const PAIR_KINDS = new Set(["relevant-project", "startup-springboard"]);
  const relevantDoc = DOCUMENT_QUEUE.find((d) => d.kind === "relevant-project");
  const springboardDoc = DOCUMENT_QUEUE.find((d) => d.kind === "startup-springboard");
  const pairSatisfied =
    (relevantDoc && docs[relevantDoc.name]?.status === "final" && !docs[relevantDoc.name]?.na) ||
    (springboardDoc && docs[springboardDoc.name]?.status === "final" && !docs[springboardDoc.name]?.na);

  const nonFinalDocs = DOCUMENT_QUEUE.filter((d) => {
    if (PAIR_KINDS.has(d.kind)) return false;
    if (isDocNa(d.name)) return false;
    return (docs[d.name]?.status ?? "draft") !== "final";
  });

  const blockers = useMemo(() => {
    const list: { id: string; label: string; href: string }[] = [];
    missingCompliance.forEach((m) =>
      list.push({ id: `comp-${m.ref}`, label: `Compliance gap · ${m.ref} ${m.req}`, href: "/status" }),
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

  const proposedSins = automation.selectedSins.map((s) => s.code).join(", ") || "—";

  const eofferText = [
    `Offeror Name: ${entity.name}`,
    `UEI: ${entity.uei}`,
    `CAGE Code: ${entity.cage}`,
    `Solicitation: ${CLIENT.solicitation}`,
    `Schedule: ${CLIENT.schedule}`,
    `Proposed SINs: ${proposedSins}`,
    `Authorized Negotiator: ${entity.pocName || "—"}`,
  ].join("\n");

  const copyEOffer = async () => {
    await navigator.clipboard.writeText(eofferText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Live folder map — drives both preview and zip generation, no duplication.
  const activeDrafts = DOCUMENT_QUEUE.filter((d) => {
    const st = docs[d.name];
    return st && st.text && !st.na;
  });

  const docFolder = (kind: string) => {
    if (["corporate-experience", "quality-control", "relevant-project", "startup-springboard"].includes(kind)) {
      return "02_Technical";
    }
    if (["epa-narrative", "compensation-plan"].includes(kind)) {
      return "04_Pricing";
    }
    if (["uncompensated-overtime"].includes(kind)) {
      return "05_Compliance";
    }
    if (kind === "project-summary") return "03_Past_Performance";
    return "02_Technical";
  };

  type FolderRow = { name: string; status: string; na: boolean; source: "static" | "draft" | "generated" };
  const folderMap = useMemo(() => {
    const m: Record<string, FolderRow[]> = {};
    for (const b of EXPORT_BUNDLE) {
      m[b.folder] = b.files.map((f) => ({ name: f, status: "static", na: false, source: "static" as const }));
    }
    for (const d of activeDrafts) {
      const folder = docFolder(d.kind);
      (m[folder] ||= []).push({
        name: `${d.name}.docx`,
        status: docs[d.name]?.status ?? "draft",
        na: false,
        source: "draft",
      });
    }
    if (automation.pricingRows.length > 0) {
      (m["04_Pricing"] ||= []).push({
        name: "Pricing_Workbook.xlsx",
        status: "final",
        na: false,
        source: "generated",
      });
    }
    (m["05_Compliance"] ||= []).push({
      name: "Compliance_Matrix.csv",
      status: "final",
      na: false,
      source: "generated",
    });
    return m;
  }, [activeDrafts, docs, automation.pricingRows.length]);

  const generateZip = async () => {
    setDownloading(true);
    const zip = new JSZip();

    for (const [folderName, files] of Object.entries(folderMap)) {
      const folder = zip.folder(folderName);
      if (!folder) continue;
      for (const f of files) {
        if (f.source === "static") {
          folder.file(f.name, fileContent(f.name));
        } else if (f.source === "draft") {
          const base = f.name.replace(/\.docx$/, "");
          const state = docs[base];
          if (state?.text) folder.file(`${base}.txt`, state.text);
        } else if (f.name === "Compliance_Matrix.csv") {
          const csv =
            "Ref,Requirement,Status\n" +
            COMPLIANCE_MATRIX.map(
              (r) => `"${r.ref}","${r.req.replace(/"/g, '""')}",${r.status}`,
            ).join("\n");
          folder.file("Compliance_Matrix.csv", csv);
        } else if (f.name === "Pricing_Workbook.xlsx") {
          folder.file("Pricing_Workbook.txt", "Generated from Pricing Workbook module. Open that module to download the live .xlsx.");
        }
      }
    }

    zip.file("eOffer_Fields.txt", eofferText);

    const docCount = activeDrafts.length;
    const now = new Date();
    const manifest = [
      "eOffer Package Manifest",
      "=======================",
      `Generated: ${now.toISOString()}`,
      "",
      "Offeror",
      "-------",
      `Name:          ${entity.name}`,
      `UEI:           ${entity.uei}`,
      `CAGE:          ${entity.cage}`,
      `Solicitation:  ${CLIENT.solicitation}`,
      `Schedule:      ${CLIENT.schedule}`,
      `Negotiator:    ${entity.pocName || "—"}`,
      `Proposed SINs: ${proposedSins}`,
      "",
      "Contents",
      "--------",
      ...Object.entries(folderMap).flatMap(([folder, files]) => [
        `/${folder}/`,
        ...files.map((f) => `  - ${f.name}`),
      ]),
      "/eOffer_Fields.txt",
      "",
      "Submission",
      "----------",
      "Submit through eOffer.gsa.gov by the Authorized Negotiator.",
      "This package was prepared by ScheduleBuilder and is not auto-submitted.",
    ].join("\n");
    zip.file("00_Manifest.txt", manifest);

    const blob = await zip.generateAsync({ type: "blob" });
    const cageSlug = entity.cage !== "—" ? entity.cage : "offer";
    const filename = `eOffer_Package_${cageSlug}_${now.toISOString().slice(0, 10)}.zip`;
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
              {Object.entries(folderMap).map(([folder, files]) => (
                <div key={folder} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-foreground">/{folder}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {files.length} file{files.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {files.map((f) => (
                      <li
                        key={f.name}
                        className="text-[11px] font-mono flex items-center gap-2 border border-border rounded-sm px-2 py-1 bg-surface"
                      >
                        <span
                          className={`size-1.5 rounded-full shrink-0 ${
                            f.source === "static" || f.status === "final"
                              ? "bg-success"
                              : f.status === "review"
                                ? "bg-warning"
                                : "bg-muted-foreground"
                          }`}
                        />
                        <span className="truncate flex-1 text-muted-foreground">{f.name}</span>
                        {f.source !== "static" ? (
                          <StatusPill status={f.status} />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
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
              <Row k="Offeror Name" v={entity.name} />
              <Row k="UEI" v={entity.uei} />
              <Row k="CAGE Code" v={entity.cage} />
              <Row k="Solicitation" v={CLIENT.solicitation} />
              <Row k="Schedule" v={CLIENT.schedule} />
              <Row k="Proposed SINs" v={proposedSins} />
              <Row k="Authorized Negotiator" v={entity.pocName || "—"} />
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
