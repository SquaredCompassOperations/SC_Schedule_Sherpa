import { Link } from "@tanstack/react-router";
import { useEntity } from "@/lib/intake-store";
import { useAuth } from "@/lib/auth-context";

export function TopBar() {
  const { user, fullName, signOut, role } = useAuth();
  const entity = useEntity();
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
          ScheduleBuilder <span className="text-primary">v0.1</span>
        </Link>
        <nav className="flex gap-4 text-xs font-medium text-muted-foreground">
          <span className="text-foreground border-b-2 border-primary h-12 flex items-center px-1">
            Workspace
          </span>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-[10px] font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded-sm border border-border hidden sm:block">
          UEI: {entity.uei}
        </div>
        {user ? (
          <>
            <div className="text-[10px] font-mono text-muted-foreground hidden md:block">
              {fullName || user.email} · {role}
            </div>
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
