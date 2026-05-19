import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { CLIENT } from "@/lib/mock-data";

export const Route = createFileRoute("/readiness")({
  head: () => ({ meta: [{ title: "Readiness Assessment — ScheduleBuilder" }] }),
  component: ReadinessPage,
});

const CATEGORIES = [
  { name: "Financial Capacity", score: 92, weight: 20, notes: "Positive net income FY22–FY24. 2× commercial sales threshold met." },
  { name: "Commercial Sales History", score: 95, weight: 20, notes: "$4.8M largest contract documented; 24+ months commercial sales." },
  { name: "Past Performance", score: 88, weight: 15, notes: "3 relevant CPARS references on file." },
  { name: "Corporate Capability", score: 90, weight: 15, notes: "Capability statement, key personnel, project summaries draft-ready." },
  { name: "Compliance Posture", score: 78, weight: 15, notes: "EPA narrative pending review; CSP-1 in draft." },
  { name: "Pricing Discipline", score: 82, weight: 10, notes: "MFC discount documented; GSA target ≥ MFC." },
  { name: "Registration Completeness", score: 70, weight: 5, notes: "FAS ID & eOffer digital cert pending." },
];

function ReadinessPage() {
  const total = CATEGORIES.reduce((acc, c) => acc + c.score * (c.weight / 100), 0);
  return (
    <>
      <PageHeader
        eyebrow="Pathways to Success • MAS Readiness"
        title="Readiness Assessment Dashboard"
        description="GSA Pathways to Success checkpoints and weighted readiness scoring. Run before locking SINs."
        actions={
          <div className="text-right">
            <div className="text-[10px] font-mono text-muted-foreground uppercase">Composite</div>
            <div className="text-4xl font-mono font-extrabold text-primary leading-none">{total.toFixed(1)}</div>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <Panel title="Category Scores" className="p-0">
            <div className="divide-y divide-border">
              {CATEGORIES.map((c) => (
                <div key={c.name} className="p-4">
                  <div className="flex justify-between items-baseline mb-2">
                    <div>
                      <div className="text-sm font-bold text-foreground">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground">{c.notes}</div>
                    </div>
                    <div className="text-right shrink-0 pl-4">
                      <div className="text-2xl font-mono font-bold text-foreground">{c.score}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">Weight {c.weight}%</div>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${c.score >= 85 ? "bg-success" : c.score >= 70 ? "bg-warning" : "bg-destructive"}`}
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Panel title="Pathways to Success">
            <ul className="space-y-3 text-xs">
              {[
                "Complete Pathways to Success training",
                "Complete MAS Readiness Assessment",
                "Review current MAS solicitation",
                "Complete SAM.gov / FAS ID registration",
                "Gather required corporate documents",
                "Prepare and submit offer via eOffer",
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-2">
                  <span className={`size-4 rounded-full flex items-center justify-center text-[9px] font-mono shrink-0 mt-0.5 ${i < 4 ? "bg-success text-success-foreground" : "border border-border"}`}>
                    {i < 4 ? "✓" : i + 1}
                  </span>
                  <span className={i < 4 ? "text-foreground" : "text-muted-foreground"}>{step}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Output Artifacts">
            <ul className="space-y-2 text-xs">
              <li className="flex justify-between"><span>Readiness Report</span><span className="font-mono text-primary">Ready</span></li>
              <li className="flex justify-between"><span>Registration Gap List</span><span className="font-mono text-warning">2 items</span></li>
              <li className="flex justify-between"><span>Offer Checklist</span><span className="font-mono text-primary">Ready</span></li>
              <li className="flex justify-between"><span>Client Task Tracker</span><span className="font-mono text-muted-foreground">8 open</span></li>
            </ul>
          </Panel>

          <Panel>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Client
            </div>
            <div className="text-sm font-bold">{CLIENT.name}</div>
            <div className="text-[11px] font-mono text-muted-foreground mt-1">{CLIENT.solicitation}</div>
          </Panel>
        </div>
      </div>
    </>
  );
}
