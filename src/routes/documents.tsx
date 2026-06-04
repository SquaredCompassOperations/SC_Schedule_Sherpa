import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { PageHeader, Panel, StatusPill } from "@/components/ui-primitives";
import { DOCUMENT_QUEUE, CLIENT, DOC_CRITERIA } from "@/lib/mock-data";
import { generateNarrative } from "@/lib/narrative.functions";
import { useDocStore, patchDoc, type DocState } from "@/lib/doc-store";
import { useIntake } from "@/lib/intake-store";
import { useAutomation } from "@/lib/automation-store";

export const Route = createFileRoute("/documents")({
  head: () => ({ meta: [{ title: "Document Generator — ScheduleBuilder" }] }),
  component: DocsPage,
});




function DocsPage() {
  const fn = useServerFn(generateNarrative);
  const store = useDocStore();
  const intake = useIntake();
  const automation = useAutomation();
  const [activeName, setActiveName] = useState(DOCUMENT_QUEUE[0].name);

  const active = useMemo(
    () => DOCUMENT_QUEUE.find((d) => d.name === activeName) ?? DOCUMENT_QUEUE[0],
    [activeName],
  );
  const current = store[active.name];

  const update = (name: string, patch: Partial<DocState>) => patchDoc(name, patch);

  const mutation = useMutation({
    mutationFn: async (kind: string) => fn({ data: { kind, context: buildContext(intake, automation) } }),
    onSuccess: (res) => update(active.name, { text: res.text, dirty: true }),
  });

  const save = () => update(active.name, { savedAt: Date.now(), dirty: false });

  const markForReview = () =>
    update(active.name, { status: "review", savedAt: Date.now(), dirty: false });
  const finalize = () =>
    update(active.name, { status: "final", savedAt: Date.now(), dirty: false });

  const canMarkNa = active.kind === "relevant-project" || active.kind === "startup-springboard";
  const toggleNa = () =>
    update(active.name, {
      na: !current.na,
      // when marking N/A, clear final status; when unmarking, leave as is
      status: !current.na ? "draft" : current.status,
      dirty: false,
      savedAt: Date.now(),
    });




  const counts = useMemo(() => {
    let draft = 0, review = 0, final = 0;
    Object.values(store).forEach((s) => {
      if (s.status === "draft") draft++;
      else if (s.status === "review") review++;
      else final++;
    });
    return { draft, review, final };
  }, [store]);

  return (
    <>
      <PageHeader
        eyebrow="Automation Engine • Module 4"
        title="Document Generator"
        description="Generates narratives, summaries, and policy text from the master intake record. Every draft requires human review before approval."
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
          <Panel title="Document Queue" className="p-0">
            <ul className="divide-y divide-border">
              {DOCUMENT_QUEUE.map((d) => {
                const s = store[d.name];
                return (
                  <li key={d.name}>
                    <button
                      onClick={() => setActiveName(d.name)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex justify-between items-center gap-3 ${
                        active.name === d.name ? "bg-primary/5 border-l-2 border-primary" : ""
                      }`}
                    >
                      <span className="text-xs font-medium truncate flex items-center gap-2">
                        {s.text ? (
                          <span className="size-1.5 rounded-full bg-primary shrink-0" title="Has content" />
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
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-8 space-y-6">
          <Panel
            title={active.name}
            trailing={
              <div className="flex gap-2 items-center">
                <SaveIndicator state={current} />
                <button
                  onClick={() => mutation.mutate(active.kind)}
                  disabled={mutation.isPending || current.na}
                  className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {mutation.isPending ? "Generating…" : current.text ? "Regenerate" : "Generate Draft"}
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
                  disabled={!current.text || current.status !== "draft" || current.na}
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
              <span>Drafted using fields: UEI, CAGE, NAICS, SINs, POC, employee count</span>
              <span>{current.text.length.toLocaleString()} chars</span>
            </div>
          </Panel>

          {DOC_CRITERIA[active.kind] ? (
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
                  const hit = current.text.length > 0 && matchesItem(current.text, item);
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
                      <span className={hit ? "text-foreground" : "text-muted-foreground"}>{item}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 text-[10px] font-mono text-muted-foreground">
                Heuristic match against current draft text. Final coverage requires human review.
              </div>
            </Panel>
          ) : null}

          <Panel title="Source Fields (from Master Intake)">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px] font-mono">
              <Field k="Legal Name" v={intake.corporate.legalName || CLIENT.name} />
              <Field k="UEI" v={intake.corporate.uei || CLIENT.uei} />
              <Field k="CAGE" v={intake.corporate.cageCode || CLIENT.cage} />
              <Field k="EIN" v={intake.corporate.ein || CLIENT.ein} />
              <Field k="NAICS" v={intake.corporate.naicsPrimary || CLIENT.naicsPrimary} />
              <Field
                k="POC"
                v={
                  intake.negotiators[0]?.name
                    ? `${intake.negotiators[0].name}${intake.negotiators[0].email ? " <" + intake.negotiators[0].email + ">" : ""}`
                    : CLIENT.poc
                }
              />
              <Field
                k="SBA Certs"
                v={intake.sbaCerts.length ? intake.sbaCerts.map((s) => s.program).join(", ") : "None on file"}
              />
              <Field
                k="Selected SINs"
                v={automation.selectedSins.length ? automation.selectedSins.map((s) => s.code).join(", ") : "—"}
              />
              <Field
                k="SCA LCATs"
                v={automation.selectedLcats.length ? String(automation.selectedLcats.length) + " selected" : "—"}
              />
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "primary" | "warning" | "success" }) {
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
      <span className="text-[10px] font-mono uppercase tracking-widest text-warning">
        Unsaved
      </span>
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
  return `Company: ${CLIENT.name} | UEI: ${CLIENT.uei} | CAGE: ${CLIENT.cage} | EIN: ${CLIENT.ein} | NAICS: ${CLIENT.naicsPrimary} | Employees: ${CLIENT.employees} | Socioeconomic: ${CLIENT.socioeconomic} | POC: ${CLIENT.poc} | Solicitation: ${CLIENT.solicitation}`;
}

function buildContext(
  intake: ReturnType<typeof useIntake>,
  automation: ReturnType<typeof useAutomation>,
): string {
  const c = intake.corporate;
  const negotiator = intake.negotiators[0];
  const pocLine = negotiator?.name
    ? `${negotiator.name}${negotiator.title ? ", " + negotiator.title : ""}${negotiator.email ? " <" + negotiator.email + ">" : ""}`
    : CLIENT.poc;
  const sinLine = automation.selectedSins.length
    ? automation.selectedSins.map((s) => `${s.code} ${s.title}`).join("; ")
    : "(none selected)";
  const lcatLine = automation.selectedLcats.length
    ? automation.selectedLcats.map((l) => `${l.code} ${l.title}`).join("; ")
    : "(none selected)";
  const pp = intake.pastPerformance.slice(0, 5).map((p) => `${p.category}: ${p.filename}`).join("; ");
  const addr = intake.companyAddress;
  const addrLine = [addr.street1, addr.city, addr.state, addr.zip].filter(Boolean).join(", ");
  return [
    `Company: ${c.legalName || CLIENT.name}${c.dba ? " (DBA " + c.dba + ")" : ""}`,
    `UEI: ${c.uei || CLIENT.uei}`,
    `CAGE: ${c.cageCode || CLIENT.cage}`,
    `EIN: ${c.ein || CLIENT.ein}`,
    `NAICS Primary: ${c.naicsPrimary || CLIENT.naicsPrimary}`,
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
  ].join(" | ");
}

function exportDocx(title: string, content: string) {
  if (!content) return;
  const paragraphs = content.split("\n\n").map((p) =>
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
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.LEFT }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated by ScheduleBuilder for ${CLIENT.name} | UEI: ${CLIENT.uei} | CAGE: ${CLIENT.cage}`,
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
  const stop = new Set(["the","and","of","to","a","an","or","for","with","in","on","by","is","are","be","that","this","as","at","from","under","any","its"]);
  const words = item
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w));
  const haystack = text.toLowerCase();
  const hits = words.filter((w) => haystack.includes(w)).length;
  return words.length > 0 && hits / words.length >= 0.4;
}
