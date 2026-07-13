import { createFileRoute } from "@tanstack/react-router";
import { SaveAndContinue } from "@/components/save-and-continue";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { PageHeader, Panel, StatusPill } from "@/components/ui-primitives";
import { CLIENT, DOC_CRITERIA } from "@/lib/mock-data";
import { generateNarrative } from "@/lib/narrative.functions";
import { useDocStore, patchDoc, type DocState } from "@/lib/doc-store";
import { useIntake } from "@/lib/intake-store";
import { useAutomation } from "@/lib/automation-store";
import { useSelectedOfferId, useSelectedOfferType, isGsaMasOfferType } from "@/lib/offer-workspace";
import {
  addSolicitationFiles,
  buildDocumentQueueForOffer,
  useSolicitationPacket,
  type SolicitationDocumentQueueItem,
} from "@/lib/solicitation-store";

export const Route = createFileRoute("/documents")({
  head: () => ({ meta: [{ title: "Document Generator — ScheduleBuilder" }] }),
  component: DocsPage,
});

function DocsPage() {
  const fn = useServerFn(generateNarrative);
  const store = useDocStore();
  const intake = useIntake();
  const automation = useAutomation();
  const selectedOfferId = useSelectedOfferId();
  const offerType = useSelectedOfferType();
  const solicitationPacket = useSolicitationPacket(selectedOfferId);
  const documentQueue = useMemo(
    () => buildDocumentQueueForOffer(offerType, solicitationPacket.files),
    [offerType, solicitationPacket.files],
  );
  const [activeName, setActiveName] = useState("");

  useEffect(() => {
    if (documentQueue.length === 0) {
      if (activeName) setActiveName("");
      return;
    }
    if (!documentQueue.some((document) => document.name === activeName)) {
      setActiveName(documentQueue[0].name);
    }
  }, [activeName, documentQueue]);

  const active = useMemo(
    () => documentQueue.find((d) => d.name === activeName) ?? documentQueue[0] ?? null,
    [activeName, documentQueue],
  );
  const current = active ? (store[active.name] ?? createBlankDocState(active)) : null;

  const update = (name: string, patch: Partial<DocState>) => patchDoc(name, patch);

  const epaMechanism = current?.epaMechanism;
  const epaMechanismLabel: Record<NonNullable<DocState["epaMechanism"]>, string> = {
    "fixed-escalation": "GSAM 538.270-4(a)(1) — Adjustments based on fixed escalation rates",
    "market-index": "GSAM 538.270-4(a)(2) — Adjustments based on a market index or other basis",
    "established-pricing":
      "GSAM 538.270-4(a)(3) — Adjustments based on established pricing (commercial price list, catalog, or standard market pricing)",
  };

  const mutation = useMutation({
    mutationFn: async (kind: string) => {
      const extra =
        kind === "epa-narrative" && epaMechanism
          ? `EPA Mechanism: ${epaMechanismLabel[epaMechanism]}. Source: GSA Pricing Terms Attachment — Refresh 32 (GSAM 538.270-4).`
          : undefined;
      const ctx = buildContext(intake, automation, extra, kind);
      return fn({ data: { kind, context: ctx } });
    },
    onSuccess: (res) =>
      update(active.name, {
        text: res.text,
        dirty: true,
        // Regenerating a previously finalized doc sends it back through review.
        status: current?.status === "final" ? "draft" : current?.status,
        savedAt: null,
      }),
  });

  const save = () => active && update(active.name, { savedAt: Date.now(), dirty: false });

  const markForReview = () =>
    active && update(active.name, { status: "review", savedAt: Date.now(), dirty: false });
  const finalize = () =>
    active && update(active.name, { status: "final", savedAt: Date.now(), dirty: false });

  const canMarkNa = active?.kind === "relevant-project" || active?.kind === "startup-springboard";
  const toggleNa = () =>
    active &&
    current &&
    update(active.name, {
      na: !current.na,
      // when marking N/A, clear final status; when unmarking, leave as is
      status: !current.na ? "draft" : current.status,
      dirty: false,
      savedAt: Date.now(),
    });

  const counts = useMemo(() => {
    let draft = 0,
      review = 0,
      final = 0;
    documentQueue.forEach((document) => {
      const s = store[document.name] ?? createBlankDocState(document);
      if (s.na) {
        final++;
        return;
      }
      if (s.status === "draft") draft++;
      else if (s.status === "review") review++;
      else final++;
    });
    return { draft, review, final };
  }, [documentQueue, store]);

  const allFinal = documentQueue.length > 0 && counts.final === documentQueue.length;
  const gsaMas = isGsaMasOfferType(offerType);

  return (
    <>
      <PageHeader
        eyebrow="Automation Engine • Module 4"
        title="Document Generator"
        description={
          gsaMas
            ? "Generates narratives, summaries, and policy text from the master intake record. Every draft requires human review before approval."
            : "Uses the uploaded solicitation packet as the document queue for this offer. MAS-specific forms are hidden for this solicitation type."
        }
        actions={
          <div className="flex gap-4 text-right">
            <Stat label="Draft" value={counts.draft} tone="primary" />
            <Stat label="Review" value={counts.review} tone="warning" />
            <Stat label="Final" value={counts.final} tone="success" />
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4">
          {!gsaMas ? <SolicitationUploadPanel offerId={selectedOfferId} className="mb-6" /> : null}
          <Panel title="Document Queue" className="p-0">
            {documentQueue.length === 0 ? (
              <div className="px-4 py-8 text-sm text-muted-foreground">
                Upload solicitation documents to build this offer's document queue.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {documentQueue.map((d) => {
                  const s = store[d.name] ?? createBlankDocState(d);
                  return (
                    <li key={d.name}>
                      <button
                        onClick={() => setActiveName(d.name)}
                        className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex justify-between items-center gap-3 ${
                          active.name === d.name ? "bg-primary/5 border-l-2 border-primary" : ""
                        }`}
                      >
                        <span className="text-xs font-medium truncate flex items-center gap-2">
                          {s.text || d.sourceFile ? (
                            <span
                              className="size-1.5 rounded-full bg-primary shrink-0"
                              title="Has content"
                            />
                          ) : (
                            <span className="size-1.5 rounded-full border border-border shrink-0" />
                          )}
                          {d.name}
                        </span>
                        {s.na ? (
                          <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground border border-border rounded-sm px-1.5 py-0.5">
                            N/A
                          </span>
                        ) : (
                          <StatusPill status={s.status} />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-8 space-y-6">
          {active && current ? (
            <Panel
              title={active.name}
              trailing={
                <div className="flex gap-2 items-center">
                  <SaveIndicator state={current} />
                  <button
                    onClick={() => mutation.mutate(active.kind)}
                    disabled={
                      mutation.isPending ||
                      current.na ||
                      (active.kind === "epa-narrative" && !epaMechanism)
                    }
                    className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {mutation.isPending
                      ? "Generating…"
                      : current.text
                        ? "Regenerate"
                        : "Generate Draft"}
                  </button>

                  <button
                    onClick={save}
                    disabled={!current.dirty || current.na}
                    className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm hover:bg-muted disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    onClick={markForReview}
                    disabled={!current.text || current.status === "review" || current.na}
                    className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm hover:bg-muted disabled:opacity-40"
                  >
                    Mark for Review
                  </button>
                  <button
                    onClick={finalize}
                    disabled={!current.text || current.status === "final" || current.na}
                    className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm hover:bg-muted disabled:opacity-40"
                  >
                    {current.status === "final" ? "Final" : "Finalize"}
                  </button>
                  {canMarkNa ? (
                    <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm cursor-pointer hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={!!current.na}
                        onChange={toggleNa}
                        className="size-3 accent-primary"
                      />
                      N/A
                    </label>
                  ) : null}
                  <button
                    onClick={() => exportDocx(active.name, current.text)}
                    disabled={!current.text || current.na}
                    className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm hover:bg-muted disabled:opacity-40"
                  >
                    Export .docx
                  </button>
                </div>
              }
            >
              {mutation.error ? (
                <div className="mb-3 text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-sm p-2">
                  {(mutation.error as Error).message}
                </div>
              ) : null}
              {current.na ? (
                <div className="mb-3 text-xs text-muted-foreground border border-border bg-muted/30 rounded-sm p-2 font-mono">
                  Marked Not Applicable — this document is excluded from the eOffer package.
                  {active.kind === "relevant-project"
                    ? " The package will require Startup Springboard Substitution instead."
                    : active.kind === "startup-springboard"
                      ? " The package will require Relevant Project Experience instead."
                      : ""}
                </div>
              ) : null}
              {active.kind === "epa-narrative" && !current.na ? (
                <div className="mb-3 border border-border rounded-sm p-3 bg-surface">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                    EPA Mechanism (required before generating)
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {(
                      [
                        {
                          v: "fixed-escalation",
                          label: "Fixed escalation rates",
                          hint: "GSAM 538.270-4(a)(1)",
                        },
                        {
                          v: "market-index",
                          label: "Market index or other basis",
                          hint: "GSAM 538.270-4(a)(2) — e.g. BLS ECI",
                        },
                        {
                          v: "established-pricing",
                          label: "Established pricing",
                          hint: "GSAM 538.270-4(a)(3) — commercial price list / catalog",
                        },
                      ] as const
                    ).map((opt) => (
                      <label
                        key={opt.v}
                        className={`flex-1 cursor-pointer border rounded-sm px-3 py-2 text-xs transition-colors ${
                          epaMechanism === opt.v
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <input
                          type="radio"
                          name="epa-mechanism"
                          value={opt.v}
                          checked={epaMechanism === opt.v}
                          onChange={() => update(active.name, { epaMechanism: opt.v, dirty: true })}
                          className="mr-2 accent-primary"
                        />
                        <span className="font-bold">{opt.label}</span>
                        <div className="text-[10px] font-mono text-muted-foreground mt-0.5 ml-5">
                          {opt.hint}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <textarea
                value={current.text}
                onChange={(e) => update(active.name, { text: e.target.value, dirty: true })}
                disabled={current.na}
                placeholder={
                  mutation.isPending
                    ? "Drafting narrative with master intake context…"
                    : "Click Generate Draft to produce AI-assisted narrative text using the master intake record. Edit freely before approval."
                }
                className="w-full h-80 p-4 text-sm border border-border bg-background rounded-sm focus:outline-none focus:ring-1 focus:ring-primary font-sans leading-relaxed"
              />
              <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                <span>
                  {gsaMas
                    ? "Drafted using fields: UEI, CAGE, NAICS, SINs, POC, employee count"
                    : active.sourceFile
                      ? `Sourced from ${active.sourceFile.filename}`
                      : "Sourced from uploaded solicitation packet"}
                </span>
                <span>{current.text.length.toLocaleString()} chars</span>
              </div>
            </Panel>
          ) : (
            <Panel title="No Solicitation Documents">
              <div className="text-sm text-muted-foreground">
                Upload solicitation documents to start drafting and reviewing required forms.
              </div>
            </Panel>
          )}

          {active && DOC_CRITERIA[active.kind] ? (
            <Panel
              title="Required Criteria Checklist"
              trailing={
                <span className="text-[10px] font-mono text-muted-foreground">
                  {DOC_CRITERIA[active.kind].source}
                </span>
              }
            >
              <ul className="space-y-1.5">
                {DOC_CRITERIA[active.kind].items.map((item, i) => {
                  const hit = Boolean(
                    current && current.text.length > 0 && matchesItem(current.text, item),
                  );
                  return (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span
                        className={`mt-0.5 size-3.5 rounded-sm border flex items-center justify-center text-[9px] font-bold shrink-0 ${
                          hit
                            ? "bg-success/15 border-success/40 text-success"
                            : "bg-muted border-border text-muted-foreground"
                        }`}
                      >
                        {hit ? "✓" : i + 1}
                      </span>
                      <span className={hit ? "text-foreground" : "text-muted-foreground"}>
                        {item}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 text-[10px] font-mono text-muted-foreground">
                Heuristic match against current draft text. Final coverage requires human review.
              </div>
            </Panel>
          ) : null}

          <Panel
            title={
              gsaMas
                ? "Source Fields (from Master Intake)"
                : "Source Fields (from Solicitation Packet)"
            }
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px] font-mono">
              <Field k="Legal Name" v={intake.corporate.legalName || "—"} />
              <Field k="UEI" v={intake.corporate.uei || "—"} />
              <Field k="CAGE" v={intake.corporate.cageCode || "—"} />
              <Field k="EIN" v={intake.corporate.ein || "—"} />
              <Field k="NAICS" v={intake.corporate.naicsPrimary || "—"} />
              <Field
                k="POC"
                v={
                  intake.negotiators[0]?.name
                    ? `${intake.negotiators[0].name}${intake.negotiators[0].email ? " <" + intake.negotiators[0].email + ">" : ""}`
                    : "—"
                }
              />
              <Field
                k="SBA Certs"
                v={
                  intake.sbaCerts.length
                    ? intake.sbaCerts.map((s) => s.program).join(", ")
                    : "None on file"
                }
              />
              <Field
                k="Selected SINs"
                v={
                  automation.selectedSins.length
                    ? automation.selectedSins.map((s) => s.code).join(", ")
                    : "—"
                }
              />
              <Field
                k="SCA LCATs"
                v={
                  automation.selectedLcats.length
                    ? String(automation.selectedLcats.length) + " selected"
                    : "—"
                }
              />
            </div>
          </Panel>
        </div>
      </div>
      <div className="mt-8 flex flex-col items-end gap-2 border-t border-border pt-4">
        {!allFinal ? (
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Finalize all {documentQueue.length} documents to complete this module ({counts.final}/
            {documentQueue.length} final)
          </div>
        ) : null}
        <SaveAndContinue moduleSlug="/documents" nextHref="/review" disabled={!allFinal} />
      </div>
    </>
  );
}

function createBlankDocState(document: SolicitationDocumentQueueItem): DocState {
  return {
    text: document.sourceFile ? `[Solicitation packet file: ${document.sourceFile.filename}]` : "",
    status: document.status,
    savedAt: null,
    dirty: false,
    source: document.sourceFile ? "client-upload" : "generated",
    sourceFile: document.sourceFile
      ? { filename: document.sourceFile.filename, uploadedAt: document.sourceFile.uploadedAt }
      : null,
    signOff: null,
  };
}

function SolicitationUploadPanel({
  offerId,
  className = "",
}: {
  offerId: string | null;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Panel title="Solicitation Packet" className={className}>
      <div className="space-y-3">
        <div className="text-xs text-muted-foreground">
          Upload solicitation forms, attachments, pricing sheets, and instructions. These files
          replace the MAS document queue for this offer.
        </div>
        <input
          type="file"
          multiple
          onChange={(event) => {
            setError(null);
            if (!offerId) {
              setError("Select an active client before uploading solicitation documents.");
              return;
            }
            const files = Array.from(event.target.files ?? []).map((file) => ({
              filename: file.name,
              mediaType: file.type || "application/octet-stream",
              size: file.size,
            }));
            addSolicitationFiles(offerId, files);
          }}
          className="text-xs"
        />
        {error ? <div className="text-xs text-destructive">{error}</div> : null}
      </div>
    </Panel>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "warning" | "success";
}) {
  const cls =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-primary";
  return (
    <div>
      <div className="text-[10px] font-mono text-muted-foreground uppercase">{label}</div>
      <div className={`text-2xl font-mono font-bold leading-none ${cls}`}>{value}</div>
    </div>
  );
}

function SaveIndicator({ state }: { state: DocState }) {
  if (state.dirty) {
    return (
      <span className="text-[10px] font-mono uppercase tracking-widest text-warning">Unsaved</span>
    );
  }
  if (state.savedAt) {
    return (
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        Saved {timeAgo(state.savedAt)}
      </span>
    );
  }
  return null;
}

function timeAgo(ts: number) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="border border-border rounded-sm px-2 py-1.5 bg-surface">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{k}</div>
      <div className="text-foreground truncate">{v}</div>
    </div>
  );
}

function contextString() {
  return "(no master intake context provided)";
}

function buildContext(
  intake: ReturnType<typeof useIntake>,
  automation: ReturnType<typeof useAutomation>,
  extra?: string,
  kind?: string,
): string {
  const c = intake.corporate;
  const negotiator = intake.negotiators[0];
  // Relevant Project Experience must pull POC strictly from past performance
  // documents — never from the offeror's authorized negotiator. Omit POC for
  // this kind so the model is forced to mark it [TBD] unless a PP doc provides it.
  const pocLine =
    kind === "relevant-project"
      ? "[Customer POC must come from the supplied Past Performance document — do not substitute the Offeror's authorized negotiator]"
      : negotiator?.name
        ? `${negotiator.name}${negotiator.title ? ", " + negotiator.title : ""}${negotiator.email ? " <" + negotiator.email + ">" : ""}`
        : "—";
  const sinLine = automation.selectedSins.length
    ? automation.selectedSins.map((s) => `${s.code} ${s.title}`).join("; ")
    : "(none selected)";
  const lcatLine = automation.selectedLcats.length
    ? automation.selectedLcats.map((l) => `${l.code} ${l.title}`).join("; ")
    : "(none selected)";
  const pp = intake.pastPerformance
    .slice(0, 5)
    .map((p) => `${p.category}: ${p.filename}`)
    .join("; ");
  const addr = intake.companyAddress;
  const addrLine = [addr.street1, addr.city, addr.state, addr.zip].filter(Boolean).join(", ");
  return [
    `Company: ${c.legalName || "—"}${c.dba ? " (DBA " + c.dba + ")" : ""}`,
    `UEI: ${c.uei || "—"}`,
    `CAGE: ${c.cageCode || "—"}`,
    `EIN: ${c.ein || "—"}`,
    `NAICS Primary: ${c.naicsPrimary || "—"}`,
    `Website: ${c.website || "—"}`,
    `Years in Business: ${c.yearsInBusiness || "—"}`,
    `Org Type: ${c.orgType || "—"}`,
    `Business Types: ${c.businessTypes || "—"}`,
    `SAM Status: ${c.samStatus || "—"}${c.samExpires ? " (expires " + c.samExpires + ")" : ""}`,
    `Address: ${addrLine || "—"}`,
    `POC: ${pocLine}`,
    `SBA Certifications: ${intake.sbaCerts.length ? intake.sbaCerts.map((s) => s.program).join(", ") : "None on file"}`,
    `Selected SINs: ${sinLine}`,
    `Applicable SCA LCATs: ${lcatLine}`,
    `Past Performance on file: ${pp || "None uploaded"}`,
    `Solicitation: ${CLIENT.solicitation}`,
    extra ? extra : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function exportDocx(title: string, content: string) {
  if (!content) return;
  const paragraphs = content.split("\n\n").map(
    (p) =>
      new Paragraph({
        children: [new TextRun({ text: p.trim(), size: 22 })],
        spacing: { after: 120 },
      }),
  );
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.LEFT,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated by ScheduleBuilder${CLIENT.name ? " for " + CLIENT.name : ""}`,
                size: 18,
                color: "666666",
              }),
            ],
            spacing: { after: 240 },
          }),
          ...paragraphs,
        ],
      },
    ],
  });
  Packer.toBlob(doc).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function matchesItem(text: string, item: string): boolean {
  const stop = new Set([
    "the",
    "and",
    "of",
    "to",
    "a",
    "an",
    "or",
    "for",
    "with",
    "in",
    "on",
    "by",
    "is",
    "are",
    "be",
    "that",
    "this",
    "as",
    "at",
    "from",
    "under",
    "any",
    "its",
  ]);
  const words = item
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w));
  const haystack = text.toLowerCase();
  const hits = words.filter((w) => haystack.includes(w)).length;
  return words.length > 0 && hits / words.length >= 0.4;
}
