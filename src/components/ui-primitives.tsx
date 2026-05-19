import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex justify-between items-end border-b border-border pb-6 mb-8 gap-6 flex-wrap">
      <div className="space-y-1">
        {eyebrow ? (
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground max-w-2xl">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-3 items-center">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  trailing,
  children,
  className = "",
}: {
  title?: string;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-card border border-border rounded-sm ${className}`}>
      {title ? (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">{title}</h3>
          {trailing}
        </div>
      ) : null}
      <div className={title ? "p-4" : "p-4"}>{children}</div>
    </section>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    valid: "bg-success/10 text-success border-success/30",
    complete: "bg-success/10 text-success border-success/30",
    final: "bg-success/10 text-success border-success/30",
    approved: "bg-success/10 text-success border-success/30",
    ok: "bg-success/10 text-success border-success/30",
    review: "bg-warning/10 text-warning border-warning/30",
    in_review: "bg-warning/10 text-warning border-warning/30",
    in_progress: "bg-warning/10 text-warning border-warning/30",
    draft: "bg-primary/10 text-primary border-primary/30",
    pending: "bg-muted text-muted-foreground border-border",
    not_started: "bg-muted text-muted-foreground border-border",
    na: "bg-muted text-muted-foreground border-border",
    missing: "bg-destructive/10 text-destructive border-destructive/30",
    gap: "bg-destructive/10 text-destructive border-destructive/30",
    blocked: "bg-destructive/10 text-destructive border-destructive/30",
  };
  const cls = map[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase border ${cls}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
