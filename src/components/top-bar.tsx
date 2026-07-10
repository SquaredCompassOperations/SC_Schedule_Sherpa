import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { clearAllPersisted } from "@/lib/persist";

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
  const initials = (fullName || user?.email || "U")
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card sticky top-0 z-20">
      <div className="flex items-center gap-6">
        <Link to="/" className="font-bold tracking-tighter text-lg uppercase text-foreground">
          Offer Automation <span className="text-primary">Workspace</span>
        </Link>
        <nav className="flex gap-4 text-xs font-medium text-muted-foreground">
          <Link to="/" className="text-foreground border-b-2 border-primary h-12 flex items-center px-1">
            Board
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <div className="text-[10px] font-mono text-muted-foreground hidden md:block">
              {fullName || user.email} · {role}
            </div>
            <button
              onClick={resetLocalDrafts}
              title="Clear browser-only draft data from older modules"
              className="text-[10px] font-bold uppercase tracking-widest border border-border px-2 py-1 rounded-sm hover:bg-muted"
            >
              Clear drafts
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
