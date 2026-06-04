import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { generatePricingWorkbook } from "@/lib/pricing-workbook.functions";
import { checkGsaTemplateVersion } from "@/lib/gsa-template-version.functions";
import { useAutomation, setPricingTemplate, savePricingRows } from "@/lib/automation-store";
import { useIntake } from "@/lib/intake-store";

export const Route = createFileRoute("/pricing-workbook")({
  head: () => ({ meta: [{ title: "Pricing Workbook — ScheduleBuilder" }] }),
  component: PricingWorkbookPage,
});

type Row = {
  sin: string;
  title: string;
  description: string;
  minimumEducation: string;
  minimumYearsExperience: string;
  unitOfMeasure: string;
  price: string;
};

function emptyRow(sin = ""): Row {
  return {
    sin,
    title: "",
    description: "",
    minimumEducation: "Bachelors",
    minimumYearsExperience: "5",
    unitOfMeasure: "Hour",
    price: "",
  };
}

function PricingWorkbookPage() {
  const genFn = useServerFn(generatePricingWorkbook);
  const versionFn = useServerFn(checkGsaTemplateVersion);
  const automation = useAutomation();
  const intake = useIntake();

  const [template, setTemplateLocal] = useState<"fcp-product" | "fcp-services-plus">(
    automation.pricingTemplate || "fcp-services-plus",
  );
  const [rows, setRows] = useState<Row[]>(() => {
    // hydrate from previously saved rows first
    if (automation.pricingRows && automation.pricingRows.length > 0) {
      return automation.pricingRows.map((r) => ({ ...r }));
    }
    // otherwise seed from selected LCATs + first SIN
    const firstSin = automation.selectedSins[0]?.code || "";
    if (automation.selectedLcats.length > 0) {
      return automation.selectedLcats.map((l) => ({
        ...emptyRow(firstSin),
        title: l.title,
        description: l.rationale,
      }));
    }
    return [emptyRow(firstSin)];
  });
  const [savedAt, setSavedAt] = useState<number | null>(automation.pricingSavedAt);
  const [dirty, setDirty] = useState(false);
  const [version, setVersion] = useState<{ message: string; upToDate: boolean } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    versionFn().then((v) => setVersion(v)).catch(() => {});
  }, [versionFn]);

  const switchTemplate = (t: "fcp-product" | "fcp-services-plus") => {
    setTemplateLocal(t);
    setPricingTemplate(t);
  };

  const update = (i: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows((rs) => [...rs, emptyRow(automation.selectedSins[0]?.code || "")]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const generate = async () => {
    if (rows.length === 0 || rows.some((r) => !r.sin || !r.title || !r.price)) {
      setError("Every row needs at least SIN, Title, and Price.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const res = await genFn({
        data: {
          template,
          sins: Array.from(new Set(rows.map((r) => r.sin))),
          rows,
          companyName: intake.corporate.legalName || "offer",
        },
      });
      if (res.error) {
        setError(res.error);
      } else {
        // download
        const bin = atob(res.base64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Automation Engine • Module 5"
        title="Pricing Workbook"
        description="Pre-fills GSA Pricing Terms and FCP templates using your selected SINs, LCATs, and commercial pricing. Generated files preserve GSA template structure for upload to eOffer."
        actions={
          <div className="text-right">
            <div className="text-[10px] font-mono text-muted-foreground uppercase">Rows</div>
            <div className="text-2xl font-mono font-bold text-primary leading-none">{rows.length}</div>
          </div>
        }
      />

      {version && (
        <div
          className={`mb-4 text-xs px-3 py-2 rounded-sm border ${
            version.upToDate
              ? "border-success/30 bg-success/5 text-success"
              : "border-warning/40 bg-warning/5 text-warning"
          }`}
        >
          {version.message}
        </div>
      )}

      <Panel title="Template" className="mb-4">
        <div className="flex flex-wrap gap-2">
          {([
            { v: "fcp-services-plus", label: "FCP Services Plus", hint: "Labor categories, professional services" },
            { v: "fcp-product", label: "FCP Product File", hint: "Manufactured goods, parts, supplies" },
          ] as const).map((t) => (
            <button
              key={t.v}
              onClick={() => switchTemplate(t.v)}
              className={`flex-1 min-w-[200px] text-left px-3 py-2 rounded-sm border transition-colors ${
                template === t.v ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
              }`}
            >
              <div className="text-xs font-bold uppercase tracking-widest">{t.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{t.hint}</div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Line items" className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left py-2 px-1">SIN</th>
                <th className="text-left py-2 px-1">Title / LCAT</th>
                <th className="text-left py-2 px-1">Min Edu</th>
                <th className="text-left py-2 px-1">Min Yrs</th>
                <th className="text-left py-2 px-1">UoM</th>
                <th className="text-left py-2 px-1">Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1 px-1">
                    <input value={r.sin} onChange={(e) => update(i, { sin: e.target.value })} className="w-24 px-2 py-1 text-xs font-mono border border-border bg-background rounded-sm" placeholder="54151S" />
                  </td>
                  <td className="py-1 px-1">
                    <input value={r.title} onChange={(e) => update(i, { title: e.target.value })} className="w-full px-2 py-1 text-xs border border-border bg-background rounded-sm" placeholder="Senior Systems Architect" />
                  </td>
                  <td className="py-1 px-1">
                    <input value={r.minimumEducation} onChange={(e) => update(i, { minimumEducation: e.target.value })} className="w-28 px-2 py-1 text-xs border border-border bg-background rounded-sm" />
                  </td>
                  <td className="py-1 px-1">
                    <input value={r.minimumYearsExperience} onChange={(e) => update(i, { minimumYearsExperience: e.target.value })} className="w-12 px-2 py-1 text-xs border border-border bg-background rounded-sm" />
                  </td>
                  <td className="py-1 px-1">
                    <input value={r.unitOfMeasure} onChange={(e) => update(i, { unitOfMeasure: e.target.value })} className="w-16 px-2 py-1 text-xs border border-border bg-background rounded-sm" />
                  </td>
                  <td className="py-1 px-1">
                    <input value={r.price} onChange={(e) => update(i, { price: e.target.value })} className="w-24 px-2 py-1 text-xs font-mono border border-border bg-background rounded-sm" placeholder="185.50" />
                  </td>
                  <td className="py-1 px-1">
                    <button onClick={() => removeRow(i)} className="text-[10px] text-destructive hover:underline">remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={addRow} className="mt-2 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm hover:bg-muted">
          + Add row
        </button>
      </Panel>

      <div className="flex justify-end gap-2 items-center">
        {error && <span className="text-xs text-destructive mr-auto">{error}</span>}
        <button
          onClick={generate}
          disabled={running}
          className="text-xs font-bold uppercase tracking-widest px-5 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
        >
          {running ? "Generating…" : "Generate & Download .xlsx"}
        </button>
      </div>
    </>
  );
}
