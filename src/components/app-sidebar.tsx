import { Link, useRouterState } from "@tanstack/react-router";
import { MODULES } from "@/lib/mock-data";

const groups = [
  { id: "Status", label: "Status Tracker" },
  { id: "Intake", label: "Intake & Readiness" },
  { id: "Engine", label: "Automation Engine" },
  { id: "Final", label: "Finalization" },
];

function statusDot(status: string) {
  if (status === "complete") return "bg-success";
  if (status === "in_progress") return "bg-warning";
  if (status === "blocked") return "bg-destructive";
  return "border border-border";
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <aside className="w-64 border-r border-border bg-sidebar flex flex-col shrink-0 h-[calc(100vh-3rem)] sticky top-12">
      <div className="p-4 flex flex-col gap-4 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.id} className="flex flex-col gap-1">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 px-3">
              {g.label}
            </div>
            {MODULES.filter((m) => m.group === g.id).map((m) => {
              const active = pathname === m.slug;
              return (
                <Link
                  key={m.slug}
                  to={m.slug}
                  className={`flex items-center gap-3 px-3 py-2 text-sm rounded-sm transition-all ${
                    active
                      ? "bg-card border border-border shadow-sm font-medium text-foreground"
                      : "text-muted-foreground hover:bg-card hover:border hover:border-border"
                  }`}
                >
                  <span className={`size-2 rounded-full shrink-0 ${statusDot(m.status)}`} />
                  <span className="truncate">{m.label}</span>
                </Link>
              );
            })}
          </div>
        ))}

        <Link
          to="/export"
          className="mt-2 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 transition-colors rounded-sm border border-primary"
        >
          Export eOffer Package
        </Link>
      </div>
    </aside>
  );
}
