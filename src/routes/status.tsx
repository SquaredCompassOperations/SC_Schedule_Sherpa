import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/status")({
  head: () => ({ meta: [{ title: "Status Tracker — ScheduleBuilder" }] }),
  component: StatusLayout,
});

const TABS = [
  { to: "/status", label: "Overview" },
  { to: "/status/milestones", label: "Milestones" },
  { to: "/status/open-items", label: "Open Items" },
  { to: "/status/activity", label: "Activity" },
] as const;

function StatusLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = pathname === t.to;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 ${
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
