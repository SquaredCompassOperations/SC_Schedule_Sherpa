import { createFileRoute } from "@tanstack/react-router";
import { useStatus } from "@/lib/status-data";
import { CLIENT } from "@/lib/mock-data";
import { useEntity } from "@/lib/intake-store";

export const Route = createFileRoute("/client/")({
  component: ClientOverview,
});

function ClientOverview() {
  const status = useStatus();
  const entity = useEntity();
  const nextMilestone = status.milestones.find((m) => m.status === "current" || m.status === "upcoming");

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Your GSA MAS Offer
        </div>
        <h1 className="text-3xl font-bold mt-1">{entity.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {CLIENT.schedule} · {CLIENT.solicitation}
        </p>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border rounded-sm p-5 bg-card">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Overall Progress</div>
          <div className="text-4xl font-mono font-bold text-primary mt-1 leading-none">
            {status.composite}%
          </div>
          <div className="mt-3 h-2 bg-muted rounded-sm overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${status.composite}%` }} />
          </div>
        </div>
        <div className="border border-border rounded-sm p-5 bg-card">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Current Stage</div>
          <div className="text-xl font-bold mt-1">{status.currentStage.label}</div>
          <div className="text-xs text-muted-foreground mt-1">{status.currentStage.description}</div>
        </div>
        <div className="border border-border rounded-sm p-5 bg-card">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Next Milestone</div>
          <div className="text-xl font-bold mt-1">{nextMilestone?.label ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {nextMilestone ? `Target: ${nextMilestone.date}` : "All milestones complete"}
          </div>
        </div>
      </div>

      <div className="border border-border rounded-sm bg-card p-5">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Pipeline
        </h2>
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
              <div className="text-[10px] font-mono uppercase text-muted-foreground">{s.status}</div>
              <div className="text-sm font-bold mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-border rounded-sm bg-card p-5">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          What we need from you
        </h2>
        {status.openItems.filter((i) => i.owner === "Client").length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Nothing on your plate right now. We'll reach out when we need anything.
          </div>
        ) : (
          <ul className="space-y-2">
            {status.openItems
              .filter((i) => i.owner === "Client")
              .map((i) => (
                <li key={i.id} className="text-sm border-l-2 border-warning pl-3">
                  {i.title}
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
