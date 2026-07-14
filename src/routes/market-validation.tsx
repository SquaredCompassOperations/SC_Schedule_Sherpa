import { createFileRoute, Link } from "@tanstack/react-router";
import { SaveAndContinue } from "@/components/save-and-continue";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { runMarketValidation } from "@/lib/market-validation.functions";
import { crawlClientForSins } from "@/lib/sin-crawler.functions";
import { crawlPriceListFromSite } from "@/lib/price-list-crawl.functions";
import {
  useAutomation,
  setMarketRows,
  setPriceListLcats,
  setSelectedSins,
  type MarketRow,
  type SelectedSin,
} from "@/lib/automation-store";
import { useSelectedOfferId, useSelectedOfferType } from "@/lib/offer-workspace";
import { useDocStore, patchDoc } from "@/lib/doc-store";
import { useIntake } from "@/lib/intake-store";
import {
  recommendedSelectedCodes,
  selectSinCandidatesForSave,
  type SinScanCandidate,
} from "@/lib/validation-workspace";
import {
  buildAutomationActions,
  getAutomationActionCommand,
  isActionControlChecked,
  isActionControlDisabled,
  getAgentAuthorizationDraftText,
  sendClientUpdateRequest,
  toggleDisabledAction,
  type AutomationAction,
  type AutomationActionId,
} from "@/lib/automation-workspace";

export const Route = createFileRoute("/market-validation")({
  head: () => ({ meta: [{ title: "Automation Workspace — Schedule Sherpa" }] }),
  component: AutomationWorkspacePage,
});

const AGENT_AUTH_DOC = "Agent Authorization Letter";

function AutomationWorkspacePage() {
  const fn = useServerFn(runMarketValidation);
  const sinScanFn = useServerFn(crawlClientForSins);
  const priceListCrawlFn = useServerFn(crawlPriceListFromSite);
  const automation = useAutomation();
  const docs = useDocStore();
  const intake = useIntake();
  const selectedOfferId = useSelectedOfferId();
  const offerType = useSelectedOfferType();
  const [selectedAction, setSelectedAction] = useState<AutomationActionId>("market-validation");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [activeSin, setActiveSin] = useState<string>(automation.selectedSins[0]?.code || "");
  const [scanUrl, setScanUrl] = useState(intake.corporate.website || "");
  const [scanRunning, setScanRunning] = useState(false);
  const [scanCandidates, setScanCandidates] = useState<SinScanCandidate[]>([]);
  const [scanSelectedCodes, setScanSelectedCodes] = useState<string[]>(
    automation.selectedSins.map((sin) => sin.code),
  );
  const [scanSummary, setScanSummary] = useState("");
  const [scanKeywords, setScanKeywords] = useState<string[]>([]);
  const [scanNotes, setScanNotes] = useState<string[]>([]);
  const [disabledActionIds, setDisabledActionIds] = useState<AutomationActionId[]>([]);
  const [clientUpdateSubject, setClientUpdateSubject] = useState("");
  const [clientUpdateBody, setClientUpdateBody] = useState("");

  useEffect(() => {
    if (intake.corporate.website && !scanUrl) {
      setScanUrl(intake.corporate.website);
    }
  }, [intake.corporate.website, scanUrl]);

  useEffect(() => {
    if (!activeSin && automation.selectedSins[0]?.code) {
      setActiveSin(automation.selectedSins[0].code);
    }
  }, [activeSin, automation.selectedSins]);

  const benchmarkLcats =
    automation.priceListLcats.length > 0
      ? automation.priceListLcats.map((l) => l.title)
      : automation.selectedLcats.map((l) => l.title);

  const actions = useMemo(
    () =>
      buildAutomationActions({
        offerType,
        marketRows: automation.marketRows.length,
        pricingRows: automation.pricingRows.length,
        hasAgentAuthorizationDraft: Boolean(docs[AGENT_AUTH_DOC]?.text),
        disabledActionIds,
      }),
    [
      automation.marketRows.length,
      automation.pricingRows.length,
      disabledActionIds,
      docs,
      offerType,
    ],
  );
  const selected = actions.find((action) => action.id === selectedAction) ?? actions[0];
  const selectedCommand = getAutomationActionCommand(selected);
  const enabledActions = actions.filter((action) => action.status !== "off").length;
  const spend = actions
    .filter((action) => action.status === "complete")
    .reduce((sum, action) => sum + Number(action.estimatedCost.replace(/[^0-9.]/g, "")), 0);

  const runSinScan = async () => {
    const url = scanUrl.trim();
    if (!url) {
      setError("Enter the client's website to run the SIN scan.");
      return;
    }

    setScanRunning(true);
    setError(null);
    setScanNotes([]);
    try {
      const res = await sinScanFn({ data: { url } });
      if (res.error) setError(res.error);

      const candidates: SinScanCandidate[] = res.candidates.map((candidate) => ({
        code: candidate.code,
        title: candidate.title,
        confidence: candidate.confidence,
        rationale: candidate.rationale,
        source: candidate.source,
      }));
      setScanCandidates(candidates);
      setScanSelectedCodes(recommendedSelectedCodes(candidates));
      setScanSummary(res.summary);
      setScanKeywords(res.keywords);

      if (automation.priceListLcats.length === 0) {
        try {
          const priceList = await priceListCrawlFn({ data: { url } });
          if (priceList.lcats.length > 0) {
            setPriceListLcats(priceList.lcats, priceList.source ?? `${url} price list`);
            setScanNotes(priceList.notes);
          } else if (priceList.error) {
            setScanNotes([...priceList.notes, priceList.error]);
          } else {
            setScanNotes(priceList.notes);
          }
        } catch (priceListError) {
          setScanNotes([
            priceListError instanceof Error
              ? priceListError.message
              : "Price list discovery failed.",
          ]);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "SIN scan failed.");
    } finally {
      setScanRunning(false);
    }
  };

  const toggleScanCode = (code: string) => {
    setScanSelectedCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  };

  const saveScannedSins = () => {
    const selectedSins = selectSinCandidatesForSave(scanCandidates, scanSelectedCodes);
    setSelectedSins(selectedSins);
    setActiveSin(selectedSins[0]?.code ?? "");
  };

  const runMarketScan = async () => {
    if (!activeSin) {
      setError("Pick a SIN to validate.");
      return;
    }
    if (benchmarkLcats.length === 0) {
      setError("No LCATs available. Upload the client's price list or save LCATs first.");
      return;
    }
    setRunning(true);
    setError(null);
    setNotes([]);
    try {
      const res = await fn({
        data: {
          offerId: selectedOfferId ?? undefined,
          sin: activeSin,
          lcats: benchmarkLcats.slice(0, 50),
        },
      });
      if (res.error) setError(res.error);
      setNotes(
        res.runId ? [`Run saved to workspace audit log: ${res.runId}`, ...res.notes] : res.notes,
      );
      setMarketRows(res.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  };

  const buildAgentAuthorization = () => {
    const negotiator = intake.negotiators[0];
    patchDoc(AGENT_AUTH_DOC, {
      text: getAgentAuthorizationDraftText({
        legalName: intake.corporate.legalName,
        authorizedAgent: negotiator?.name,
        contactEmail: negotiator?.email,
      }),
      status: "draft",
      dirty: true,
      savedAt: null,
      source: "generated",
    });
    setSelectedAction("agent-authorization");
  };

  const sendUpdate = () => {
    sendClientUpdateRequest({
      subject: clientUpdateSubject,
      body: clientUpdateBody,
      contactEmail: intake.negotiators[0]?.email,
    });
    setClientUpdateSubject("");
    setClientUpdateBody("");
  };

  return (
    <>
      <PageHeader
        eyebrow="Step 2 of 5 • Automation"
        title="On-demand actions"
        description="Costed jobs are explicit, role-gated, client-scoped, and controlled by monthly budget limits."
        actions={
          <div className="flex items-center gap-3">
            <div className="h-2 w-28 overflow-hidden rounded-sm bg-muted">
              <div className="h-full bg-primary" style={{ width: `${enabledActions * 25}%` }} />
            </div>
            <div className="text-[10px] font-mono font-bold text-muted-foreground">
              ${spend.toFixed(2)} / $120
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-8">
          <Panel
            title="Actions"
            trailing={
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Run access
              </span>
            }
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {actions.map((action) => (
                <AutomationActionCard
                  key={action.id}
                  action={action}
                  selected={selected.id === action.id}
                  onSelect={() => setSelectedAction(action.id)}
                />
              ))}
            </div>
          </Panel>
        </div>

        <div className="col-span-12 xl:col-span-4">
          <Panel title="Controls">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Budget cap" value="120" />
              <Field label="Current spend" value={`$${spend.toFixed(2)}`} />
            </div>
            <div className="mt-4 space-y-2">
              {actions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center justify-between rounded-sm border border-border px-2 py-1.5 text-xs"
                >
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isActionControlChecked(action)}
                      disabled={isActionControlDisabled(action)}
                      onChange={() =>
                        setDisabledActionIds((current) => toggleDisabledAction(current, action))
                      }
                    />
                    {action.title}
                  </label>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-widest ${
                      action.status === "off" ? "text-muted-foreground" : "text-success"
                    }`}
                  >
                    {action.status === "off" ? "Off" : "On"}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
      {notes.length > 0 ? (
        <ul className="mt-4 space-y-1 text-[11px] text-muted-foreground">
          {notes.map((note, index) => (
            <li key={index}>• {note}</li>
          ))}
        </ul>
      ) : null}

      <Panel title={selected.title} className="mt-6" trailing={null}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Status" value={statusLabel(selected.status)} />
          <Field label="Estimated cost" value={selected.estimatedCost} />
          <Field label="Source" value={selected.source} />
        </div>
        {selected.id === "market-validation" ? (
          <MarketValidationWorkspace
            activeSin={activeSin}
            benchmarkRunning={running}
            command={selectedCommand}
            marketRows={automation.marketRows}
            onActiveSin={setActiveSin}
            onRunBenchmark={runMarketScan}
            onRunSinScan={runSinScan}
            onSaveScannedSins={saveScannedSins}
            onScanUrl={setScanUrl}
            onToggleScanCode={toggleScanCode}
            priceListCount={automation.priceListLcats.length}
            priceListSource={automation.priceListSource}
            savedSins={automation.selectedSins}
            scanCandidates={scanCandidates}
            scanKeywords={scanKeywords}
            scanNotes={scanNotes}
            scanRunning={scanRunning}
            scanSelectedCodes={scanSelectedCodes}
            scanSummary={scanSummary}
            scanUrl={scanUrl}
          />
        ) : selected.id === "client-update" ? (
          <div className="mt-5 space-y-3">
            {selectedCommand.disabledReason ? (
              <div className="rounded-sm border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                {selectedCommand.disabledReason}
              </div>
            ) : null}
            <input
              value={clientUpdateSubject}
              onChange={(event) => setClientUpdateSubject(event.target.value)}
              placeholder="Request subject"
              className="h-10 w-full rounded-sm border border-border bg-background px-3 text-sm"
            />
            <textarea
              value={clientUpdateBody}
              onChange={(event) => setClientUpdateBody(event.target.value)}
              placeholder="What do you need from the client?"
              className="h-28 w-full rounded-sm border border-border bg-background p-3 text-sm"
            />
            <button
              type="button"
              onClick={sendUpdate}
              disabled={
                selectedCommand.disabled || !clientUpdateSubject.trim() || !clientUpdateBody.trim()
              }
              className="rounded-sm bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
            >
              {selectedCommand.label}
            </button>
          </div>
        ) : (
          <>
            <AutomationCommandBar
              command={selectedCommand}
              running={false}
              onRun={selected.id === "agent-authorization" ? buildAgentAuthorization : undefined}
            />
            <div className="mt-4 text-sm text-muted-foreground">{selected.description}</div>
          </>
        )}
      </Panel>

      <div className="mt-8 flex justify-end border-t border-border pt-4">
        <SaveAndContinue moduleSlug="/market-validation" nextHref="/documents" />
      </div>
    </>
  );
}

function MarketValidationWorkspace({
  activeSin,
  benchmarkRunning,
  command,
  marketRows,
  onActiveSin,
  onRunBenchmark,
  onRunSinScan,
  onSaveScannedSins,
  onScanUrl,
  onToggleScanCode,
  priceListCount,
  priceListSource,
  savedSins,
  scanCandidates,
  scanKeywords,
  scanNotes,
  scanRunning,
  scanSelectedCodes,
  scanSummary,
  scanUrl,
}: {
  activeSin: string;
  benchmarkRunning: boolean;
  command: ReturnType<typeof getAutomationActionCommand>;
  marketRows: MarketRow[];
  onActiveSin: (value: string) => void;
  onRunBenchmark: () => void;
  onRunSinScan: () => void;
  onSaveScannedSins: () => void;
  onScanUrl: (value: string) => void;
  onToggleScanCode: (value: string) => void;
  priceListCount: number;
  priceListSource: string | null;
  savedSins: SelectedSin[];
  scanCandidates: SinScanCandidate[];
  scanKeywords: string[];
  scanNotes: string[];
  scanRunning: boolean;
  scanSelectedCodes: string[];
  scanSummary: string;
  scanUrl: string;
}) {
  const benchmarkDisabled =
    command.disabled || benchmarkRunning || !activeSin || priceListCount === 0;

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-sm border border-border bg-surface p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Step 1 · SIN scan by website
            </div>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
              Crawl the client website to detect applicable Special Item Numbers before
              benchmarking. Saved SINs feed the benchmark dropdown and the downstream pricing
              workspace.
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-success">
            {savedSins.length} SIN saved{savedSins.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={scanUrl}
            onChange={(event) => onScanUrl(event.target.value)}
            placeholder="https://client-website.com"
            className="h-10 flex-1 rounded-sm border border-border bg-background px-3 text-sm"
          />
          <button
            type="button"
            onClick={onRunSinScan}
            disabled={scanRunning || !scanUrl.trim()}
            className="h-10 rounded-sm bg-primary px-4 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
          >
            {scanRunning ? "Scanning..." : "Run SIN Scan"}
          </button>
        </div>

        {scanSummary ? (
          <div className="mt-3 rounded-sm border border-border bg-muted/30 px-3 py-2 text-xs text-foreground">
            {scanSummary}
          </div>
        ) : null}

        {scanKeywords.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {scanKeywords.slice(0, 12).map((keyword) => (
              <span
                key={keyword}
                className="rounded-sm border border-border bg-background px-2 py-1 text-[10px] font-mono text-muted-foreground"
              >
                {keyword}
              </span>
            ))}
          </div>
        ) : null}

        {scanCandidates.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-sm border border-border">
            {scanCandidates.map((candidate) => (
              <label
                key={candidate.code}
                className="grid cursor-pointer grid-cols-[auto_1fr_auto] gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  checked={scanSelectedCodes.includes(candidate.code)}
                  onChange={() => onToggleScanCode(candidate.code)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-xs font-bold text-foreground">
                    {candidate.code} · {candidate.title}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {candidate.rationale}
                  </span>
                  <span className="mt-1 block truncate text-[10px] font-mono text-primary">
                    {candidate.source}
                  </span>
                </span>
                <span className="self-start rounded-sm border border-border px-2 py-1 text-[10px] font-mono font-bold">
                  {candidate.confidence}%
                </span>
              </label>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSaveScannedSins}
            disabled={scanCandidates.length === 0 || scanSelectedCodes.length === 0}
            className="rounded-sm border border-border px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-muted disabled:opacity-50"
          >
            Save selected SINs
          </button>
          {scanNotes.length > 0 ? (
            <span className="text-[11px] text-muted-foreground">{scanNotes[0]}</span>
          ) : null}
        </div>
      </div>

      <div className="rounded-sm border border-border bg-surface p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Step 2 · Run benchmark
            </div>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
              Run the Market Validation workflow against the saved SIN and the extracted price-list
              LCATs. Uploaded price lists from Intake and discovered website price lists both feed
              this step.
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {priceListCount} LCAT{priceListCount === 1 ? "" : "s"} from price list
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-2 md:flex-row">
          <MarketSinPicker activeSin={activeSin} onActiveSin={onActiveSin} sins={savedSins} />
          <button
            type="button"
            onClick={onRunBenchmark}
            disabled={benchmarkDisabled}
            className="h-10 rounded-sm bg-primary px-4 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
          >
            {benchmarkRunning ? "Running..." : "Run Benchmark"}
          </button>
        </div>

        {priceListCount === 0 ? (
          <div className="mt-3 rounded-sm border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
            Upload and extract the client's price list in Intake, or run the SIN scan so Schedule
            Sherpa can try to discover a public price list from the client website.
          </div>
        ) : (
          <div className="mt-3 rounded-sm border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">
            Price-list rows are ready{priceListSource ? ` from ${priceListSource}` : ""}.
          </div>
        )}

        {command.disabledReason ? (
          <div className="mt-3 rounded-sm border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
            {command.disabledReason}
          </div>
        ) : null}

        {marketRows.length > 0 ? <MarketRows rows={marketRows} /> : null}
      </div>
    </div>
  );
}

function AutomationCommandBar({
  command,
  running,
  onRun,
}: {
  command: ReturnType<typeof getAutomationActionCommand>;
  running: boolean;
  onRun?: () => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      {command.href && !command.disabled ? (
        <Link
          to={command.href}
          className="rounded-sm bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground"
        >
          {command.label} →
        </Link>
      ) : (
        <button
          type="button"
          onClick={onRun}
          disabled={command.disabled || running || !onRun}
          className="rounded-sm bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
        >
          {running ? "Running..." : command.label}
        </button>
      )}
      {command.disabledReason ? (
        <span className="text-xs text-muted-foreground">{command.disabledReason}</span>
      ) : null}
    </div>
  );
}

function AutomationActionCard({
  action,
  selected,
  onSelect,
}: {
  action: AutomationAction;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`min-h-32 rounded-sm border p-4 ${
        selected ? "border-primary bg-primary/5" : "border-border bg-surface"
      } text-left transition-colors hover:border-primary/60`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-foreground">{action.title}</h2>
        </div>
        <div className="flex gap-1">
          <span className="rounded-sm border border-border px-2 py-1 text-[9px] font-bold uppercase tracking-widest">
            {selected ? "Selected" : "Open"}
          </span>
        </div>
      </div>
      <div
        className={`mt-4 inline-flex rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
          action.status === "off"
            ? "bg-warning/10 text-warning"
            : action.status === "complete"
              ? "bg-success/10 text-success"
              : "bg-success/10 text-success"
        }`}
      >
        {statusLabel(action.status)}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">{action.description}</p>
      <div className="mt-4 text-[10px] font-mono text-muted-foreground">
        Output: {action.output}
      </div>
      <div className="mt-1 text-[10px] font-mono text-primary">{action.source}</div>
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-muted/40 px-3 py-2">
      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-mono font-bold text-foreground">{value}</div>
    </div>
  );
}

function MarketSinPicker({
  activeSin,
  onActiveSin,
  sins,
}: {
  activeSin: string;
  onActiveSin: (value: string) => void;
  sins: Array<{ code: string; title: string }>;
}) {
  return (
    <select
      value={activeSin}
      onChange={(event) => onActiveSin(event.target.value)}
      className="h-8 rounded-sm border border-border bg-background px-2 text-xs"
    >
      <option value="">Select SIN</option>
      {sins.map((sin) => (
        <option key={sin.code} value={sin.code}>
          {sin.code} — {sin.title}
        </option>
      ))}
    </select>
  );
}

function MarketRows({ rows }: { rows: MarketRow[] }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-sm border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">SIN</th>
            <th className="px-3 py-2 text-left">Labor Category</th>
            <th className="px-3 py-2 text-left">Unit</th>
            <th className="px-3 py-2 text-left">GSA Net</th>
            <th className="px-3 py-2 text-left">Contractor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.slice(0, 8).map((row, index) => (
            <tr key={`${row.contractNumber}-${index}`}>
              <td className="px-3 py-2 font-mono">{row.sin}</td>
              <td className="px-3 py-2">{row.laborCategory}</td>
              <td className="px-3 py-2">{row.unitOfIssue}</td>
              <td className="px-3 py-2 font-mono">{row.netPrice}</td>
              <td className="px-3 py-2">{row.contractor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function statusLabel(status: AutomationAction["status"]) {
  if (status === "off") return "Off";
  if (status === "complete") return "Complete";
  if (status === "selected") return "Selected";
  return "Enabled";
}
