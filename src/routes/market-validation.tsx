import { createFileRoute, Link } from "@tanstack/react-router";
import { SaveAndContinue } from "@/components/save-and-continue";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { runMarketValidation } from "@/lib/market-validation.functions";
import { useAutomation, setMarketRows, type MarketRow } from "@/lib/automation-store";
import { useSelectedOfferId, useSelectedOfferType } from "@/lib/offer-workspace";
import { useDocStore, patchDoc } from "@/lib/doc-store";
import { useIntake } from "@/lib/intake-store";
import {
  buildAutomationActions,
  getAgentAuthorizationDraftText,
  sendClientUpdateRequest,
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
  const automation = useAutomation();
  const docs = useDocStore();
  const intake = useIntake();
  const selectedOfferId = useSelectedOfferId();
  const offerType = useSelectedOfferType();
  const [selectedAction, setSelectedAction] = useState<AutomationActionId>("agent-authorization");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [activeSin, setActiveSin] = useState<string>(automation.selectedSins[0]?.code || "");
  const [clientUpdateSubject, setClientUpdateSubject] = useState("");
  const [clientUpdateBody, setClientUpdateBody] = useState("");

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
      }),
    [automation.marketRows.length, automation.pricingRows.length, docs, offerType],
  );
  const selected = actions.find((action) => action.id === selectedAction) ?? actions[0];
  const enabledActions = actions.filter((action) => action.status !== "off").length;
  const spend = actions
    .filter((action) => action.status === "complete")
    .reduce((sum, action) => sum + Number(action.estimatedCost.replace(/[^0-9.]/g, "")), 0);

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
                  onRun={
                    action.id === "market-validation"
                      ? runMarketScan
                      : action.id === "agent-authorization"
                        ? buildAgentAuthorization
                        : undefined
                  }
                  running={running && action.id === "market-validation"}
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
                    <input type="checkbox" checked={action.status !== "off"} readOnly />
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

      <Panel
        title={selected.title}
        className="mt-6"
        trailing={
          selected.id === "pricing-workbook" ? (
            <Link
              to="/pricing-workbook"
              className="text-[10px] font-bold uppercase tracking-widest text-primary"
            >
              Open Workspace →
            </Link>
          ) : selected.id === "market-validation" ? (
            <MarketSinPicker
              activeSin={activeSin}
              onActiveSin={setActiveSin}
              sins={automation.selectedSins}
            />
          ) : null
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Status" value={statusLabel(selected.status)} />
          <Field label="Estimated cost" value={selected.estimatedCost} />
          <Field label="Source" value={selected.source} />
        </div>
        {selected.id === "client-update" ? (
          <div className="mt-5 space-y-3">
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
              disabled={!clientUpdateSubject.trim() || !clientUpdateBody.trim()}
              className="rounded-sm bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
            >
              Send Client Update
            </button>
          </div>
        ) : selected.id === "market-validation" && automation.marketRows.length > 0 ? (
          <MarketRows rows={automation.marketRows} />
        ) : (
          <div className="mt-4 text-sm text-muted-foreground">{selected.description}</div>
        )}
      </Panel>

      <div className="mt-8 flex justify-end border-t border-border pt-4">
        <SaveAndContinue moduleSlug="/market-validation" nextHref="/documents" />
      </div>
    </>
  );
}

function AutomationActionCard({
  action,
  selected,
  running,
  onSelect,
  onRun,
}: {
  action: AutomationAction;
  selected: boolean;
  running: boolean;
  onSelect: () => void;
  onRun?: () => void;
}) {
  return (
    <div
      className={`min-h-32 rounded-sm border p-4 ${
        selected ? "border-primary bg-primary/5" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onSelect} className="text-left">
          <h2 className="text-sm font-extrabold text-foreground">{action.title}</h2>
        </button>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onSelect}
            className="rounded-sm border border-border px-2 py-1 text-[9px] font-bold uppercase tracking-widest"
          >
            {selected ? "Selected" : "Open"}
          </button>
          {onRun ? (
            <button
              type="button"
              onClick={onRun}
              disabled={action.status === "off" || running}
              className="rounded-sm bg-primary px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
            >
              {running ? "Run..." : "Run"}
            </button>
          ) : null}
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
    </div>
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
