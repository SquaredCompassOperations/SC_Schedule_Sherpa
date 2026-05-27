import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LABOR_CATEGORIES, CLIENT } from "@/lib/mock-data";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: "Pricing Workbook — ScheduleBuilder" }] }),
  component: PricingPage,
});

const IFF = 0.0075; // GSA Industrial Funding Fee

type Labor = {
  code: string;
  title: string;
  education: string;
  years: number;
  commercial: number;
  gsa: number; // proposed pre-IFF price the gov pays
};

type Customer = {
  id: string;
  name: string;
  discount: number; // % off commercial list
  terms: string;
  volume: string;
  isMFC: boolean;
};

function PricingPage() {
  const [rows, setRows] = useState<Labor[]>(LABOR_CATEGORIES);
  const [customers, setCustomers] = useState<Customer[]>([
    { id: "c1", name: "Commercial List Price", discount: 0, terms: "Net 30", volume: "—", isMFC: false },
    { id: "c2", name: "Fortune 500 Enterprise", discount: 8, terms: "Net 30", volume: ">$500K", isMFC: false },
    { id: "c3", name: "State & Local Gov", discount: 12, terms: "Net 30 / 1%10", volume: ">$250K", isMFC: true },
    { id: "c4", name: "Mid-Market", discount: 5, terms: "Net 45", volume: "<$100K", isMFC: false },
  ]);
  const [epaRate, setEpaRate] = useState(3.0);
  const [epaIndex, setEpaIndex] = useState("BLS ECI - Professional & Business Services");
  const [proposedGovDiscount, setProposedGovDiscount] = useState(15);

  const mfc = customers.find((c) => c.isMFC) ?? customers[0];
  const avgDiscount = rows.reduce((acc, r) => acc + (1 - r.gsa / r.commercial), 0) / rows.length;
  const differential = proposedGovDiscount - mfc.discount;

  const updateRow = (i: number, key: keyof Labor, v: string | number) => {
    setRows((rs) =>
      rs.map((r, idx) => (idx === i ? { ...r, [key]: typeof v === "string" && key !== "title" && key !== "education" && key !== "code" ? parseFloat(v) || 0 : v } : r)),
    );
  };
  const addRow = () =>
    setRows((rs) => [
      ...rs,
      {
        code: `LCAT-${String(rs.length + 1).padStart(2, "0")}`,
        title: "New Labor Category",
        education: "Bachelors",
        years: 5,
        commercial: 150,
        gsa: 127.5,
      },
    ]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const updateCust = (id: string, patch: Partial<Customer>) =>
    setCustomers((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const setMFC = (id: string) => setCustomers((cs) => cs.map((c) => ({ ...c, isMFC: c.id === id })));
  const addCust = () =>
    setCustomers((cs) => [
      ...cs,
      { id: `c${Date.now()}`, name: "New Customer Category", discount: 0, terms: "Net 30", volume: "—", isMFC: false },
    ]);
  const removeCust = (id: string) => setCustomers((cs) => cs.filter((c) => c.id !== id));

  const epaProjection = useMemo(() => projectEpa(rows, epaRate), [rows, epaRate]);

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: CSP-1 Commercial Sales Practices
    const cspData = [
      ["Commercial Sales Practices (CSP-1)"],
      ["Offeror", CLIENT.name, "UEI", CLIENT.uei, "Solicitation", CLIENT.solicitation],
      [],
      ["Customer Category", "Discount %", "Payment Terms", "Volume Threshold", "MFC?"],
      ...customers.map((c) => [c.name, c.discount, c.terms, c.volume, c.isMFC ? "YES" : ""]),
      [],
      ["Proposed Government Discount %", proposedGovDiscount],
      ["MFC Discount %", mfc.discount],
      ["Differential (pts)", differential],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cspData), "CSP-1");

    // Sheet 2: Labor Categories with IFF
    const lcatData = [
      ["Proposed GSA Price List — Labor Categories"],
      [`IFF: ${(IFF * 100).toFixed(2)}%`],
      [],
      ["Code", "Title", "Education", "Min Years", "Commercial $/hr", "GSA $/hr (gov pays)", "Discount %", "Net to Contractor (after IFF)"],
      ...rows.map((r) => [
        r.code,
        r.title,
        r.education,
        r.years,
        r.commercial,
        r.gsa,
        ((1 - r.gsa / r.commercial) * 100).toFixed(2) + "%",
        +(r.gsa * (1 - IFF)).toFixed(2),
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lcatData), "Labor Categories");

    // Sheet 3: EPA Escalation
    const epaData = [
      ["Economic Price Adjustment (EPA) Projection"],
      [`Annual Escalation: ${epaRate.toFixed(2)}%`, `Index: ${epaIndex}`, "Reference: GSAR 552.216-70"],
      [],
      ["Code", "Title", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5"],
      ...epaProjection.map((p) => [p.code, p.title, ...p.years]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(epaData), "EPA");

    XLSX.writeFile(wb, `${CLIENT.name.replace(/\s+/g, "_")}_GSA_Pricing.xlsx`);
  };

  return (
    <>
      <PageHeader
        eyebrow="CSP-1 • Labor Rates • IFF • EPA"
        title="Pricing & Labor Category Builder"
        description="Capture commercial sales practices, derive proposed GSA pricing with IFF, and model EPA escalation."
        actions={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] font-mono text-muted-foreground uppercase">Avg GSA Discount</div>
              <div className="text-2xl font-mono font-bold text-primary leading-none">
                {(avgDiscount * 100).toFixed(1)}%
              </div>
            </div>
            <Button onClick={exportXlsx} size="sm">Export .xlsx</Button>
          </div>
        }
      />

      {/* CSP-1 Customer Categories */}
      <Panel
        title="CSP-1 — Commercial Sales Practices"
        className="mb-6 p-0"
        trailing={<Button size="sm" variant="ghost" onClick={addCust} className="h-7 text-[11px]">+ Add Category</Button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Customer Category</th>
                <th className="px-3 py-2 text-right">Discount %</th>
                <th className="px-3 py-2 text-left">Payment Terms</th>
                <th className="px-3 py-2 text-left">Volume Threshold</th>
                <th className="px-3 py-2 text-center">MFC</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((c) => (
                <tr key={c.id} className={c.isMFC ? "bg-warning/5" : ""}>
                  <td className="px-3 py-2">
                    <Input value={c.name} onChange={(e) => updateCust(c.id, { name: e.target.value })} className="h-7 text-xs" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      value={c.discount}
                      onChange={(e) => updateCust(c.id, { discount: parseFloat(e.target.value) || 0 })}
                      className="h-7 w-20 text-right text-xs font-mono ml-auto"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input value={c.terms} onChange={(e) => updateCust(c.id, { terms: e.target.value })} className="h-7 text-xs font-mono" />
                  </td>
                  <td className="px-3 py-2">
                    <Input value={c.volume} onChange={(e) => updateCust(c.id, { volume: e.target.value })} className="h-7 text-xs font-mono" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="radio"
                      checked={c.isMFC}
                      onChange={() => setMFC(c.id)}
                      className="cursor-pointer accent-warning"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => removeCust(c.id)}>×</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-4 py-3 bg-muted/20 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">MFC</div>
            <div className="font-bold">{mfc.name} — {mfc.discount.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Proposed Gov Discount</div>
            <Input
              type="number"
              value={proposedGovDiscount}
              onChange={(e) => setProposedGovDiscount(parseFloat(e.target.value) || 0)}
              className="h-7 w-24 text-xs font-mono font-bold mt-0.5"
            />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Differential vs MFC</div>
            <div className={`font-mono font-bold ${differential >= 0 ? "text-success" : "text-destructive"}`}>
              {differential >= 0 ? "+" : ""}{differential.toFixed(1)} pts {differential >= 0 ? "(equal or better)" : "(below MFC — review)"}
            </div>
          </div>
        </div>
      </Panel>

      {/* Labor Categories */}
      <Panel
        title="Labor Category Matrix"
        className="p-0 mb-6"
        trailing={<Button size="sm" variant="ghost" onClick={addRow} className="h-7 text-[11px]">+ Add LCAT</Button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Education</th>
                <th className="px-3 py-2 text-right">Yrs</th>
                <th className="px-3 py-2 text-right">Commercial $/hr</th>
                <th className="px-3 py-2 text-right">GSA $/hr</th>
                <th className="px-3 py-2 text-right">Discount</th>
                <th className="px-3 py-2 text-right">Net after IFF</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => {
                const disc = 1 - r.gsa / r.commercial;
                const net = r.gsa * (1 - IFF);
                return (
                  <tr key={r.code} className="font-mono text-xs">
                    <td className="px-3 py-2">
                      <Input value={r.code} onChange={(e) => updateRow(i, "code", e.target.value)} className="h-7 w-24 text-xs font-mono" />
                    </td>
                    <td className="px-3 py-2">
                      <Input value={r.title} onChange={(e) => updateRow(i, "title", e.target.value)} className="h-7 text-xs font-sans" />
                    </td>
                    <td className="px-3 py-2">
                      <Select value={r.education} onValueChange={(v) => updateRow(i, "education", v)}>
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HS">HS</SelectItem>
                          <SelectItem value="Associates">Associates</SelectItem>
                          <SelectItem value="Bachelors">Bachelors</SelectItem>
                          <SelectItem value="Masters">Masters</SelectItem>
                          <SelectItem value="PhD">PhD</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input type="number" value={r.years} onChange={(e) => updateRow(i, "years", e.target.value)} className="h-7 w-16 text-right text-xs font-mono" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input type="number" value={r.commercial} onChange={(e) => updateRow(i, "commercial", e.target.value)} className="h-7 w-24 text-right text-xs font-mono ml-auto" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input type="number" value={r.gsa} onChange={(e) => updateRow(i, "gsa", e.target.value)} className="h-7 w-24 text-right text-xs font-mono font-bold ml-auto border-primary/40" />
                    </td>
                    <td className={`px-3 py-2 text-right font-bold ${disc >= 0.1 ? "text-success" : "text-warning"}`}>
                      {(disc * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">${net.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => removeRow(i)}>×</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-4 py-2 bg-muted/20 text-[10px] font-mono text-muted-foreground">
          Net to Contractor = GSA price × (1 − IFF {(IFF * 100).toFixed(2)}%). GSA remits the IFF to the schedule.
        </div>
      </Panel>

      <div className="grid grid-cols-12 gap-6 mb-6">
        <Panel title="Discounting Summary" className="col-span-12 lg:col-span-5">
          <div className="space-y-2 text-xs">
            <Row label="MFC discount" value={`${mfc.discount.toFixed(1)}% (${mfc.name})`} />
            <Row label="Avg GSA discount vs commercial" value={`${(avgDiscount * 100).toFixed(1)}%`} />
            <Row label="Proposed Gov discount" value={`${proposedGovDiscount.toFixed(1)}%`} />
            <Row
              label="Differential vs MFC"
              value={`${differential >= 0 ? "+" : ""}${differential.toFixed(1)} pts`}
              accent={differential >= 0 ? "text-success" : "text-destructive"}
            />
            <Row label="Industrial Funding Fee" value={`${(IFF * 100).toFixed(2)}%`} />
            <Row label="Prompt payment terms" value="Net 30 / 1% 10 Net 30" />
            <Row label="Volume discount" value="None proposed" />
          </div>
        </Panel>

        <Panel title="EPA Configuration" className="col-span-12 lg:col-span-7">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground">Annual Escalation %</label>
              <Input
                type="number"
                step="0.1"
                value={epaRate}
                onChange={(e) => setEpaRate(parseFloat(e.target.value) || 0)}
                className="h-8 text-sm font-mono font-bold mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground">Index</label>
              <Select value={epaIndex} onValueChange={setEpaIndex}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BLS ECI - Professional & Business Services">BLS ECI — Prof. & Business Svcs</SelectItem>
                  <SelectItem value="BLS ECI - Total Compensation">BLS ECI — Total Compensation</SelectItem>
                  <SelectItem value="BLS CPI-U">BLS CPI-U</SelectItem>
                  <SelectItem value="Fixed Rate">Fixed Rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
            Pursuant to GSAR 552.216-70, the offeror proposes annual escalation of {epaRate.toFixed(1)}% applied on
            contract anniversary, indexed to {epaIndex}.
          </p>
          <Link
            to="/documents"
            className="inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm hover:bg-muted"
          >
            Open in Document Generator →
          </Link>
        </Panel>
      </div>

      <Panel title="EPA 5-Year Projection ($/hr)" className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Title</th>
                {["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"].map((y) => (
                  <th key={y} className="px-4 py-2 text-right">{y}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {epaProjection.map((p) => (
                <tr key={p.code} className="font-mono text-xs">
                  <td className="px-4 py-2 text-muted-foreground">{p.code}</td>
                  <td className="px-4 py-2 font-sans text-foreground font-medium">{p.title}</td>
                  {p.years.map((v, i) => (
                    <td key={i} className={`px-4 py-2 text-right ${i === 0 ? "font-bold" : "text-muted-foreground"}`}>
                      ${v.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function projectEpa(rows: Labor[], rate: number) {
  const factor = 1 + rate / 100;
  return rows.map((r) => ({
    code: r.code,
    title: r.title,
    years: [0, 1, 2, 3, 4].map((y) => r.gsa * Math.pow(factor, y)),
  }));
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between items-center border-b border-border/50 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-bold ${accent ?? ""}`}>{value}</span>
    </div>
  );
}
