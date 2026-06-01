import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { useStatus } from "@/lib/status-data";

export const Route = createFileRoute("/status/activity")({
  component: ActivityPage,
});

function ActivityPage() {
  const { activity } = useStatus();
  return (
    <>
      <PageHeader
        eyebrow="Status Tracker"
        title="Activity Log"
        description="Recent events across the offer pipeline."
      />
      <Panel title="Recent">
        <ul className="space-y-2">
          {activity.map((e) => (
            <li key={e.id} className="flex gap-3 text-xs border-b border-border/50 pb-2">
              <div className="text-[11px] font-mono text-muted-foreground w-24 shrink-0">
                {e.ts}
              </div>
              <div className="text-[10px] font-mono uppercase text-primary w-32 shrink-0">
                {e.module}
              </div>
              <div className="flex-1">{e.message}</div>
              {e.clientVisible && (
                <span className="text-[9px] font-mono text-muted-foreground border border-border rounded-sm px-1">
                  CLIENT
                </span>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
