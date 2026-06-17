import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { CLIENT } from "@/lib/mock-data";

export const Route = createFileRoute("/client")({
  head: () => ({ meta: [{ title: "Your Offer Status — ScheduleBuilder" }] }),
  component: ClientLayout,
});

const TABS = [
  { to: "/client", label: "Overview" },
  { to: "/client/readiness", label: "MAS Readiness" },
  { to: "/client/documents", label: "Documents" },
  { to: "/client/review", label: "Review & Sign-Off" },
  { to: "/client/timeline", label: "Timeline" },
  { to: "/client/messages", label: "Updates" },
] as const;

function ClientLayout() {
  const { user, loading, signOut, fullName, company } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Client Portal
          </div>
          <div className="text-sm font-bold">{company || CLIENT.name}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground hidden sm:block">{fullName || user.email}</div>
          <button
            onClick={() => signOut()}
            className="text-[10px] font-bold uppercase tracking-widest border border-border px-3 py-1.5 rounded-sm hover:bg-muted"
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="border-b border-border bg-background">
        <div className="max-w-4xl mx-auto flex gap-1 px-6">
          {TABS.map((t) => {
            const active = pathname === t.to;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`px-4 py-3 text-xs font-bold uppercase tracking-widest border-b-2 ${
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
      </div>
      <main className="max-w-4xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
