import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Panel, StatusPill } from "@/components/ui-primitives";
import { DOCUMENT_QUEUE, CLIENT, DOC_CRITERIA } from "@/lib/mock-data";
import { generateNarrative } from "@/lib/narrative.functions";

export const Route = createFileRoute("/documents")({
  head: () => ({ meta: [{ title: "Document Generator — ScheduleBuilder" }] }),
  component: DocsPage,
});

function DocsPage() {
  const [active, setActive] = useState(DOCUMENT_QUEUE[0]);
  const [text, setText] = useState("");
  const fn = useServerFn(generateNarrative);

  const mutation = useMutation({
    mutationFn: async (kind: string) => fn({ data: { kind, context: contextString() } }),
    onSuccess: (res) => setText(res.text),
  });

  return (
    <>
      <PageHeader
        eyebrow="AI-Assisted Drafting"
        title="Document Generator"
        description="Generates narratives, summaries, and policy text from the master intake record. Every draft requires human review before approval."
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4">
          <Panel title="Document Queue" className="p-0">
            <ul className="divide-y divide-border">
              {DOCUMENT_QUEUE.map((d) => (
                <li key={d.name}>
                  <button
                    onClick={() => {
                      setActive(d);
                      setText("");
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex justify-between items-center gap-3 ${
                      active.name === d.name ? "bg-primary/5 border-l-2 border-primary" : ""
                    }`}
                  >
                    <span className="text-xs font-medium truncate">{d.name}</span>
                    <StatusPill status={d.status} />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-8 space-y-6">
          <Panel
            title={active.name}
            trailing={
              <div className="flex gap-2">
                <button
                  onClick={() => mutation.mutate(active.kind)}
                  disabled={mutation.isPending}
                  className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {mutation.isPending ? "Generating…" : text ? "Regenerate" : "Generate Draft"}
                </button>
                <button className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm hover:bg-muted">
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
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={mutation.isPending ? "Drafting narrative with master intake context…" : "Click Generate Draft to produce AI-assisted narrative text using the master intake record. Edit freely before approval."}
              className="w-full h-80 p-4 text-sm border border-border bg-background rounded-sm focus:outline-none focus:ring-1 focus:ring-primary font-sans leading-relaxed"
            />
            <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span>Drafted using fields: UEI, CAGE, NAICS, SINs, POC, employee count</span>
              <span>{text.length.toLocaleString()} chars</span>
            </div>
          </Panel>

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
