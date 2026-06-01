import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { useStatus } from "@/lib/status-data";
import { CLIENT } from "@/lib/mock-data";

export const Route = createFileRoute("/status/")({
  component: StatusOverview,
});

function StatusOverview() {
  const status = useStatus();
  return (
    <>
      <PageHeader
        eyebrow="Status Tracker"
        title="Overview"
        description="High-level view of where this offer stands today."
        actions={
          <div className="text-right">
            <div className="text-[10px] font-mono text-muted-foreground uppercase">Readiness</div>
            <div className="text-3xl font-mono font-bold text-primary leading-none">
              {status.composite}%
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        <Panel title="Current Stage" className="col-span-12 md:col-span-4">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">
            {CLIENT.name}
          </div>
          <div className="text-xl font-bold mt-1">{status.currentStage.label}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {status.currentStage.description}
          </div>
        </Panel>

        <Panel title="Pipeline" className="col-span-12 md:col-span-8">
          <div className="flex items-stretch gap-1">
            {status.stages.map((s) => (
              <div
                key={s.id}
                className={`flex-1 p-3 rounded-sm border ${
                  s.status === "complete"
                    ? "bg-success/10 border-success/40"
                    : s.status === "active"
                      ? "bg-primary/10 border-primary/40"
                      : "bg-muted border-border"
                }`}
              >
                <div className="text-[10px] font-mono uppercase text-muted-foreground">
                  {s.status}
                </div>
                <div className="text-sm font-bold mt-1">{s.label}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{s.description}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Per-Module Readiness" className="col-span-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {status.rollup.modules.map((m) => (
              <div key={m.slug} className="p-3 border border-border rounded-sm bg-surface">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">{m.label}</div>
                <div className="text-2xl font-mono font-bold mt-1">{m.score}%</div>
                <div className="text-[11px] text-muted-foreground mt-1">{m.summary}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
