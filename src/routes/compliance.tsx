import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { PageHeader, Panel, StatusPill } from "@/components/ui-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COMPLIANCE_MATRIX, DOCUMENT_QUEUE, CLIENT } from "@/lib/mock-data";
import { useDocStore, COMPLIANCE_DOC_LINKS, type DocStatus } from "@/lib/doc-store";

type ComplianceStatus = "valid" | "review" | "missing" | "na";
type Category = "Administrative" | "Technical" | "Pricing" | "Compliance" | "Past Performance";

type Row = {
  id: string;
  ref: string;
  req: string;
  source: string;
  status: ComplianceStatus;
  category: Category;
  docLink: string | null; // doc name from DOCUMENT_QUEUE
  override: boolean;       // if true, status is manual; otherwise derived from docLink
};

export const Route = createFileRoute("/compliance")({
  head: () => ({ meta: [{ title: "Compliance Matrix — ScheduleBuilder" }] }),
  component: CompliancePage,
});

const SEED_CATEGORY: Record<string, Category> = {
  "SCP-FSS-001": "Technical",
  "I-FSS-600": "Pricing",
  "CP-114-A": "Administrative",
  "FAR 52.222-46": "Compliance",
  "FAR 52.237-10": "Compliance",
  "GSAR 552.216-70": "Pricing",
  "FAR 31.201-2": "Compliance",
  "I-FSS-639": "Pricing",
  "SCP-FSS-004": "Administrative",
  "I-FSS-969": "Pricing",
};

function statusFromDoc(s: DocStatus): ComplianceStatus {
  if (s === "final") return "valid";
  if (s === "review") return "review";
  return "missing";
}

const STATUS_ORDER: ComplianceStatus[] = ["missing", "review", "valid", "na"];

function CompliancePage() {
  const docs = useDocStore();

  const [rows, setRows] = useState<Row[]>(() =>
    COMPLIANCE_MATRIX.map((r, i) => ({
      id: `r${i}`,
      ref: r.ref,
      req: r.req,
      source: r.source,
      status: r.status as ComplianceStatus,
      category: SEED_CATEGORY[r.ref] ?? "Compliance",
      docLink: COMPLIANCE_DOC_LINKS[r.ref]
        ? (DOCUMENT_QUEUE.find((d) => d.kind === COMPLIANCE_DOC_LINKS[r.ref])?.name ?? null)
        : null,
      override: false,
    })),
  );
  const [filter, setFilter] = useState<"all" | ComplianceStatus>("all");
  const [catFilter, setCatFilter] = useState<"all" | Category>("all");
  const [draft, setDraft] = useState({ ref: "", req: "", category: "Compliance" as Category });

  // Derived rows: when not overridden and linked to a doc, sync status from doc-store.
  const derived = useMemo(
    () =>
      rows.map((r) => {
        if (!r.override && r.docLink && docs[r.docLink]) {
          const linkedStatus = statusFromDoc(docs[r.docLink].status);
          return { ...r, status: linkedStatus, source: r.docLink };
        }
        return r;
      }),
    [rows, docs],
  );

  const visible = derived.filter(
    (r) => (filter === "all" || r.status === filter) && (catFilter === "all" || r.category === catFilter),
  );

  const counts = useMemo(() => {
    const c = { valid: 0, review: 0, missing: 0, na: 0 };
    derived.forEach((r) => c[r.status]++);
    return c;
  }, [derived]);

  const totalActive = counts.valid + counts.review + counts.missing;
  const coverage = totalActive === 0 ? 0 : Math.round((counts.valid / totalActive) * 100);
  const exportReady = counts.missing === 0 && counts.review === 0;

  const setStatus = (id: string, status: ComplianceStatus) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status, override: true } : r)));
  const cycle = (id: string) => {
    const row = derived.find((r) => r.id === id);
    if (!row) return;
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(row.status) + 1) % STATUS_ORDER.length];
    setStatus(id, next);
  };
  const setLink = (id: string, docName: string) =>
    setRows((rs) =>
      rs.map((r) => (r.id === id ? { ...r, docLink: docName === "__none" ? null : docName, override: false } : r)),
    );
  const clearOverride = (id: string) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, override: false } : r)));
  const remove = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));
  const addRow = () => {
    if (!draft.ref.trim() || !draft.req.trim()) return;
    setRows((rs) => [
      ...rs,
      {
        id: `r${Date.now()}`,
        ref: draft.ref.trim(),
        req: draft.req.trim(),
        source: "—",
        status: "missing",
        category: draft.category,
        docLink: null,
        override: true,
      },
    ]);
    setDraft({ ref: "", req: "", category: "Compliance" });
  };

  const exportXlsx = () => {
    const data = [
      ["Compliance Matrix"],
      ["Offeror", CLIENT.name, "Solicitation", CLIENT.solicitation, "Refresh", CLIENT.refresh],
      [],
      ["Ref", "Category", "Requirement", "Source Document", "Status", "Linked Doc"],
      ...derived.map((r) => [r.ref, r.category, r.req, r.source, r.status, r.docLink ?? "—"]),
      [],
      ["Coverage", `${coverage}%`, "Valid", counts.valid, "Review", counts.review, "Missing", counts.missing, "N/A", counts.na],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "Compliance Matrix");
    XLSX.writeFile(wb, `${CLIENT.name.replace(/\s+/g, "_")}_Compliance_Matrix.xlsx`);
  };

  return (
    <>
      <PageHeader
        eyebrow="MAS Solicitation Refresh 18"
        title="Compliance Matrix"
        description="Solicitation requirements mapped to source documents. Auto-syncs with the Document Generator — missing or in-review items block eOffer export."
        actions={
          <div className="flex items-center gap-3">
            <span
              className={`text-[10px] font-mono font-bold uppercase px-2 py-1 rounded-sm border ${
                exportReady
                  ? "bg-success/10 text-success border-success/30"
                  : "bg-destructive/10 text-destructive border-destructive/30"
              }`}
            >
              {exportReady ? "Export Ready" : `Blocked — ${counts.missing + counts.review}`}
            </span>
            <Button size="sm" onClick={exportXlsx}>Export .xlsx</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Coverage" value={`${coverage}%`} tone="primary" />
        <Stat label="Verified" value={counts.valid} tone="success" />
        <Stat label="In Review" value={counts.review} tone="warning" />
        <Stat label="Missing" value={counts.missing} tone="destructive" />
        <Stat label="N/A" value={counts.na} tone="muted" />
      </div>

      <Panel className="p-0">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">Filter:</span>
          {(["all", "missing", "review", "valid", "na"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-sm border ${
                filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
          <span className="mx-2 text-muted-foreground">•</span>
          <Select value={catFilter} onValueChange={(v) => setCatFilter(v as Category | "all")}>
            <SelectTrigger className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Administrative">Administrative</SelectItem>
              <SelectItem value="Technical">Technical</SelectItem>
              <SelectItem value="Pricing">Pricing</SelectItem>
              <SelectItem value="Compliance">Compliance</SelectItem>
              <SelectItem value="Past Performance">Past Performance</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground">
            Showing {visible.length} of {derived.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Ref</th>
                <th className="px-3 py-2 text-left">Cat</th>
                <th className="px-3 py-2 text-left">Requirement</th>
                <th className="px-3 py-2 text-left">Linked Doc</th>
                <th className="px-3 py-2 text-right">Status</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((r) => {
                const docState = r.docLink ? docs[r.docLink] : null;
                return (
                  <tr key={r.id}>
                    <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground align-top">{r.ref}</td>
                    <td className="px-3 py-3 align-top">
                      <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm border border-border bg-muted/40">
                        {r.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-foreground align-top">{r.req}</td>
                    <td className="px-3 py-3 align-top">
                      <Select value={r.docLink ?? "__none"} onValueChange={(v) => setLink(r.id, v)}>
                        <SelectTrigger className="h-7 text-[11px] w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">— None / External —</SelectItem>
                          {DOCUMENT_QUEUE.map((d) => (
                            <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {docState ? (
                        <div className="text-[10px] font-mono text-muted-foreground mt-1">
                          Doc status: <span className="text-foreground">{docState.status}</span>
                          {r.override ? <span className="text-warning ml-2">[manual override]</span> : <span className="ml-2">[auto-synced]</span>}
                        </div>
                      ) : (
                        <div className="text-[10px] font-mono text-muted-foreground mt-1">{r.source}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right align-top">
                      <button onClick={() => cycle(r.id)} title="Click to cycle">
                        <StatusPill status={r.status} />
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right align-top space-y-1">
                      {r.status === "missing" && r.docLink ? (
                        <Link
                          to="/documents"
                          className="block text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
                        >
                          Generate →
                        </Link>
                      ) : null}
                      <div className="flex flex-col gap-1 items-end">
                        <Select value={r.status} onValueChange={(v) => setStatus(r.id, v as ComplianceStatus)}>
                          <SelectTrigger className="h-6 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="missing">missing</SelectItem>
                            <SelectItem value="review">review</SelectItem>
                            <SelectItem value="valid">valid</SelectItem>
                            <SelectItem value="na">n/a</SelectItem>
                          </SelectContent>
                        </Select>
                        {r.override && r.docLink ? (
                          <button onClick={() => clearOverride(r.id)} className="text-[9px] text-muted-foreground hover:text-primary underline">
                            re-sync
                          </button>
                        ) : null}
                        <button onClick={() => remove(r.id)} className="text-[9px] text-destructive/70 hover:text-destructive">
                          remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border px-4 py-3 bg-muted/20 grid grid-cols-1 sm:grid-cols-4 gap-2">
          <Input
            placeholder="Ref (e.g. FAR 52.219-1)"
            value={draft.ref}
            onChange={(e) => setDraft({ ...draft, ref: e.target.value })}
            className="h-8 text-xs font-mono"
          />
          <Input
            placeholder="Requirement"
            value={draft.req}
            onChange={(e) => setDraft({ ...draft, req: e.target.value })}
            className="h-8 text-xs sm:col-span-2"
          />
          <div className="flex gap-2">
            <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as Category })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Administrative">Administrative</SelectItem>
                <SelectItem value="Technical">Technical</SelectItem>
                <SelectItem value="Pricing">Pricing</SelectItem>
                <SelectItem value="Compliance">Compliance</SelectItem>
                <SelectItem value="Past Performance">Past Performance</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={addRow} className="h-8 text-xs whitespace-nowrap">+ Add</Button>
          </div>
        </div>
      </Panel>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: "success" | "warning" | "destructive" | "primary" | "muted" }) {
  const map: Record<string, string> = {
    success: "text-success border-success/30 bg-success/5",
    warning: "text-warning border-warning/30 bg-warning/5",
    destructive: "text-destructive border-destructive/30 bg-destructive/5",
    primary: "text-primary border-primary/30 bg-primary/5",
    muted: "text-muted-foreground border-border bg-muted/30",
  };
  return (
    <div className={`border rounded-sm p-4 ${map[tone]}`}>
      <div className="text-[10px] font-mono uppercase tracking-widest">{label}</div>
      <div className="text-3xl font-mono font-extrabold mt-1">{value}</div>
    </div>
  );
}
