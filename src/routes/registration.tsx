import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, StatusPill } from "@/components/ui-primitives";
import { REGISTRATION_ITEMS } from "@/lib/mock-data";

export const Route = createFileRoute("/registration")({
  head: () => ({ meta: [{ title: "SAM/GSA Registration Tracker — ScheduleBuilder" }] }),
  component: RegistrationPage,
});

const TASKS = [
  { task: "Renew SAM.gov registration", due: "2025-03-12", owner: "Compliance", status: "in_progress" },
  { task: "Link FAS ID for negotiator", due: "2024-12-30", owner: "Negotiator", status: "blocked" },
  { task: "Issue eOffer digital certificate", due: "2025-01-08", owner: "IT", status: "blocked" },
  { task: "Confirm CAGE address", due: "—", owner: "Operations", status: "complete" },
  { task: "Upload incorporation docs", due: "—", owner: "Legal", status: "complete" },
];

function RegistrationPage() {
  return (
    <>
      <PageHeader
        eyebrow="SAM • UEI • CAGE • FAS ID • eOffer"
        title="SAM / GSA Registration Tracker"
        description="Track every registration prerequisite required to submit a valid MAS offer."
      />

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
                {REGISTRATION_ITEMS.map((r) => (
                  <tr key={r.label}>
                    <td className="px-4 py-3 font-medium text-foreground">{r.label}</td>
                    <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">{r.note}</td>
                    <td className="px-4 py-3 text-right"><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-6">
          <Panel title="Open Tasks">
            <ul className="space-y-2">
              {TASKS.map((t) => (
                <li key={t.task} className="border border-border rounded-sm p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="text-xs font-medium text-foreground">{t.task}</div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        Owner: {t.owner} • Due {t.due}
                      </div>
                    </div>
                    <StatusPill status={t.status} />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Notes">
            <p className="text-xs text-muted-foreground leading-relaxed">
              The authorized negotiator must hold an active FAS ID and a digital certificate to access the
              eOffer portal. ScheduleBuilder will not allow the export step to complete until both items
              are marked verified.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
