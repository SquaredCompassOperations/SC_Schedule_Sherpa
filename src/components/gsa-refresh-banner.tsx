import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { checkGsaTemplateVersion } from "@/lib/gsa-template-version.functions";

type Status = Awaited<ReturnType<typeof checkGsaTemplateVersion>>;

const DISMISS_KEY = "gsa-refresh-banner-dismissed";

export function GsaRefreshBanner() {
  const fn = useServerFn(checkGsaTemplateVersion);
  const [status, setStatus] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fn()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fn]);

  useEffect(() => {
    if (!status) return;
    const key = `${DISMISS_KEY}:${status.latestDetected ?? status.bundledRefresh}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(key) === "1") {
      setDismissed(true);
    }
  }, [status]);

  if (!status || dismissed) return null;
  const hasInteract = status.interactAlerts && status.interactAlerts.length > 0;
  if (status.upToDate && !hasInteract) return null;

  const tone = status.upToDate ? "warning" : "destructive";
  const toneClass =
    tone === "destructive"
      ? "border-destructive/40 bg-destructive/5 text-destructive"
      : "border-warning/40 bg-warning/5 text-warning";

  const dismiss = () => {
    const key = `${DISMISS_KEY}:${status.latestDetected ?? status.bundledRefresh}`;
    if (typeof window !== "undefined") sessionStorage.setItem(key, "1");
    setDismissed(true);
  };

  return (
    <div className={`border-b px-4 py-2 text-xs ${toneClass}`}>
      <div className="max-w-7xl mx-auto flex items-start gap-3">
        <div className="font-mono uppercase tracking-widest text-[10px] mt-0.5 shrink-0">
          GSA Refresh
        </div>
        <div className="grow space-y-1">
          <div className="text-foreground">{status.message}</div>
          {hasInteract ? (
            <div className="text-muted-foreground">
              Interact feed: {status.interactAlerts.map((a) => a.keyword).join(", ")}
            </div>
          ) : null}
          {status.detectedLinks.length > 0 && !status.upToDate ? (
            <ul className="text-[11px] text-muted-foreground space-y-0.5">
              {status.detectedLinks.map((l, i) => (
                <li key={i}>
                  •{" "}
                  {l.url ? (
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="underline">
                      {l.label}
                    </a>
                  ) : (
                    l.label
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <Link
          to="/pricing-workbook"
          className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 border border-current rounded-sm hover:bg-current/10 shrink-0"
        >
          Review
        </Link>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-[10px] font-mono shrink-0 px-2 py-1 hover:bg-current/10 rounded-sm"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
