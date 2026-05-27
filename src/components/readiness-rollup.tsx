import { Link } from "@tanstack/react-router";
import { Panel } from "@/components/ui-primitives";
import { useReadinessRollup, type ModuleReadiness } from "@/lib/readiness-rollup";

const stateClasses: Record<ModuleReadiness["state"], { bar: string; pill: string; dot: string }> = {
  ready: {
    bar: "bg-success",
    pill: "bg-success/10 text-success border-success/30",
    dot: "bg-success",
  },
  attention: {
    bar: "bg-warning",
    pill: "bg-warning/10 text-warning border-warning/30",
    dot: "bg-warning",
  },
  blocked: {
    bar: "bg-destructive",
    pill: "bg-destructive/10 text-destructive border-destructive/30",
    dot: "bg-destructive",
  },
};

export function ReadinessRollup({
  variant = "full",
}: {
  variant?: "full" | "compact";
}) {
  const r = useReadinessRollup();

  return (
    <Panel
      title="Workspace Readiness Rollup"
      trailing={
        <div className="flex items-center gap-3">
          <Counter label="Ready" value={r.ready} tone="success" />
          <Counter label="Attention" value={r.attention} tone="warning" />
          <Counter label="Blocked" value={r.blocked} tone="destructive" />
          <div className="border-l border-border pl-3 text-right">
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Composite</div>
            <div
              className={`text-2xl font-mono font-extrabold leading-none ${
                r.composite >= 90
                  ? "text-success"
                  : r.composite >= 75
                    ? "text-primary"
                    : "text-warning"
              }`}
            >
              {r.composite.toFixed(1)}
            </div>
          </div>
        </div>
      }
      className="p-0"
    >
      <ul className="divide-y divide-border">
        {r.modules.map((m) => {
          const c = stateClasses[m.state];
          return (
            <li key={m.slug}>
              <Link
                to={m.slug}
                className="block px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`size-2 rounded-full shrink-0 ${c.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">{m.label}</div>
                    {variant === "full" && (
                      <div className="text-[11px] font-mono text-muted-foreground truncate">
                        {m.summary}
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm border ${c.pill}`}
                  >
                    {m.state}
                  </span>
                  <div className="w-28 shrink-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        w{m.weight}
                      </span>
                      <span className="text-xs font-mono font-bold text-foreground">{m.score}</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${c.bar}`} style={{ width: `${m.score}%` }} />
                    </div>
                  </div>
                </div>
                {variant === "full" && m.blockers.length > 0 && (
                  <ul className="mt-2 pl-5 space-y-0.5">
                    {m.blockers.map((b) => (
                      <li
                        key={b}
                        className="text-[10px] font-mono text-destructive/90 flex gap-1.5"
                      >
                        <span>›</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <div
        className={`px-4 py-3 border-t border-border text-[11px] font-mono flex items-center justify-between ${
          r.exportReady
            ? "bg-success/5 text-success"
            : "bg-warning/5 text-warning"
        }`}
      >
        <span>
          <span className="font-bold uppercase tracking-widest">
            {r.exportReady ? "Export Ready" : "Export Blocked"}
          </span>{" "}
          · live rollup synced with document & compliance state
        </span>
        <Link
          to="/export"
          className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 border border-current rounded-sm hover:bg-current/10"
        >
          Export →
        </Link>
      </div>
    </Panel>
  );
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "destructive";
}) {
  const color =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive";
  return (
    <div className="text-right">
      <div className="text-[10px] font-mono uppercase text-muted-foreground">{label}</div>
      <div className={`text-lg font-mono font-bold leading-none ${color}`}>{value}</div>
    </div>
  );
}
