import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { SIN_MATCHES } from "@/lib/mock-data";

export const Route = createFileRoute("/sin")({
  head: () => ({ meta: [{ title: "SIN Recommendation Engine — ScheduleBuilder" }] }),
  component: SinPage,
});

function SinPage() {
  const [selected, setSelected] = useState<string[]>(["54151S"]);
  const toggle = (code: string) =>
    setSelected((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));

  return (
    <>
      <PageHeader
        eyebrow="MAS Large Category • IT (Schedule 70)"
        title="SIN Recommendation Engine"
        description="Describe what the company sells. The engine maps offerings to likely Special Item Numbers and flags the SIN-specific documents required."
        actions={
          <div className="text-right">
            <div className="text-[10px] font-mono text-muted-foreground uppercase">Selected</div>
            <div className="text-2xl font-mono font-bold text-primary leading-none">{selected.length}</div>
          </div>
        }
      />

      <Panel title="What does the company sell?" className="mb-6">
        <textarea
          defaultValue="Cloud modernization, cybersecurity engineering, FedRAMP-aligned managed services, and data engineering for federal civilian and DoD customers."
          className="w-full px-3 py-2 text-sm border border-border bg-background rounded-sm focus:outline-none focus:ring-1 focus:ring-primary h-20"
        />
        <div className="flex justify-end mt-3">
          <button className="text-xs font-bold uppercase tracking-widest px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90">
            Re-run Matching
          </button>
        </div>
      </Panel>

      <div className="space-y-3">
        {SIN_MATCHES.map((s) => {
          const active = selected.includes(s.code);
          return (
            <div
              key={s.code}
              className={`border rounded-sm p-4 transition-colors ${active ? "border-primary bg-primary/5" : "border-border bg-card"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <input type="checkbox" checked={active} onChange={() => toggle(s.code)} className="mt-1 accent-primary" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm">{s.code}</span>
                      <span className="text-xs font-medium text-foreground">{s.title}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Required documents: {s.required.join(" • ")}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-mono font-bold text-foreground">{s.confidence}%</div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Match</div>
                  <div className="mt-2 w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${s.confidence > 80 ? "bg-success" : s.confidence > 60 ? "bg-warning" : "bg-destructive"}`}
                      style={{ width: `${s.confidence}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
