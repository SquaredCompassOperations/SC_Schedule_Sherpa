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

const STATUS_ORDER: DocState["status"][] = ["draft", "review", "final"];

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

  const advanceStatus = () => {
    const i = STATUS_ORDER.indexOf(current.status);
    const next = STATUS_ORDER[Math.min(i + 1, STATUS_ORDER.length - 1)];
    update(active.name, { status: next, savedAt: Date.now(), dirty: false });
  };


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
        eyebrow="AI-Assisted Drafting"
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
                      <StatusPill status={s.status} />
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
                  disabled={mutation.isPending}
                  className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {mutation.isPending ? "Generating…" : current.text ? "Regenerate" : "Generate Draft"}
                </button>
                <button
                  onClick={save}
                  disabled={!current.dirty}
                  className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm hover:bg-muted disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  onClick={advanceStatus}
                  disabled={!current.text || current.status === "final"}
                  className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm hover:bg-muted disabled:opacity-40"
                  title={current.status === "draft" ? "Mark ready for Review" : current.status === "review" ? "Mark Final" : "Already Final"}
                >
                  {current.status === "draft" ? "Mark for Review" : current.status === "review" ? "Approve Final" : "Final"}
                </button>
                <button
                  onClick={() => exportDocx(active.name, current.text)}
                  disabled={!current.text}
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
            <textarea
              value={current.text}
              onChange={(e) => update(active.name, { text: e.target.value, dirty: true })}
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
              <Field k="UEI" v={CLIENT.uei} />
              <Field k="CAGE" v={CLIENT.cage} />
              <Field k="NAICS" v={CLIENT.naicsPrimary} />
              <Field k="POC" v={CLIENT.poc} />
              <Field k="Employees" v={String(CLIENT.employees)} />
              <Field k="Socioeconomic" v={CLIENT.socioeconomic} />
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
