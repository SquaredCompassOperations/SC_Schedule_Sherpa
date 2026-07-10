import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BriefcaseBusiness } from "lucide-react";
import { getOfferWorkspace } from "@/lib/offer-workspace.functions";
import { useSelectedOfferId } from "@/lib/offer-workspace";

export function SelectedWorkspaceBanner() {
  const selectedOfferId = useSelectedOfferId();
  const query = useQuery({
    queryKey: ["selected-offer-workspace", selectedOfferId],
    queryFn: () => (selectedOfferId ? getOfferWorkspace(selectedOfferId) : Promise.resolve(null)),
    enabled: Boolean(selectedOfferId),
  });

  if (!selectedOfferId) {
    return (
      <div className="border-b border-border bg-surface px-4 py-2 text-[11px] text-muted-foreground">
        Select an offer from the workspace board to scope workflow modules.
      </div>
    );
  }

  const workspace = query.data;

  return (
    <div className="border-b border-border bg-surface px-4 py-2">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <BriefcaseBusiness className="size-4 shrink-0 text-primary" />
          {query.isLoading ? (
            <span className="text-muted-foreground">Loading selected workspace...</span>
          ) : workspace ? (
            <span className="truncate">
              <span className="font-bold text-foreground">{workspace.organizationName}</span>
              <span className="text-muted-foreground"> · {workspace.offerTypeLabel} · {workspace.stageLabel}</span>
            </span>
          ) : (
            <span className="text-warning">Selected workspace is no longer available.</span>
          )}
        </div>
        <Link to="/" className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-primary">
          Change workspace
        </Link>
      </div>
    </div>
  );
}
