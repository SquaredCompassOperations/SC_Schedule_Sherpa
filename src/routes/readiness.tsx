import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader, Panel } from "@/components/ui-primitives";
import {
  buildIntakeReadinessCategories,
  calculateReadinessComposite,
  type ReadinessStatus,
} from "@/lib/intake-readiness";
import { useIntake } from "@/lib/intake-store";

export const Route = createFileRoute("/readiness")({
  head: () => ({ meta: [{ title: "Readiness Assessment — ScheduleBuilder" }] }),
  component: ReadinessPage,
});

function ReadinessPage() {
  const intake = useIntake();

  const categories = useMemo(() => buildIntakeReadinessCategories(intake), [intake]);

  const composite = useMemo(() => {
    return calculateReadinessComposite(categories);
  }, [categories]);

  return (
    <>
      <PageHeader
        eyebrow="Module 2 • Intake & Readiness"
        title="Readiness Assessment"
        description="Live readiness score and remaining level of effort derived from the Client Intake. Run before locking SINs."
        actions={
          <div className="text-right">
            <div className="text-[10px] font-mono text-muted-foreground uppercase">Composite</div>
            <div className="text-4xl font-mono font-extrabold text-primary leading-none">
              {composite}
            </div>
          </div>
        }
      />

      <Panel title="Readiness Categories" className="p-0">
        <div className="divide-y divide-border">
          {categories.map((c) => (
            <div key={c.name} className="p-4">
              <div className="flex justify-between items-baseline mb-2 gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-foreground">{c.name}</div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{c.detail}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">
                    Effort remaining
                  </div>
                  <div className="text-sm font-mono font-bold text-foreground">{c.effort}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    Weight {c.weight}%
                  </div>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    c.status === "complete"
                      ? "bg-success"
                      : c.status === "partial"
                        ? "bg-warning"
                        : "bg-destructive"
                  }`}
                  style={{
                    width: c.status === "complete" ? "100%" : c.status === "partial" ? "50%" : "8%",
                  }}
                />
              </div>
              {c.action ? (
                <div className="mt-3">
                  <a
                    href={c.action.href}
                    className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 inline-block border border-border bg-background rounded-sm hover:bg-muted"
                  >
                    {c.action.label} →
                  </a>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

function StatusBadge({ status }: { status: ReadinessStatus }) {
  const cls =
    status === "complete"
      ? "bg-success/10 text-success border-success/30"
      : status === "partial"
        ? "bg-warning/10 text-warning border-warning/30"
        : "bg-destructive/10 text-destructive border-destructive/30";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[9px] font-mono font-bold uppercase border ${cls}`}
    >
      {status}
    </span>
  );
}
