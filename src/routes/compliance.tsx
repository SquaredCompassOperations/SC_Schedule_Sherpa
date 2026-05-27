import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, StatusPill } from "@/components/ui-primitives";
import { COMPLIANCE_MATRIX } from "@/lib/mock-data";

type ComplianceStatus = "valid" | "review" | "missing" | "na";

export const Route = createFileRoute("/compliance")({
  head: () => ({ meta: [{ title: "Compliance Matrix — ScheduleBuilder" }] }),
  component: CompliancePage,
});

function CompliancePage() {
  const [rows, setRows] = useState(COMPLIANCE_MATRIX.map((r) => ({ ...r })));
  const valid = rows.filter((r) => r.status === "valid").length;
  const review = rows.filter((r) => r.status === "review").length;
  const missing = rows.filter((r) => r.status === "missing").length;

  const cycleStatus = (ref: string) => {
    const order: ComplianceStatus[] = ["missing", "review", "valid"];
    setRows((prev) =>
      prev.map((r) => {
        if (r.ref !== ref) return r;
        const idx = order.indexOf(r.status as ComplianceStatus);
        const next = order[(idx + 1) % order.length];
        return { ...r, status: next };
      }),
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="MAS Solicitation Refresh 18"
        title="Compliance Matrix"
        description="Solicitation requirements mapped to source documents. Missing items block eOffer export."
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Verified" value={valid} tone="success" />
        <Stat label="In Review" value={review} tone="warning" />
        <Stat label="Missing" value={missing} tone="destructive" />
      </div>

      <Panel className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Ref</th>
                <th className="px-4 py-2 text-left">Requirement</th>
                <th className="px-4 py-2 text-left">Source Document</th>
                <th className="px-4 py-2 text-right">Status</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.ref}>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{r.ref}</td>
                  <td className="px-4 py-3 text-foreground">{r.req}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-primary">{r.source}</td>
                  <td className="px-4 py-3 text-right"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "missing" ? (
                      <Link
                        to="/documents"
                        className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
                      >
                        Generate →
                      </Link>
                    ) : (
                      <button
                        onClick={() => cycleStatus(r.ref)}
                        className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
                      >
                        Update
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const map: Record<string, string> = {
    success: "text-success border-success/30 bg-success/5",
    warning: "text-warning border-warning/30 bg-warning/5",
    destructive: "text-destructive border-destructive/30 bg-destructive/5",
  };
  return (
    <div className={`border rounded-sm p-4 ${map[tone]}`}>
      <div className="text-[10px] font-mono uppercase tracking-widest">{label}</div>
      <div className="text-3xl font-mono font-extrabold mt-1">{value}</div>
    </div>
  );
}
