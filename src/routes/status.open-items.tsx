import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { useStatus } from "@/lib/status-data";

export const Route = createFileRoute("/status/open-items")({
  component: OpenItemsPage,
});

function OpenItemsPage() {
  const { openItems } = useStatus();
  return (
    <>
      <PageHeader
        eyebrow="Status Tracker"
        title="Open Items"
        description="Blockers and action items, derived from per-module readiness."
      />
      <Panel title={`${openItems.length} open`}>
        {openItems.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nothing blocking — clear runway.</div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase text-muted-foreground border-b border-border">
                <th className="py-2">Item</th>
                <th className="py-2">Module</th>
                <th className="py-2">Owner</th>
                <th className="py-2 text-right">Severity</th>
              </tr>
            </thead>
            <tbody>
              {openItems.map((i) => (
                <tr key={i.id} className="border-b border-border/50">
                  <td className="py-2 text-sm">{i.title}</td>
                  <td className="py-2 font-mono text-muted-foreground">{i.module}</td>
                  <td className="py-2">{i.owner}</td>
                  <td className="py-2 text-right">
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${
                        i.severity === "high"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-warning/15 text-warning"
                      }`}
                    >
                      {i.severity.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
