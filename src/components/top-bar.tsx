import { Link } from "@tanstack/react-router";
import { CLIENT } from "@/lib/mock-data";

export function TopBar() {
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
          <span className="h-12 flex items-center px-1 hover:text-foreground cursor-pointer transition-colors">
            Organizations
          </span>
          <span className="h-12 flex items-center px-1 hover:text-foreground cursor-pointer transition-colors">
            Audit Logs
          </span>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-[10px] font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded-sm border border-border">
          UEI: {CLIENT.uei}
        </div>
        <div className="text-[10px] font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded-sm border border-border hidden sm:block">
          {CLIENT.solicitation}
        </div>
        <div className="size-7 bg-foreground rounded-sm flex items-center justify-center text-[10px] text-background font-mono font-bold">
          JD
        </div>
      </div>
    </header>
  );
}
