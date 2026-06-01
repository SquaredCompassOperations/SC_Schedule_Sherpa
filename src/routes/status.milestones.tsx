import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { useStatus } from "@/lib/status-data";

export const Route = createFileRoute("/status/milestones")({
  component: MilestonesPage,
});

function MilestonesPage() {
  const { milestones } = useStatus();
  return (
    <>
      <PageHeader
        eyebrow="Status Tracker"
        title="Milestones"
        description="Key dates from kickoff through submission."
      />
      <Panel title="Timeline">
        <ol className="space-y-3">
          {milestones.map((m) => (
            <li key={m.id} className="flex gap-3 items-start">
              <div
                className={`mt-1 size-3 rounded-full shrink-0 ${
                  m.status === "done"
                    ? "bg-success"
                    : m.status === "current"
                      ? "bg-primary animate-pulse"
                      : "border border-border"
                }`}
              />
              <div className="flex-1 border-b border-border pb-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-sm font-bold">{m.label}</div>
                  <div className="text-[11px] font-mono text-muted-foreground">{m.date}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{m.detail}</div>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );
}
