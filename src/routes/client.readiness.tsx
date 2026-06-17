import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  useReadiness,
  patchReadiness,
  completeSection,
  submitReadiness,
  readinessStatus,
  type ReadinessSection,
} from "@/lib/readiness-store";

export const Route = createFileRoute("/client/readiness")({
  head: () => ({ meta: [{ title: "MAS Readiness Assessment — ScheduleBuilder" }] }),
  component: ClientReadiness,
});

const SECTIONS: { id: ReadinessSection; label: string }[] = [
  { id: "basics", label: "1. Basics" },
  { id: "compliance", label: "2. Compliance" },
  { id: "fit", label: "3. Market Fit" },
  { id: "commercial", label: "4. Commercial" },
  { id: "submit", label: "5. Submit" },
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
      {children}
    </label>
  );
}

function YN({
  value,
  onChange,
  options = ["yes", "no"] as const,
}: {
  value: string;
  onChange: (v: string) => void;
  options?: readonly string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest rounded-sm border ${
            value === o
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border hover:bg-muted"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2 border border-border rounded-sm bg-background text-sm focus:outline-none focus:border-primary"
    />
  );
}

function Area(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className="w-full px-3 py-2 border border-border rounded-sm bg-background text-sm focus:outline-none focus:border-primary"
    />
  );
}

function ClientReadiness() {
  const r = useReadiness();
  const navigate = useNavigate();
  const [section, setSection] = useState<ReadinessSection>(() => {
    const next = SECTIONS.find((s) => !r.sectionsComplete[s.id]);
    return (next?.id ?? "basics") as ReadinessSection;
  });
  const status = readinessStatus(r);

  const saveAndContinue = (current: ReadinessSection) => {
    completeSection(current);
    const idx = SECTIONS.findIndex((s) => s.id === current);
    const next = SECTIONS[idx + 1];
    if (next) setSection(next.id);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Step 1 of your offer
        </div>
        <h1 className="text-3xl font-bold mt-1">MAS Readiness Assessment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Before we build your offer, GSA requires you to confirm a few basics. Your answers help us
          tailor the package and flag any compliance gaps early.
        </p>
      </div>

      {status === "complete" && (
        <div className="border border-success bg-success/10 rounded-sm p-4 text-sm">
          <div className="font-bold text-success">Submitted</div>
          <div className="text-foreground/80 mt-0.5">
            Thanks — we received your assessment on{" "}
            {new Date(r.submittedAt!).toLocaleString()}. You can move on to uploading corporate
            documents.
          </div>
          <button
            onClick={() => navigate({ to: "/client/documents" })}
            className="mt-3 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-sm"
          >
            Continue → Documents
          </button>
        </div>
      )}

      {/* Section tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {SECTIONS.map((s) => {
          const done = r.sectionsComplete[s.id];
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`px-3 py-2 text-xs font-bold uppercase tracking-widest border-b-2 ${
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={done ? "text-success" : ""}>{done ? "✓ " : ""}</span>
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="border border-border rounded-sm bg-card p-6 space-y-5">
        {section === "basics" && (
          <>
            <div>
              <Label>Have you completed the GSA MAS Pathways training?</Label>
              <YN value={r.pathwaysCompleted} onChange={(v) => patchReadiness({ pathwaysCompleted: v as never })} />
            </div>
            <div>
              <Label>UEI (from SAM.gov)</Label>
              <Input value={r.uei} onChange={(e) => patchReadiness({ uei: e.target.value })} placeholder="12-character UEI" />
            </div>
            <div>
              <Label>Briefly describe what you sell</Label>
              <Area value={r.offeringDescription} onChange={(e) => patchReadiness({ offeringDescription: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Target MAS Large Category</Label>
                <Input value={r.category} onChange={(e) => patchReadiness({ category: e.target.value })} placeholder="e.g. IT" />
              </div>
              <div>
                <Label>Target SIN</Label>
                <Input value={r.sin} onChange={(e) => patchReadiness({ sin: e.target.value })} placeholder="e.g. 54151S" />
              </div>
            </div>
            <div>
              <Label>Do you have a dedicated GSA contract administrator?</Label>
              <YN value={r.hasContractAdmin} onChange={(v) => patchReadiness({ hasContractAdmin: v as never })} options={["yes", "no", "unsure"]} />
            </div>
            {r.hasContractAdmin === "yes" && (
              <div className="grid grid-cols-3 gap-4">
                <Input value={r.adminName} onChange={(e) => patchReadiness({ adminName: e.target.value })} placeholder="Name" />
                <Input value={r.adminTitle} onChange={(e) => patchReadiness({ adminTitle: e.target.value })} placeholder="Title" />
                <Input value={r.adminEmail} onChange={(e) => patchReadiness({ adminEmail: e.target.value })} placeholder="Email" />
              </div>
            )}
          </>
        )}

        {section === "compliance" && (
          <>
            <div>
              <Label>Are your products TAA-compliant (made in US/designated countries)?</Label>
              <YN value={r.taaCompliant} onChange={(v) => patchReadiness({ taaCompliant: v as never })} options={["yes", "no", "unsure", "na"]} />
            </div>
            <div>
              <Label>How do you monitor TAA compliance over time?</Label>
              <Area value={r.taaMonitoring} onChange={(e) => patchReadiness({ taaMonitoring: e.target.value })} />
            </div>
            <div>
              <Label>Section 889: do you provide covered telecom equipment/services?</Label>
              <YN value={r.section889Provides} onChange={(v) => patchReadiness({ section889Provides: v as never })} options={["yes", "no", "unsure"]} />
            </div>
            <div>
              <Label>Section 889: do you use covered telecom equipment/services internally?</Label>
              <YN value={r.section889Uses} onChange={(v) => patchReadiness({ section889Uses: v as never })} options={["yes", "no", "unsure"]} />
            </div>
            <div>
              <Label>How do you monitor Section 889 ongoing compliance?</Label>
              <Area value={r.section889Monitoring} onChange={(e) => patchReadiness({ section889Monitoring: e.target.value })} />
            </div>
            <div>
              <Label>Do you understand FASCSA covered article prohibitions?</Label>
              <YN value={r.fascsaUnderstood} onChange={(v) => patchReadiness({ fascsaUnderstood: v as never })} options={["yes", "no", "unsure"]} />
            </div>
            <div>
              <Label>How do you monitor FASCSA exclusions?</Label>
              <Area value={r.fascsaMonitoring} onChange={(e) => patchReadiness({ fascsaMonitoring: e.target.value })} />
            </div>
          </>
        )}

        {section === "fit" && (
          <>
            <div>
              <Label>Have you sold to the federal government before?</Label>
              <YN value={r.soldToGovBefore} onChange={(v) => patchReadiness({ soldToGovBefore: v as never })} />
            </div>
            <div>
              <Label>Which agencies are you targeting?</Label>
              <Area value={r.targetAgencies} onChange={(e) => patchReadiness({ targetAgencies: e.target.value })} placeholder="e.g. DoD, VA, HHS" />
            </div>
          </>
        )}

        {section === "commercial" && (
          <>
            <div>
              <Label>How do your GSA prices compare to your commercial prices?</Label>
              <YN
                value={r.pricePosture}
                onChange={(v) => patchReadiness({ pricePosture: v as never })}
                options={["lower", "same", "mix", "higher"]}
              />
            </div>
            <div>
              <Label>Expected annual GSA sales (year 1)</Label>
              <YN
                value={r.annualSales}
                onChange={(v) => patchReadiness({ annualSales: v as never })}
                options={["<25k", "25-50k", "50-75k", "75-100k", "100k+"]}
              />
            </div>
          </>
        )}

        {section === "submit" && (
          <div className="space-y-4">
            <div className="text-sm">
              Review your responses, then submit. Our team will pick this up under{" "}
              <span className="font-bold">Intake &amp; Readiness</span>.
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {SECTIONS.filter((s) => s.id !== "submit").map((s) => (
                <li key={s.id}>
                  <span className={r.sectionsComplete[s.id] ? "text-success" : "text-warning"}>
                    {r.sectionsComplete[s.id] ? "✓" : "○"}
                  </span>{" "}
                  {s.label}
                </li>
              ))}
            </ul>
            <button
              onClick={() => {
                submitReadiness();
                navigate({ to: "/client/documents" });
              }}
              disabled={!SECTIONS.filter((s) => s.id !== "submit").every((s) => r.sectionsComplete[s.id])}
              className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-sm disabled:opacity-40"
            >
              Submit Assessment
            </button>
          </div>
        )}

        {section !== "submit" && (
          <div className="flex justify-end pt-3 border-t border-border">
            <button
              onClick={() => saveAndContinue(section)}
              className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-sm"
            >
              Save &amp; Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
