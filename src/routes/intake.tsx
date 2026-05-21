import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel } from "@/components/ui-primitives";
import { FileUploader } from "@/components/file-uploader";
import { CLIENT } from "@/lib/mock-data";

export const Route = createFileRoute("/intake")({
  head: () => ({ meta: [{ title: "Client Intake — ScheduleBuilder" }] }),
  component: IntakePage,
});

const STEPS = [
  "Business Identity",
  "SAM & Registrations",
  "Authorized Negotiators",
  "Socioeconomic Status",
  "Corporate Experience",
  "Financials & Policies",
  "Past Performance",
  "Pricing Inputs",
  "Final Confirmation",
];

function IntakePage() {
  const [step, setStep] = useState(0);

  return (
    <>
      <PageHeader
        eyebrow="Master Intake Record"
        title="Client Intake Portal"
        description="Enter once, populate everywhere. This intake feeds the SIN engine, document generator, pricing workbook, compliance matrix, and eOffer export."
      />

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-3">
          <Panel title={`Step ${step + 1} of ${STEPS.length}`}>
            <ol className="space-y-1">
              {STEPS.map((s, i) => (
                <li key={s}>
                  <button
                    onClick={() => setStep(i)}
                    className={`w-full text-left flex items-center gap-3 px-2 py-1.5 rounded-sm text-xs transition-colors ${
                      i === step
                        ? "bg-primary/10 text-primary font-medium"
                        : i < step
                        ? "text-foreground"
                        : "text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className={`size-5 rounded-full font-mono text-[10px] flex items-center justify-center shrink-0 ${
                        i < step ? "bg-success text-success-foreground" : i === step ? "bg-primary text-primary-foreground" : "border border-border"
                      }`}
                    >
                      {i < step ? "✓" : i + 1}
                    </span>
                    {s}
                  </button>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>

        <div className="col-span-12 lg:col-span-9">
          <Panel title={STEPS[step]}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {fieldsFor(step).map((f) => (
                <Field key={f.label} {...f} />
              ))}
            </div>

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
              <button
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                className="text-xs font-medium px-4 py-2 border border-border rounded-sm hover:bg-muted disabled:opacity-30"
              >
                ← Previous
              </button>
              <div className="text-[10px] font-mono text-muted-foreground">
                Auto-saved 2s ago
              </div>
              <button
                onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}
                className="text-xs font-bold uppercase tracking-widest px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90"
              >
                Save & Continue →
              </button>
            </div>
          </Panel>

          <div className="mt-6">
            <Panel
              title="Supporting Documents"
              trailing={
                <span className="text-[10px] font-mono text-muted-foreground">
                  Word · PDF · Excel · CSV · PPT · RTF · Images · Email · ZIP · XML/JSON
                </span>
              }
            >
              <FileUploader />
              <div className="mt-3 text-[10px] font-mono text-muted-foreground">
                Uploads feed the master record and become source artifacts for the compliance matrix and eOffer package.
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, value, type = "text", hint }: { label: string; value: string; type?: string; hint?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
        {label}
      </label>
      {type === "textarea" ? (
        <textarea
          defaultValue={value}
          className="w-full px-3 py-2 text-sm border border-border bg-background rounded-sm focus:outline-none focus:ring-1 focus:ring-primary h-24"
        />
      ) : (
        <input
          defaultValue={value}
          className="w-full px-3 py-2 text-sm border border-border bg-background rounded-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
        />
      )}
      {hint ? <div className="text-[10px] text-muted-foreground mt-1">{hint}</div> : null}
    </div>
  );
}

function fieldsFor(step: number): Array<{ label: string; value: string; type?: string; hint?: string }> {
  const sets: Array<Array<{ label: string; value: string; type?: string; hint?: string }>> = [
    [
      { label: "Legal Business Name", value: CLIENT.name },
      { label: "UEI", value: CLIENT.uei, hint: "12-character SAM.gov UEI" },
      { label: "CAGE Code", value: CLIENT.cage },
      { label: "EIN", value: CLIENT.ein },
      { label: "Primary NAICS", value: CLIENT.naicsPrimary },
      { label: "Employee Count", value: String(CLIENT.employees) },
    ],
    [
      { label: "SAM.gov Status", value: "Active" },
      { label: "SAM.gov Expiration", value: CLIENT.samExpires },
      { label: "FAS ID", value: CLIENT.fasId, hint: "Required for eOffer portal" },
      { label: "eOffer Digital Cert", value: "Not Issued" },
    ],
    [
      { label: "Negotiator Name", value: "Jordan Daniels" },
      { label: "Title", value: "VP Contracts" },
      { label: "Email", value: "j.daniels@advantix.example" },
      { label: "Phone", value: "+1 (703) 555-0199" },
    ],
    [
      { label: "Socioeconomic Status", value: CLIENT.socioeconomic, hint: "SDVOSB, WOSB, HUBZone, 8(a)…" },
      { label: "SBA Verification Date", value: "2024-08-12" },
    ],
    [
      { label: "Years in Business", value: "12" },
      { label: "Largest Commercial Contract", value: "$4.8M" },
      { label: "Corporate Overview", value: "Advantix delivers cloud modernization and cybersecurity services to commercial and public-sector clients...", type: "textarea" },
    ],
    [
      { label: "P&L Uploaded", value: "FY22, FY23, FY24" },
      { label: "Balance Sheet Uploaded", value: "FY22, FY23, FY24" },
      { label: "Accounting System", value: "Deltek Costpoint" },
      { label: "Uncompensated Overtime Policy", value: "Documented — see policy library" },
    ],
    [
      { label: "Past Performance References", value: "3 of 3 required", hint: "Min 2 references per SIN" },
      { label: "CPARS Available", value: "Yes" },
    ],
    [
      { label: "Commercial Price List Source", value: "CPL_2024.xlsx" },
      { label: "Most Favored Customer Discount", value: "12%" },
      { label: "Proposed GSA Discount", value: "15%" },
    ],
    [
      { label: "Authorized Negotiator Certification", value: "Pending Signature" },
      { label: "Confirmation", value: "I certify all data is accurate and complete.", type: "textarea" },
    ],
  ];
  return sets[step] ?? [];
}
