import { createFileRoute } from "@tanstack/react-router";
import { useStatus } from "@/lib/status-data";

export const Route = createFileRoute("/client/messages")({
  component: ClientMessages,
});

function ClientMessages() {
  const { activity } = useStatus();
  const visible = activity.filter((e) => e.clientVisible);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Updates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recent activity on your offer.
        </p>
      </div>
      <div className="border border-border rounded-sm bg-card p-5">
        {visible.length === 0 ? (
          <div className="text-sm text-muted-foreground">No updates yet.</div>
        ) : (
          <ul className="space-y-3">
            {visible.map((e) => (
              <li key={e.id} className="border-b border-border/50 pb-3">
                <div className="text-[10px] font-mono uppercase text-primary">{e.module}</div>
                <div className="text-sm mt-0.5">{e.message}</div>
                <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{e.ts}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
