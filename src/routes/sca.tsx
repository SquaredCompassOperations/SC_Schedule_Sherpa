import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { suggestScaLcats, SCA_DIRECTORY_URL } from "@/lib/sca-suggest.functions";
import { useAutomation, setSelectedLcats, type SelectedLcat } from "@/lib/automation-store";
import { useIntake } from "@/lib/intake-store";

export const Route = createFileRoute("/sca")({
  head: () => ({ meta: [{ title: "LCAT Confirmation — ScheduleBuilder" }] }),
  component: ScaPage,
});

type Suggestion = {
  code: string;
  title: string;
  family: string;
  confidence: number;
  rationale: string;
};

function ScaPage() {
  const fn = useServerFn(suggestScaLcats);
  const automation = useAutomation();
  const intake = useIntake();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(automation.selectedLcats.map((l) => l.code)),
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (automation.selectedSins.length === 0) {
      setError("Select at least one SIN in the SIN Recommendation module first.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const res = await fn({
        data: {
          sins: automation.selectedSins.map((s) => ({ code: s.code, title: s.title })),
          businessSummary: intake.corporate.legalName
            ? `${intake.corporate.legalName} — ${intake.corporate.businessTypes || ""}. NAICS ${intake.corporate.naicsPrimary}.`
            : undefined,
        },
      });
      if (res.error) setError(res.error);
      setSuggestions(res.suggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suggestion failed");
    } finally {
      setRunning(false);
    }
  };

  const toggle = (code: string) => {
    const next = new Set(picked);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setPicked(next);
  };

  const save = () => {
    const lcats: SelectedLcat[] = suggestions
      .filter((s) => picked.has(s.code))
      .map((s) => ({ code: s.code, title: s.title, family: s.family, rationale: s.rationale }));
    setSelectedLcats(lcats);
  };

  return (
    <>
      <PageHeader
        eyebrow="Automation Engine • Module 3"
        title="LCAT Confirmation"
        description="Take the LCATs identified in Market Validation along with the client's position descriptions, and match each to the best-fit Service Contract Act (SCA) occupation from the DOL SCA Directory of Occupations (Fifth Edition). Rename LCATs where applicable. Not all roles will have an SCA equivalent."
        actions={
          <div className="text-right">
            <div className="text-[10px] font-mono text-muted-foreground uppercase">Selected</div>
            <div className="text-2xl font-mono font-bold text-primary leading-none">{picked.size}</div>
          </div>
        }
      />

      <Panel title="Generate suggestions" className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Using {automation.selectedSins.length} selected SIN{automation.selectedSins.length === 1 ? "" : "s"}:{" "}
            {automation.selectedSins.map((s) => s.code).join(", ") || "(none — select SINs first)"}
          </div>
          <div className="flex gap-2">
            <button
              onClick={run}
              disabled={running || automation.selectedSins.length === 0}
              className="text-xs font-bold uppercase tracking-widest px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {running ? "Suggesting…" : "Suggest LCATs"}
            </button>
            <button
              onClick={save}
              disabled={suggestions.length === 0}
              className="text-xs font-bold uppercase tracking-widest px-4 py-2 border border-border rounded-sm hover:bg-muted disabled:opacity-40"
            >
              Save Selection
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-3 text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-sm px-3 py-2">
            {error}
          </div>
        )}
        <div className="mt-3 text-[10px] font-mono text-muted-foreground">
          Source:{" "}
          <a href={SCA_DIRECTORY_URL} target="_blank" rel="noreferrer" className="underline">
            SCA Directory of Occupations (Fifth Edition)
          </a>
          {" — "}curated subset; manual additions allowed.
        </div>
      </Panel>

      {suggestions.length > 0 && (
        <div className="border border-border rounded-sm bg-card overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 w-8"></th>
                <th className="text-left px-3 py-2">Code</th>
                <th className="text-left px-3 py-2">Title</th>
                <th className="text-left px-3 py-2">Family</th>
                <th className="text-left px-3 py-2">Rationale</th>
                <th className="text-right px-3 py-2 w-16">Conf</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {suggestions.map((s) => (
                <tr key={s.code} className={picked.has(s.code) ? "bg-primary/5" : ""}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={picked.has(s.code)}
                      onChange={() => toggle(s.code)}
                      className="accent-primary"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono">{s.code}</td>
                  <td className="px-3 py-2 font-medium">{s.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.family}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.rationale}</td>
                  <td className="px-3 py-2 text-right font-mono">{s.confidence}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {automation.selectedLcats.length > 0 && (
        <Panel title="Currently saved LCATs" className="mt-6">
          <div className="flex flex-wrap gap-1.5">
            {automation.selectedLcats.map((l) => (
              <span
                key={l.code}
                className="text-[11px] font-mono px-2 py-1 bg-muted rounded-sm border border-border"
              >
                {l.code} — {l.title}
              </span>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}
