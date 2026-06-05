import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { StatusPill } from "@/components/ui-primitives";
import { CLIENT, DOCUMENT_QUEUE } from "@/lib/mock-data";
import { useStatus } from "@/lib/status-data";
import {
  useRequirements,
  updateRequirement,
  addRequirement,
  removeRequirement,
  type ReqStatus,
  type ReqCat,
  type Requirement,
} from "@/lib/requirements-store";
import { useDocStore } from "@/lib/doc-store";

export const Route = createFileRoute("/status/")({
  component: StatusOverview,
});

const STATUS_FILTERS: { id: "all" | ReqStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "missing", label: "Missing" },
  { id: "review", label: "Review" },
  { id: "valid", label: "Valid" },
  { id: "na", label: "NA" },
];

const CATEGORIES: { id: "all" | ReqCat; label: string }[] = [
  { id: "all", label: "All Categories" },
  { id: "technical", label: "Technical" },
  { id: "pricing", label: "Pricing" },
  { id: "administrative", label: "Administrative" },
  { id: "compliance", label: "Compliance" },
];

const STAT_TONE: Record<string, string> = {
  coverage: "bg-primary/5 border-primary/30 text-primary",
  valid: "bg-success/5 border-success/30 text-success",
  review: "bg-warning/5 border-warning/30 text-warning",
  missing: "bg-destructive/5 border-destructive/30 text-destructive",
  na: "bg-muted border-border text-muted-foreground",
};

function StatCard({
  tone,
  label,
  value,
}: {
  tone: keyof typeof STAT_TONE;
  label: string;
  value: string | number;
}) {
  return (
    <div className={`rounded-sm border p-4 ${STAT_TONE[tone]}`}>
      <div className="text-[10px] font-mono uppercase tracking-widest opacity-80">{label}</div>
      <div className="text-3xl font-mono font-bold leading-none mt-2">{value}</div>
    </div>
  );
}

function StatusOverview() {
  const { rows } = useRequirements();
  const docs = useDocStore();
  const status = useStatus();

  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["id"]>("all");
  const [catFilter, setCatFilter] = useState<(typeof CATEGORIES)[number]["id"]>("all");

  // Auto-derive status from linked doc when present
  const enriched: (Requirement & { effectiveStatus: ReqStatus; docStatus: string | null })[] =
    useMemo(
      () =>
        rows.map((r) => {
          if (r.linkedDoc && docs[r.linkedDoc]) {
            const ds = docs[r.linkedDoc].status;
            const effective: ReqStatus =
              ds === "final" ? "valid" : ds === "review" ? "review" : "missing";
            return { ...r, effectiveStatus: effective, docStatus: ds };
          }
          return { ...r, effectiveStatus: r.status, docStatus: null };
        }),
      [rows, docs],
    );

  const counts = useMemo(() => {
    const c = { valid: 0, review: 0, missing: 0, na: 0 };
    enriched.forEach((r) => (c[r.effectiveStatus] += 1));
    return c;
  }, [enriched]);

  const totalCounted = enriched.length - counts.na;
  const coverage = totalCounted === 0 ? 0 : Math.round((counts.valid / totalCounted) * 100);

  const filtered = enriched.filter(
    (r) =>
      (statusFilter === "all" || r.effectiveStatus === statusFilter) &&
      (catFilter === "all" || r.cat === catFilter),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {status.entityName || "—"} · Stage: {status.currentStage.label}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Requirements Matrix</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Every artifact required to submit. Link documents to auto-sync status.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard tone="coverage" label="Coverage" value={`${coverage}%`} />
        <StatCard tone="valid" label="Verified" value={counts.valid} />
        <StatCard tone="review" label="In Review" value={counts.review} />
        <StatCard tone="missing" label="Missing" value={counts.missing} />
        <StatCard tone="na" label="N/A" value={counts.na} />
      </div>

      {/* Matrix */}
      <div className="border border-border rounded-sm bg-card">
        {/* Filter bar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Filter:</span>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`text-[10px] font-mono font-bold uppercase px-2 py-1 rounded-sm border ${
                  statusFilter === f.id
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value as typeof catFilter)}
              className="text-xs bg-background border border-border rounded-sm px-2 py-1"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            Showing {filtered.length} of {enriched.length}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] font-mono uppercase text-muted-foreground border-b border-border">
                <th className="px-4 py-2">Ref</th>
                <th className="px-2 py-2">Cat</th>
                <th className="px-2 py-2">Requirement</th>
                <th className="px-2 py-2">Linked Doc</th>
                <th className="px-2 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.ref} className="border-b border-border/50 align-top">
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {r.ref}
                  </td>
                  <td className="px-2 py-3">
                    <span className="text-[9px] font-mono font-bold uppercase border border-border rounded-sm px-1.5 py-0.5 text-muted-foreground">
                      {r.cat}
                    </span>
                  </td>
                  <td className="px-2 py-3">{r.req}</td>
                  <td className="px-2 py-3 min-w-[200px]">
                    <select
                      value={r.linkedDoc ?? ""}
                      onChange={(e) =>
                        updateRequirement(r.ref, { linkedDoc: e.target.value || null })
                      }
                      className="text-xs bg-background border border-border rounded-sm px-2 py-1 w-full"
                    >
                      <option value="">— None / External —</option>
                      {DOCUMENT_QUEUE.map((d) => (
                        <option key={d.name} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    {r.linkedDoc && r.docStatus ? (
                      <div className="text-[10px] font-mono text-muted-foreground mt-1">
                        Doc status: <span className="text-foreground">{r.docStatus}</span>{" "}
                        <span className="opacity-60">[auto-synced]</span>
                      </div>
                    ) : r.externalRef ? (
                      <div className="text-[10px] font-mono text-muted-foreground mt-1">
                        {r.externalRef}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-3 text-center">
                    <StatusPill status={r.effectiveStatus} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.effectiveStatus === "missing" ? (
                      <Link
                        to="/documents"
                        className="text-[10px] font-mono font-bold uppercase text-primary hover:underline"
                      >
                        Generate →
                      </Link>
                    ) : null}
                    <select
                      value={r.status}
                      onChange={(e) =>
                        updateRequirement(r.ref, { status: e.target.value as ReqStatus })
                      }
                      disabled={!!r.linkedDoc}
                      className="ml-2 text-xs bg-background border border-border rounded-sm px-2 py-1 disabled:opacity-50"
                    >
                      <option value="missing">missing</option>
                      <option value="review">review</option>
                      <option value="valid">valid</option>
                      <option value="na">na</option>
                    </select>
                    {r.custom ? (
                      <button
                        onClick={() => removeRequirement(r.ref)}
                        className="ml-2 text-[10px] font-mono text-destructive hover:underline"
                      >
                        remove
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No requirements match the current filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Add row */}
        <AddRequirementForm />
      </div>
    </div>
  );
}

function AddRequirementForm() {
  const [ref, setRef] = useState("");
  const [req, setReq] = useState("");
  const [cat, setCat] = useState<ReqCat>("compliance");

  const submit = () => {
    if (!ref.trim() || !req.trim()) return;
    addRequirement({
      ref: ref.trim(),
      req: req.trim(),
      cat,
      linkedDoc: null,
      status: "missing",
    });
    setRef("");
    setReq("");
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-surface/40 flex-wrap">
      <input
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        placeholder="Ref (e.g. FAR 52.219-1)"
        className="text-xs bg-background border border-border rounded-sm px-2 py-1 w-48 font-mono"
      />
      <input
        value={req}
        onChange={(e) => setReq(e.target.value)}
        placeholder="Requirement"
        className="text-xs bg-background border border-border rounded-sm px-2 py-1 flex-1 min-w-[200px]"
      />
      <select
        value={cat}
        onChange={(e) => setCat(e.target.value as ReqCat)}
        className="text-xs bg-background border border-border rounded-sm px-2 py-1"
      >
        <option value="technical">Technical</option>
        <option value="pricing">Pricing</option>
        <option value="administrative">Administrative</option>
        <option value="compliance">Compliance</option>
      </select>
      <button
        onClick={submit}
        className="text-[10px] font-mono font-bold uppercase bg-primary text-primary-foreground px-3 py-1.5 rounded-sm hover:opacity-90"
      >
        + Add
      </button>
    </div>
  );
}
