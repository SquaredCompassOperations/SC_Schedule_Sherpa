import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { LABOR_CATEGORIES } from "@/lib/mock-data";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: "Pricing Workbook — ScheduleBuilder" }] }),
  component: PricingPage,
});

function PricingPage() {
  const [rows, setRows] = useState(LABOR_CATEGORIES);
  const avgDiscount =
    rows.reduce((acc, r) => acc + (1 - r.gsa / r.commercial), 0) / rows.length;

  const update = (i: number, key: "commercial" | "gsa", v: string) => {
    const n = parseFloat(v) || 0;
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: n } : r)));
  };

  return (
    <>
      <PageHeader
        eyebrow="Commercial Price List → Proposed GSA Price List"
        title="Pricing & Labor Category Builder"
        description="Define labor categories, set commercial rates, compute proposed GSA rates, and auto-generate the discounting summary and EPA narrative."
        actions={
          <div className="text-right">
            <div className="text-[10px] font-mono text-muted-foreground uppercase">Avg Discount</div>
            <div className="text-2xl font-mono font-bold text-primary leading-none">
              {(avgDiscount * 100).toFixed(1)}%
            </div>
          </div>
        }
      />

      <Panel title="Labor Category Matrix" className="p-0 mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Education</th>
                <th className="px-4 py-2 text-right">Years</th>
                <th className="px-4 py-2 text-right">Commercial $/hr</th>
                <th className="px-4 py-2 text-right">GSA $/hr</th>
                <th className="px-4 py-2 text-right">Discount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => {
                const disc = 1 - r.gsa / r.commercial;
                return (
                  <tr key={r.code} className="font-mono text-xs">
                    <td className="px-4 py-2 text-muted-foreground">{r.code}</td>
                    <td className="px-4 py-2 font-sans text-foreground font-medium">{r.title}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.education}</td>
                    <td className="px-4 py-2 text-right">{r.years}</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        value={r.commercial}
                        onChange={(e) => update(i, "commercial", e.target.value)}
                        className="w-20 text-right bg-background border border-border rounded-sm px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        value={r.gsa}
                        onChange={(e) => update(i, "gsa", e.target.value)}
                        className="w-20 text-right bg-background border border-primary/40 rounded-sm px-1.5 py-0.5 font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </td>
                    <td className={`px-4 py-2 text-right font-bold ${disc >= 0.1 ? "text-success" : "text-warning"}`}>
                      {(disc * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-12 gap-6">
        <Panel title="Discounting Summary" className="col-span-12 lg:col-span-6">
          <div className="space-y-2 text-xs">
            <Row label="Most Favored Customer (MFC) discount" value="12.0%" />
            <Row label="Proposed GSA discount vs commercial" value={`${(avgDiscount * 100).toFixed(1)}%`} />
            <Row label="Differential vs MFC" value={`+${(avgDiscount * 100 - 12).toFixed(1)} pts`} />
            <Row label="Prompt payment terms" value="Net 30 / 1% 10 Net 30" />
            <Row label="Volume discount" value="None proposed" />
          </div>
        </Panel>

        <Panel title="EPA Narrative" className="col-span-12 lg:col-span-6">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pursuant to GSAR 552.216-70, the offeror proposes annual escalation of 3.0% applied to all
            labor categories on contract anniversary. Methodology references the BLS Employment Cost
            Index, Private Industry Workers, Professional and Business Services…
          </p>
          <button className="mt-3 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm hover:bg-muted">
            Regenerate via Document Generator
          </button>
        </Panel>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center border-b border-border/50 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-bold">{value}</span>
    </div>
  );
}
