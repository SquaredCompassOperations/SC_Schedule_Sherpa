import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Panel, StatusPill } from "@/components/ui-primitives";
import { COMPLIANCE_MATRIX, EXPORT_BUNDLE } from "@/lib/mock-data";

export const Route = createFileRoute("/export")({
  head: () => ({ meta: [{ title: "Export eOffer Package — ScheduleBuilder" }] }),
  component: ExportPage,
});

function ExportPage() {
  const missing = COMPLIANCE_MATRIX.filter((r) => r.status === "missing");
  const ready = missing.length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Final Step • Human Submission Required"
        title="eOffer Package Exporter"
        description="Builds the final folder structure, document package, pricing files, and signed forms tracker. Submission is performed manually by the Authorized Negotiator."
        actions={
          <button
            disabled={!ready}
            className="text-xs font-bold uppercase tracking-widest px-5 py-3 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ready ? "Generate eOffer Zip" : `Resolve ${missing.length} Blocker${missing.length === 1 ? "" : "s"}`}
          </button>
        }
      />

      {!ready ? (
        <div className="mb-6 border border-destructive/30 bg-destructive/5 rounded-sm p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-destructive mb-2">
            Export Blocked — Missing Items
          </div>
          <ul className="text-xs space-y-1">
            {missing.map((m) => (
              <li key={m.ref} className="flex justify-between font-mono">
                <span className="text-foreground">{m.ref} · {m.req}</span>
                <Link to="/compliance" className="text-primary hover:underline">Resolve →</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <Panel title="Package Folder Structure" className="p-0">
            <div className="divide-y divide-border">
              {EXPORT_BUNDLE.map((b) => (
                <div key={b.folder} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-foreground">/{b.folder}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{b.files.length} files</span>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {b.files.map((f) => (
                      <li key={f} className="text-[11px] font-mono text-muted-foreground flex items-center gap-2 border border-border rounded-sm px-2 py-1 bg-surface">
                        <span className="size-1.5 bg-success rounded-full shrink-0" />
                        <span className="truncate">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="eOffer Field-Ready Text">
            <div className="space-y-2 text-[11px] font-mono">
              <Row k="Offeror Name" v="Advantix Systems LLC" />
              <Row k="UEI" v="Z9L8H2M7K4P1" />
              <Row k="CAGE Code" v="8K2P7" />
              <Row k="Solicitation" v="47QSMD20R0001" />
              <Row k="Schedule" v="MAS Consolidated · IT Large Category" />
              <Row k="Proposed SINs" v="54151S" />
              <Row k="Authorized Negotiator" v="Jordan Daniels (VP Contracts)" />
            </div>
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Panel title="Signed Forms Tracker">
            <ul className="space-y-2 text-xs">
              {[
                ["SF1449 Cover", "approved"],
                ["Agent Authorization Letter", "pending"],
                ["Reps & Certs (SAM)", "approved"],
                ["Subcontracting Plan", "na"],
              ].map(([name, status]) => (
                <li key={name} className="flex justify-between items-center border border-border rounded-sm px-2 py-1.5">
                  <span>{name}</span>
                  <StatusPill status={status} />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Final Submission Checklist">
            <ol className="text-xs space-y-2 list-decimal list-inside text-foreground">
              <li>Download .zip package</li>
              <li>Verify FAS ID & digital cert</li>
              <li>Log in to eOffer portal</li>
              <li>Upload package by section</li>
              <li>Authorized Negotiator certifies</li>
              <li>Submit and capture confirmation</li>
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border/50 py-1.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-bold text-foreground">{v}</span>
    </div>
  );
}
