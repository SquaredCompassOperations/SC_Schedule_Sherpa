import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { runMarketValidation } from "@/lib/market-validation.functions";
import { useAutomation, setMarketRows, type MarketRow } from "@/lib/automation-store";

export const Route = createFileRoute("/market-validation")({
  head: () => ({ meta: [{ title: "Market Validation — ScheduleBuilder" }] }),
  component: MarketPage,
});

function MarketPage() {
  const fn = useServerFn(runMarketValidation);
  const automation = useAutomation();
  const [running, setRunning] = useState(false);
  const [activeSin, setActiveSin] = useState<string>(automation.selectedSins[0]?.code || "");
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  const rows = automation.marketRows;

  const run = async () => {
    if (!activeSin) {
      setError("Pick a SIN to validate.");
      return;
    }
    setRunning(true);
    setError(null);
    setNotes([]);
    try {
      const res = await fn({
        data: {
          sin: activeSin,
          lcats: automation.selectedLcats.map((l) => l.title).slice(0, 10),
        },
      });
      if (res.error) setError(res.error);
      setNotes(res.notes);
      setMarketRows(res.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  };

  const exportCsv = () => {
    const header = ["Client LCAT", "SIN", "Competitor Labor Category", "Unit of Issue", "GSA Net Price (incl. IFF)", "Contractor", "Contract #", "Source"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [r.clientLcat || "", r.sin, r.laborCategory, r.unitOfIssue, r.netPrice, r.contractor, r.contractNumber, r.sourceUrl]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `market-validation-${activeSin}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group rows by the client LCAT they benchmark
  const grouped = rows.reduce<Record<string, MarketRow[]>>((acc, r) => {
    const key = r.clientLcat || "Unassigned";
    (acc[key] ||= []).push(r);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        eyebrow="Automation Engine • Module 2"
        title="Market Validation"
        description="Identify Labor Categories (LCATs) from the client's uploaded price list or website, then cross-reference the 5 most recent GSA eLibrary contracts with matching offerings. Pulls SIN, Labor Category, Unit of Issue, and GSA Net Price (incl. IFF) into a comparable spreadsheet so commercial pricing can be validated against what the government is paying."
        actions={
          <div className="text-right">
            <div className="text-[10px] font-mono text-muted-foreground uppercase">Rows</div>
            <div className="text-2xl font-mono font-bold text-primary leading-none">{rows.length}</div>
          </div>
        }
      />

      <Panel title="Run benchmark" className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeSin}
            onChange={(e) => setActiveSin(e.target.value)}
            className="px-3 py-2 text-sm font-mono border border-border bg-background rounded-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">— Select SIN —</option>
            {automation.selectedSins.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} — {s.title}
              </option>
            ))}
          </select>
          <button
            onClick={run}
            disabled={running || !activeSin}
            className="text-xs font-bold uppercase tracking-widest px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {running ? "Scanning GSA Advantage…" : "Run Benchmark"}
          </button>
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="text-xs font-bold uppercase tracking-widest px-4 py-2 border border-border rounded-sm hover:bg-muted disabled:opacity-40"
          >
            Export CSV
          </button>
          <span className="text-[10px] font-mono text-muted-foreground ml-auto">
            Targets up to 5 contractors. Best-effort PDF parsing — review the "needs review" flag.
          </span>
        </div>
        {error && (
          <div className="mt-3 text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-sm px-3 py-2">
            {error}
          </div>
        )}
        {notes.length > 0 && (
          <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
            {notes.map((n, i) => (
              <li key={i}>• {n}</li>
            ))}
          </ul>
        )}
        {automation.marketRunAt && (
          <div className="mt-2 text-[10px] font-mono text-muted-foreground">
            Last run: {new Date(automation.marketRunAt).toLocaleString()}
          </div>
        )}
      </Panel>

      {rows.length > 0 && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([clientLcat, groupRows]) => {
            // compute simple avg of numeric netPrice for at-a-glance comparison
            const nums = groupRows
              .map((r) => Number(String(r.netPrice).replace(/[^0-9.]/g, "")))
              .filter((n) => !isNaN(n) && n > 0);
            const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
            return (
              <div key={clientLcat} className="border border-border rounded-sm bg-card overflow-hidden">
                <div className="flex items-baseline justify-between px-3 py-2 bg-muted/40 border-b border-border">
                  <div className="text-xs font-bold uppercase tracking-widest">{clientLcat}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {groupRows.length} comparable row{groupRows.length === 1 ? "" : "s"}
                    {avg !== null && <> • avg GSA net <span className="text-primary font-bold">${avg.toFixed(2)}</span></>}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2">Competitor Labor Category</th>
                        <th className="text-left px-3 py-2">UoI</th>
                        <th className="text-left px-3 py-2">GSA Net (w/ IFF)</th>
                        <th className="text-left px-3 py-2">Contractor</th>
                        <th className="text-left px-3 py-2">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {groupRows.map((r: MarketRow, i) => (
                        <tr key={i} className={r.needsReview ? "bg-warning/5" : ""}>
                          <td className="px-3 py-2">
                            {r.laborCategory}
                            {r.needsReview && (
                              <span className="ml-2 text-[9px] font-mono uppercase text-warning">review</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{r.unitOfIssue}</td>
                          <td className="px-3 py-2 font-mono font-bold">{r.netPrice}</td>
                          <td className="px-3 py-2 truncate max-w-[180px]" title={r.contractor}>{r.contractor}</td>
                          <td className="px-3 py-2">
                            <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline text-[10px] font-mono uppercase">
                              open ↗
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
