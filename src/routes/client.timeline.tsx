import { createFileRoute } from "@tanstack/react-router";
import { useStatus } from "@/lib/status-data";

export const Route = createFileRoute("/client/timeline")({
  component: ClientTimeline,
});

function ClientTimeline() {
  const { milestones } = useStatus();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Timeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Milestones across your GSA MAS offer.
        </p>
      </div>

      <div className="border border-border rounded-sm bg-card p-5">
        <ol className="space-y-4">
          {milestones.map((m) => (
            <li key={m.id} className="flex gap-4 items-start">
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
                  <div className="text-base font-bold">{m.label}</div>
                  <div className="text-xs font-mono text-muted-foreground">{m.date}</div>
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">{m.detail}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
