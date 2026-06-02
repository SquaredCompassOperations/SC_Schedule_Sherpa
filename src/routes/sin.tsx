import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { SIN_MATCHES } from "@/lib/mock-data";
import { crawlClientForSins } from "@/lib/sin-crawler.functions";
import { extractPriceListLcats } from "@/lib/price-list-extract.functions";
import { crawlPriceListFromSite } from "@/lib/price-list-crawl.functions";
import { useIntake } from "@/lib/intake-store";
import { useAutomation, setSelectedSins, setPriceListLcats } from "@/lib/automation-store";


export const Route = createFileRoute("/sin")({
  head: () => ({ meta: [{ title: "SIN Recommendation Engine — ScheduleBuilder" }] }),
  component: SinPage,
});

type Candidate = {
  code: string;
  title: string;
  confidence: number;
  rationale: string;
  source: string;
};

function SinPage() {
  const crawl = useServerFn(crawlClientForSins);
  const intake = useIntake();
  const automation = useAutomation();
  const [url, setUrl] = useState(intake.corporate.website || "");
  useEffect(() => {
    if (intake.corporate.website && !url) setUrl(intake.corporate.website);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intake.corporate.website]);
  const [selected, setSelected] = useState<string[]>(
    automation.selectedSins.length > 0 ? automation.selectedSins.map((s) => s.code) : ["54151S"],
  );
  const [matches, setMatches] = useState(
    SIN_MATCHES.map((m) => ({
      code: m.code,
      title: m.title,
      confidence: m.confidence,
      rationale: `Seed match. Required: ${m.required.join(", ")}.`,
      source: "Seed catalog",
    })) as Candidate[],
  );
  const [keywords, setKeywords] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Price list extraction
  const extractPl = useServerFn(extractPriceListLcats);
  const fileRef = useRef<HTMLInputElement>(null);
  const [plRunning, setPlRunning] = useState(false);
  const [plError, setPlError] = useState<string | null>(null);

  const toggle = (code: string) =>
    setSelected((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));

  const pullFromUrl = async () => {
    if (!url.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const res = await crawl({ data: { url: url.trim() } });
      if (res.error) setError(res.error);
      setKeywords(res.keywords);
      setSummary(res.summary);
      if (res.candidates.length > 0) setMatches(res.candidates);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Crawl failed");
    } finally {
      setRunning(false);
    }
  };

  const handlePriceListFile = async (file: File) => {
    setPlRunning(true);
    setPlError(null);
    try {
      const buf = await file.arrayBuffer();
      // base64 encode
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const dataBase64 = btoa(binary);
      const mediaType = file.type || "application/pdf";
      const res = await extractPl({ data: { filename: file.name, mediaType, dataBase64 } });
      if (res.error) setPlError(res.error);
      if (res.lcats.length === 0 && !res.error) {
        setPlError("No labor categories could be extracted from this file.");
      }
      setPriceListLcats(res.lcats, file.name);
    } catch (e) {
      setPlError(e instanceof Error ? e.message : "Extract failed");
    } finally {
      setPlRunning(false);
    }
  };


  return (
    <>
      <PageHeader
        eyebrow="MAS Large Category • IT (Schedule 70)"
        title="SIN Recommendation Engine"
        description="Pull from the client's website to crawl GSA eLibrary and rank applicable Special Item Numbers automatically."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const sel = matches
                  .filter((m) => selected.includes(m.code))
                  .map((m) => ({ code: m.code, title: m.title, confidence: m.confidence, rationale: m.rationale }));
                setSelectedSins(sel);
              }}
              className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-border rounded-sm hover:bg-muted"
            >
              Save Selections
            </button>
            <div className="text-right">
              <div className="text-[10px] font-mono text-muted-foreground uppercase">Selected</div>
              <div className="text-2xl font-mono font-bold text-primary leading-none">{selected.length}</div>
            </div>
            {automation.selectedSins.length > 0 && (
              <span className="text-[10px] font-mono uppercase tracking-widest text-success">
                {automation.selectedSins.length} saved
              </span>
            )}
          </div>
        }
      />

      <Panel title="Pull from client website" className="mb-6">
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://client-company.com"
            className="flex-1 px-3 py-2 text-sm font-mono border border-border bg-background rounded-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={pullFromUrl}
            disabled={running || !url.trim()}
            className="text-xs font-bold uppercase tracking-widest px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {running ? "Crawling…" : "Crawl & Match"}
          </button>
        </div>
        {error && (
          <div className="mt-3 text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-sm px-3 py-2">
            {error}
          </div>
        )}
        {summary && (
          <div className="mt-3 text-xs text-muted-foreground">
            <span className="font-bold uppercase tracking-widest text-foreground">Detected:</span> {summary}
          </div>
        )}
        {keywords.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {keywords.map((k) => (
              <span key={k} className="text-[10px] font-mono uppercase px-2 py-0.5 bg-muted text-muted-foreground rounded-sm">
                {k}
              </span>
            ))}
          </div>
        )}
      </Panel>

      <div className="space-y-3">
        {matches.map((s) => {
          const active = selected.includes(s.code);
          return (
            <div
              key={s.code}
              className={`border rounded-sm p-4 transition-colors ${active ? "border-primary bg-primary/5" : "border-border bg-card"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <input type="checkbox" checked={active} onChange={() => toggle(s.code)} className="mt-1 accent-primary" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm">{s.code}</span>
                      <span className="text-xs font-medium text-foreground">{s.title}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">{s.rationale}</div>
                    {s.source && s.source.startsWith("http") ? (
                      <a
                        href={s.source}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-mono uppercase tracking-widest text-primary hover:underline mt-1 inline-block"
                      >
                        eLibrary source ↗
                      </a>
                    ) : (
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
                        {s.source}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-mono font-bold text-foreground">{Math.round(s.confidence)}%</div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Match</div>
                  <div className="mt-2 w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${s.confidence > 80 ? "bg-success" : s.confidence > 60 ? "bg-warning" : "bg-destructive"}`}
                      style={{ width: `${s.confidence}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Panel title="Labor Categories from Commercial Price List" className="mt-8">
        <div className="text-[11px] text-muted-foreground mb-3">
          Upload the client's commercial price list (PDF, XLSX, CSV). Each distinct LCAT/offering is extracted and passed to Market Validation as the basis for the GSA Advantage benchmark.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,.txt,application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePriceListFile(f);
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={plRunning}
            className="text-xs font-bold uppercase tracking-widest px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {plRunning ? "Extracting…" : automation.priceListLcats.length > 0 ? "Re-upload Price List" : "Upload Price List"}
          </button>
          {automation.priceListSource && (
            <span className="text-[10px] font-mono text-muted-foreground">
              {automation.priceListSource}
              {automation.priceListExtractedAt && ` • ${new Date(automation.priceListExtractedAt).toLocaleString()}`}
            </span>
          )}
          <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {automation.priceListLcats.length} LCAT{automation.priceListLcats.length === 1 ? "" : "s"}
          </span>
        </div>
        {plError && (
          <div className="mt-3 text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-sm px-3 py-2">
            {plError}
          </div>
        )}
        {automation.priceListLcats.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left px-2 py-2">Labor Category / Offering</th>
                  <th className="text-left px-2 py-2">Unit</th>
                  <th className="text-left px-2 py-2">Commercial Rate</th>
                  <th className="text-left px-2 py-2">SIN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {automation.priceListLcats.map((l, i) => (
                  <tr key={`${l.title}-${i}`}>
                    <td className="px-2 py-2 font-medium">{l.title}</td>
                    <td className="px-2 py-2 text-muted-foreground">{l.unit || "—"}</td>
                    <td className="px-2 py-2 font-mono font-bold">{l.rate || "—"}</td>
                    <td className="px-2 py-2 font-mono text-muted-foreground">{l.sin || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

