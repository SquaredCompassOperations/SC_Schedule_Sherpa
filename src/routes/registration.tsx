import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Panel, StatusPill } from "@/components/ui-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLIENT } from "@/lib/mock-data";
import { lookupSamEntity, type SamEntity } from "@/lib/sam-lookup.functions";

export const Route = createFileRoute("/registration")({
  head: () => ({ meta: [{ title: "SAM/GSA Registration Tracker — ScheduleBuilder" }] }),
  component: RegistrationPage,
});

type TaskStatus = "complete" | "in_progress" | "blocked" | "not_started";
type Task = {
  id: string;
  task: string;
  owner: string;
  due: string;
  status: TaskStatus;
  blocking: boolean; // blocks eOffer export?
};

const SEED_TASKS: Task[] = [
  { id: "t1", task: "Renew SAM.gov registration", owner: "Compliance", due: "2025-03-12", status: "in_progress", blocking: true },
  { id: "t2", task: "Link FAS ID for negotiator", owner: "Negotiator", due: "2024-12-30", status: "blocked", blocking: true },
  { id: "t3", task: "Issue eOffer digital certificate", owner: "IT", due: "2025-01-08", status: "blocked", blocking: true },
  { id: "t4", task: "Confirm CAGE address", owner: "Operations", due: "—", status: "complete", blocking: false },
  { id: "t5", task: "Upload incorporation docs", owner: "Legal", due: "—", status: "complete", blocking: false },
];

const STATUS_NEXT: Record<TaskStatus, TaskStatus> = {
  not_started: "in_progress",
  in_progress: "complete",
  complete: "complete",
  blocked: "in_progress",
};

function RegistrationPage() {
  const fn = useServerFn(lookupSamEntity);
  const [uei, setUei] = useState(CLIENT.uei);
  const [entity, setEntity] = useState<SamEntity | null>(null);
  const [tasks, setTasks] = useState<Task[]>(SEED_TASKS);
  const [draft, setDraft] = useState({ task: "", owner: "", due: "" });
  const [notes, setNotes] = useState(
    "The authorized negotiator must hold an active FAS ID and a digital certificate to access the eOffer portal. Export is blocked until both items are verified.",
  );

  const lookup = useMutation({
    mutationFn: async (val: string) => fn({ data: { uei: val } }),
    onSuccess: (res) => setEntity(res),
  });

  const items = useMemo(() => buildRegistrationItems(entity), [entity]);

  const cycleStatus = (id: string) =>
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status: STATUS_NEXT[t.status] } : t)));
  const setStatus = (id: string, status: TaskStatus) =>
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
  const remove = (id: string) => setTasks((ts) => ts.filter((t) => t.id !== id));
  const addTask = () => {
    if (!draft.task.trim()) return;
    setTasks((ts) => [
      ...ts,
      {
        id: `t${Date.now()}`,
        task: draft.task.trim(),
        owner: draft.owner.trim() || "Unassigned",
        due: draft.due.trim() || "—",
        status: "not_started",
        blocking: false,
      },
    ]);
    setDraft({ task: "", owner: "", due: "" });
  };

  const blockers = items.filter((i) => i.status === "gap" || i.status === "missing").length;
  const openBlockingTasks = tasks.filter((t) => t.blocking && t.status !== "complete").length;
  const exportReady = blockers === 0 && openBlockingTasks === 0;

  return (
    <>
      <PageHeader
        eyebrow="SAM • UEI • CAGE • FAS ID • eOffer"
        title="SAM / GSA Registration Tracker"
        description="Verify SAM.gov registration in real time and track every prerequisite before eOffer export."
        actions={
          <span
            className={`text-[10px] font-mono font-bold uppercase px-2 py-1 rounded-sm border ${
              exportReady
                ? "bg-success/10 text-success border-success/30"
                : "bg-destructive/10 text-destructive border-destructive/30"
            }`}
          >
            {exportReady ? "Export Ready" : `Export Blocked — ${blockers + openBlockingTasks} item(s)`}
          </span>
        }
      />

      <Panel title="SAM.gov Live Verification" className="mb-6">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">UEI (12 char)</label>
            <Input
              value={uei}
              onChange={(e) => setUei(e.target.value.toUpperCase())}
              className="font-mono mt-1"
              maxLength={12}
            />
          </div>
          <Button onClick={() => lookup.mutate(uei)} disabled={lookup.isPending || uei.length < 6}>
            {lookup.isPending ? "Verifying…" : "Verify with SAM.gov"}
          </Button>
        </div>

        {entity ? (
          <EntityCard entity={entity} />
        ) : (
          <p className="text-xs text-muted-foreground">
            Enter a UEI and click Verify to pull live registration status, CAGE, expiration, NAICS, PSCs, and exclusion
            status from SAM.gov.
          </p>
        )}
      </Panel>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7">
          <Panel title="Registration Status" className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Item</th>
                  <th className="px-4 py-2 text-left">Detail</th>
                  <th className="px-4 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((r) => (
                  <tr key={r.label}>
                    <td className="px-4 py-3 font-medium text-foreground">{r.label}</td>
                    <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">{r.note}</td>
                    <td className="px-4 py-3 text-right">
                      <StatusPill status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-6">
          <Panel title={`Open Tasks (${tasks.filter((t) => t.status !== "complete").length})`}>
            <ul className="space-y-2 mb-4">
              {tasks.map((t) => (
                <li key={t.id} className="border border-border rounded-sm p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="text-xs font-medium text-foreground flex items-center gap-2">
                        {t.task}
                        {t.blocking ? (
                          <span className="text-[9px] font-mono px-1 py-px rounded-sm border border-destructive/40 text-destructive">
                            BLOCKS EXPORT
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        Owner: {t.owner} • Due {t.due}
                      </div>
                    </div>
                    <button onClick={() => cycleStatus(t.id)} className="cursor-pointer" title="Click to advance status">
                      <StatusPill status={t.status} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Select value={t.status} onValueChange={(v) => setStatus(t.id, v as TaskStatus)}>
                      <SelectTrigger className="h-7 text-[11px] flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                        <SelectItem value="complete">Complete</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => remove(t.id)}>
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Add Task</div>
              <Input
                placeholder="Task description"
                value={draft.task}
                onChange={(e) => setDraft({ ...draft, task: e.target.value })}
                className="h-8 text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Owner"
                  value={draft.owner}
                  onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Due (YYYY-MM-DD)"
                  value={draft.due}
                  onChange={(e) => setDraft({ ...draft, due: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <Button size="sm" onClick={addTask} className="w-full h-8 text-xs">
                + Add Task
              </Button>
            </div>
          </Panel>

          <Panel title="Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs min-h-[120px]"
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

function EntityCard({ entity }: { entity: SamEntity }) {
  if (!entity.found) {
    return (
      <div className="border border-destructive/30 bg-destructive/5 rounded-sm p-3 text-xs text-destructive">
        {entity.note ?? "Entity not found in SAM.gov."}
      </div>
    );
  }
  const expSoon =
    entity.daysUntilExpiration !== null && entity.daysUntilExpiration !== undefined && entity.daysUntilExpiration < 90;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-sm font-bold text-foreground">{entity.legalName ?? "—"}</div>
          <div className="text-[10px] font-mono text-muted-foreground">
            UEI {entity.uei} • CAGE {entity.cage ?? "—"} • Source: {entity.source}
          </div>
        </div>
        <StatusPill status={entity.registrationStatus?.toLowerCase() === "active" ? "ok" : "gap"} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
        <Field label="Registration" value={entity.registrationStatus} />
        <Field
          label="Expires"
          value={entity.expirationDate}
          accent={expSoon ? "text-warning" : undefined}
          sub={
            entity.daysUntilExpiration !== null && entity.daysUntilExpiration !== undefined
              ? `${entity.daysUntilExpiration} days`
              : undefined
          }
        />
        <Field label="Last Update" value={entity.lastUpdate} />
        <Field label="Purpose" value={entity.purposeOfRegistration} />
        <Field label="Exclusions" value={entity.exclusionStatus} />
        <Field label="Address" value={entity.physicalAddress} className="col-span-2 sm:col-span-3" />
      </div>
      {entity.naics?.length ? (
        <div>
          <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">NAICS</div>
          <div className="flex flex-wrap gap-1">
            {entity.naics.map((n) => (
              <span key={n} className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm border border-border bg-muted/40">
                {n}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {entity.note ? (
        <div className="text-[10px] text-muted-foreground italic border-t border-border pt-2">{entity.note}</div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  sub,
  accent,
  className = "",
}: {
  label: string;
  value?: string | null;
  sub?: string;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono ${accent ?? "text-foreground"}`}>{value ?? "—"}</div>
      {sub ? <div className="text-[10px] font-mono text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function buildRegistrationItems(entity: SamEntity | null) {
  const samStatus = entity?.found && entity.registrationStatus?.toLowerCase() === "active" ? "ok" : entity ? "gap" : "pending";
  const samNote =
    entity?.expirationDate
      ? `Expires ${entity.expirationDate}${entity.daysUntilExpiration !== null && entity.daysUntilExpiration !== undefined ? ` (${entity.daysUntilExpiration}d)` : ""}`
      : entity?.note ?? "Run SAM.gov lookup above";
  return [
    { label: "SAM.gov Active Registration", status: samStatus, note: samNote },
    { label: "UEI Issued", status: entity?.uei ? "ok" : "pending", note: entity?.uei ?? CLIENT.uei },
    { label: "CAGE Code", status: entity?.cage ? "ok" : "gap", note: entity?.cage ?? "Not yet linked" },
    { label: "Exclusions Check", status: entity?.exclusionStatus?.startsWith("No") ? "ok" : entity ? "gap" : "pending", note: entity?.exclusionStatus ?? "Pending lookup" },
    { label: "FAS ID Linked", status: "gap", note: "Required for eOffer portal" },
    { label: "eOffer Digital Cert", status: "gap", note: "Authorized negotiator missing" },
    { label: "Pathways to Success", status: "ok", note: "Completed 2024-11-02" },
    { label: "Readiness Assessment", status: "ok", note: `Score ${CLIENT.readiness}` },
  ];
}
