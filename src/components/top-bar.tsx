import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  canUseClientPreview,
  getAdminViewModeForPath,
  getAdminViewModeTarget,
  type AdminViewMode,
} from "@/lib/client-preview-mode";
import { clearAllPersisted } from "@/lib/persist";
import squaredCompassLogo from "@/assets/squared-compass-logo.png";

function resetLocalDrafts() {
  if (typeof window === "undefined") return;
  const ok = window.confirm(
    "Clear local draft data? This clears browser-only trial data from the older modules. Supabase workspaces are not deleted.",
  );
  if (!ok) return;
  clearAllPersisted();
  try {
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }
  window.location.assign("/");
}

export function TopBar() {
  const { user, fullName, signOut, role } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const viewMode = getAdminViewModeForPath(pathname);
  const showPreviewSwitch = canUseClientPreview(role);
  const initials = (fullName || user?.email || "U")
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex min-w-0 items-center gap-5">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img
            src={squaredCompassLogo}
            alt="Squared Compass"
            className="h-8 w-28 shrink-0 object-contain object-left"
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-extrabold tracking-tight text-foreground">
              Schedule Sherpa
            </span>
            <span className="truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Offer Automation Workspace
            </span>
          </span>
        </Link>
      </div>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            {showPreviewSwitch ? <AdminClientPreviewSwitch activeMode={viewMode} /> : null}
            <div className="text-[10px] font-mono text-muted-foreground hidden md:block">
              {fullName || user.email} · {role}
            </div>
            <button
              onClick={resetLocalDrafts}
              title="Clear browser-only draft data from older modules"
              className="text-[10px] font-bold uppercase tracking-widest border border-border px-2 py-1 rounded-sm hover:bg-muted"
            >
              Reset
            </button>
            <button
              onClick={() => signOut()}
              className="text-[10px] font-bold uppercase tracking-widest border border-border px-2 py-1 rounded-sm hover:bg-muted"
            >
              Sign out
            </button>
            <div className="size-7 bg-foreground rounded-sm flex items-center justify-center text-[10px] text-background font-mono font-bold">
              {initials}
            </div>
          </>
        ) : (
          <Link
            to="/login"
            className="text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground px-3 py-1.5 rounded-sm"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

function AdminClientPreviewSwitch({ activeMode }: { activeMode: AdminViewMode }) {
  const options: Array<{ mode: AdminViewMode; label: string }> = [
    { mode: "admin", label: "Admin" },
    { mode: "client-preview", label: "Client Preview" },
  ];

  return (
    <div
      aria-label="Admin view mode"
      className="hidden items-center rounded-sm border border-border bg-surface p-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground md:flex"
    >
      {options.map((option) => {
        const active = activeMode === option.mode;
        return (
          <Link
            key={option.mode}
            to={getAdminViewModeTarget(option.mode)}
            className={`rounded-[2px] px-2 py-1 transition ${
              active ? "bg-primary text-primary-foreground" : "hover:text-foreground"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
