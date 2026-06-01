import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Panel, StatusPill } from "@/components/ui-primitives";
import { ReadinessRollup } from "@/components/readiness-rollup";
import {
  CLIENT,
  COMPLIANCE_MATRIX,
  DOCUMENT_QUEUE,
  LABOR_CATEGORIES,
  REGISTRATION_ITEMS,
  SIN_MATCHES,
} from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Workspace — ScheduleBuilder" },
      { name: "description", content: "Active GSA MAS offer workspace overview, readiness score, registration gaps, SIN matches, and compliance progress." },
    ],
  }),
  component: WorkspacePage,
});

function WorkspacePage() {
  const verified = COMPLIANCE_MATRIX.filter((r) => r.status === "valid").length;
  const missing = COMPLIANCE_MATRIX.filter((r) => r.status === "missing").length;
  const gaps = REGISTRATION_ITEMS.filter((r) => r.status === "gap").length;

  return (
    <>
      <PageHeader
        eyebrow={`${CLIENT.schedule} • ${CLIENT.solicitation} • ${CLIENT.refresh}`}
        title={`Active Offer: ${CLIENT.name}`}
        description="Master intake record feeds every module below. All data shown is sourced from the single client profile."
        actions={
          <>
            <div className="text-right">
              <div className="text-[10px] font-mono text-muted-foreground uppercase">Readiness</div>
              <div className="text-2xl font-mono font-bold text-primary leading-none">{CLIENT.readiness}%</div>
            </div>
            <div className="w-32 h-10 bg-muted rounded-sm overflow-hidden relative border border-border">
              <div className="h-full bg-primary/20" style={{ width: `${CLIENT.readiness}%` }} />
              <div className="absolute inset-x-0 animate-scan bg-gradient-to-b from-transparent via-primary/40 to-transparent h-4" />
            </div>
          </>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Panel title="Registration Gaps">
            <ul className="space-y-3">
              {REGISTRATION_ITEMS.slice(0, 5).map((r) => (
                <li key={r.label} className="flex items-start gap-3">
                  <div className={`size-4 rounded-full shrink-0 mt-0.5 flex items-center justify-center ${r.status === "ok" ? "border border-success bg-success/10" : "border border-destructive bg-destructive/10"}`}>
                    <div className={`size-1.5 rounded-full ${r.status === "ok" ? "bg-success" : "bg-destructive"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-tight text-foreground">{r.label}</div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate">{r.note}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="SIN Recommendation" trailing={<Link to="/sin" className="text-[10px] text-primary font-bold uppercase tracking-tight">View All →</Link>}>
            <div className="space-y-2">
              {SIN_MATCHES.slice(0, 3).map((s) => (
                <div key={s.code} className="p-2 bg-muted/50 border border-border rounded-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold font-mono">{s.code}</span>
                    <span className={`text-[10px] font-mono font-bold px-1 rounded-sm ${s.confidence > 80 ? "bg-success/15 text-success" : s.confidence > 60 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>
                      {s.confidence}% MATCH
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight">{s.title}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-8 space-y-6">
          <Panel
            title="Compliance Matrix Progress"
            trailing={<span className="text-[10px] font-mono font-bold text-muted-foreground">{verified} / {COMPLIANCE_MATRIX.length} VERIFIED • {missing} MISSING</span>}
            className="p-0"
          >
            <div className="overflow-x-auto -m-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
                    <th className="px-4 py-2">Ref</th>
                    <th className="px-4 py-2">Requirement</th>
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-mono">
                  {COMPLIANCE_MATRIX.slice(0, 6).map((row) => (
                    <tr key={row.ref} className="border-b border-border/50">
                      <td className="px-4 py-2 text-muted-foreground">{row.ref}</td>
                      <td className="px-4 py-2 font-sans text-xs text-foreground">{row.req}</td>
                      <td className="px-4 py-2 text-primary truncate max-w-[140px]">{row.source}</td>
                      <td className="px-4 py-2 text-right"><StatusPill status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Panel title="Document Queue" trailing={<Link to="/documents" className="text-[10px] text-primary font-bold uppercase tracking-tight">Manage →</Link>}>
              <div className="space-y-2">
                {DOCUMENT_QUEUE.slice(0, 4).map((d) => (
                  <div key={d.name} className="flex items-center justify-between p-2 border border-border rounded-sm">
                    <span className="text-xs truncate pr-2">{d.name}</span>
                    <StatusPill status={d.status} />
                  </div>
                ))}
              </div>
            </Panel>

            <div className="bg-foreground text-background rounded-sm p-4 relative overflow-hidden flex flex-col">
              <div className="relative z-10 flex-1">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-1 text-muted-foreground">Export Ready</h3>
                <p className="text-[11px] text-muted-foreground mb-4">
                  Package build v1.0.4 • {missing} missing item{missing === 1 ? "" : "s"} blocking export
                </p>
                <Link
                  to="/export"
                  className="block w-full bg-primary py-2 text-center text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors rounded-sm text-primary-foreground"
                >
                  Generate eOffer Zip
                </Link>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10">
                <div className="size-24 border-4 border-background rounded-full" />
              </div>
            </div>
          </div>

          <Panel title="Labor Category Matrix Preview" trailing={<Link to="/pricing" className="text-[10px] text-primary font-bold uppercase tracking-tight">Open Workbook →</Link>}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {LABOR_CATEGORIES.slice(0, 4).map((l) => (
                <div key={l.code} className="p-3 border border-border rounded-sm bg-surface">
                  <div className="text-[10px] font-mono text-muted-foreground mb-1">{l.code}</div>
                  <div className="text-sm font-bold text-foreground leading-tight">{l.title}</div>
                  <div className="text-lg font-mono mt-2 text-foreground">
                    ${l.gsa.toFixed(2)}
                    <span className="text-[10px] font-normal text-muted-foreground">/hr GSA</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <ReadinessRollup />
        </div>
      </div>

      <div className="mt-8 text-[10px] font-mono text-muted-foreground border-t border-border pt-4">
        Gaps in registration: {gaps} • Pathways to Success completed • Authorized negotiator certification still required for submission.
      </div>
    </>
  );
}
