import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, CircleAlert, Clock, FileText, Search, UserCheck } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { PageHeader, StatusPill } from "@/components/ui-primitives";
import {
  createOfferWorkspace,
  listOfferWorkspaces,
  listOrganizations,
  type CreateOfferWorkspaceInput,
  type OrganizationOption,
} from "@/lib/offer-workspace.functions";
import {
  filterOfferWorkspaceCards,
  OFFER_STAGE_META,
  selectOffer,
  type OfferStage,
  type OfferWorkspaceCard,
} from "@/lib/offer-workspace";
import { offerWorkspaceQueryKeys } from "@/lib/offer-workspace-query";
import { useAuth } from "@/lib/auth-context";

const STAGE_ORDER: OfferStage[] = [
  "intake",
  "readiness",
  "automation",
  "review",
  "submission",
  "post_submission",
];

export function WorkspaceBoard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<OfferStage | "all">("all");
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const query = useQuery({
    queryKey: offerWorkspaceQueryKeys.list(user?.id ?? "anonymous"),
    queryFn: () => listOfferWorkspaces(),
    enabled: Boolean(user?.id),
  });

  const organizations = useQuery({
    queryKey: offerWorkspaceQueryKeys.organizations(user?.id ?? "anonymous"),
    queryFn: () => listOrganizations(),
    enabled: Boolean(user?.id),
  });

  const createMutation = useMutation({
    mutationFn: createOfferWorkspace,
    onSuccess: async (result) => {
      selectOffer(result.offerId);
      if (user?.id) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: offerWorkspaceQueryKeys.list(user.id) }),
          queryClient.invalidateQueries({ queryKey: offerWorkspaceQueryKeys.organizations(user.id) }),
        ]);
      }
      setCreateOpen(false);
      navigate({ to: "/status" });
    },
  });

  const filtered = useMemo(
    () =>
      filterOfferWorkspaceCards(query.data ?? [], {
        search,
        stage,
        blockedOnly,
      }),
    [query.data, search, stage, blockedOnly],
  );

  const grouped = useMemo(
    () =>
      STAGE_ORDER.map((stageId) => ({
        stage: stageId,
        meta: OFFER_STAGE_META[stageId],
        cards: filtered.filter((card) => card.stage === stageId),
      })),
    [filtered],
  );

  return (
    <>
      <PageHeader
        eyebrow="Offer Automation Workspace"
        title="Workspace Board"
        description="Manage active offer workspaces, client blockers, document reviews, and submission progress from one board."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen((open) => !open)}
            aria-expanded={createOpen}
            aria-controls="create-workspace-form"
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-3 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground"
          >
            <BriefcaseBusiness className="size-4" />
            New GSA MAS Offer
          </button>
        }
      />

      {createOpen ? (
        <CreateWorkspaceForm
          busy={createMutation.isPending}
          error={createMutation.error ? (createMutation.error as Error).message : null}
          organizations={organizations.data ?? []}
          onCancel={() => setCreateOpen(false)}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search workspaces"
            placeholder="Search client, offer, solicitation, or type"
            className="h-10 w-full rounded-sm border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <select
          value={stage}
          onChange={(event) => setStage(event.target.value as OfferStage | "all")}
          aria-label="Filter workspaces by stage"
          className="h-10 rounded-sm border border-border bg-card px-3 text-sm"
        >
          <option value="all">All stages</option>
          {STAGE_ORDER.map((stageId) => (
            <option key={stageId} value={stageId}>
              {OFFER_STAGE_META[stageId].label}
            </option>
          ))}
        </select>
        <label className="flex h-10 items-center gap-2 rounded-sm border border-border bg-card px-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <input
            type="checkbox"
            checked={blockedOnly}
            onChange={(event) => setBlockedOnly(event.target.checked)}
          />
          Blocked only
        </label>
      </div>

      {query.isLoading ? (
        <div className="rounded-sm border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading workspaces...
        </div>
      ) : query.isError ? (
        <div className="rounded-sm border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          {(query.error as Error).message}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyWorkspaceState hasFilters={Boolean(search || stage !== "all" || blockedOnly)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {grouped
            .filter((group) => group.cards.length > 0)
            .map((group) => (
              <section key={group.stage} className="rounded-sm border border-border bg-surface">
                <div className="border-b border-border px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">
                        {group.meta.label}
                      </h2>
                      <p className="mt-1 text-[11px] text-muted-foreground">{group.meta.description}</p>
                    </div>
                    <span className="font-mono text-lg font-bold text-primary">{group.cards.length}</span>
                  </div>
                </div>
                <div className="space-y-3 p-3">
                  {group.cards.map((card) => (
                    <WorkspaceCard key={card.id} card={card} />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </>
  );
}

function CreateWorkspaceForm({
  busy,
  error,
  organizations,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  organizations: OrganizationOption[];
  onCancel: () => void;
  onSubmit: (values: CreateOfferWorkspaceInput) => void;
}) {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [offerName, setOfferName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [solicitationNumber, setSolicitationNumber] = useState("47QSMD20R0001");

  return (
    <form
      id="create-workspace-form"
      className="mb-6 rounded-sm border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          organizationId: organizationId ?? undefined,
          organizationName,
          offerName,
          clientEmail,
          solicitationNumber,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Client company
          </span>
          <select
            value={organizationId ?? "new"}
            onChange={(event) => setOrganizationId(event.target.value === "new" ? null : event.target.value)}
            className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm"
          >
            <option value="new">Create new organization</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.legalName}
              </option>
            ))}
          </select>
        </label>
        {organizationId === null ? (
          <label className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              New organization name
            </span>
            <input
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm"
              required
            />
          </label>
        ) : null}
        <label className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Offer name
          </span>
          <input
            value={offerName}
            onChange={(event) => setOfferName(event.target.value)}
            className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm"
            required
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Client email
          </span>
          <input
            type="email"
            value={clientEmail}
            onChange={(event) => setClientEmail(event.target.value)}
            className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Solicitation
          </span>
          <input
            value={solicitationNumber}
            onChange={(event) => setSolicitationNumber(event.target.value)}
            className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm"
          />
        </label>
      </div>
      {error ? <div role="alert" className="mt-3 text-sm text-destructive">{error}</div> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-sm border border-border px-3 py-2 text-xs font-bold uppercase tracking-widest"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-sm bg-primary px-3 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Creating..." : "Create workspace"}
        </button>
      </div>
    </form>
  );
}

function EmptyWorkspaceState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-sm border border-border bg-card p-8 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-sm bg-muted text-muted-foreground">
        <BriefcaseBusiness className="size-5" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-foreground">
        {hasFilters ? "No workspaces match these filters" : "No offer workspaces yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {hasFilters
          ? "Adjust the filters to see active workspaces."
          : "Create the first GSA MAS workspace after the Supabase migration has been applied."}
      </p>
    </div>
  );
}

function WorkspaceCard({ card }: { card: OfferWorkspaceCard }) {
  return (
    <Link
      to="/status"
      onClick={() => selectOffer(card.id)}
      className="block rounded-sm border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-foreground">{card.organizationName}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{card.name}</div>
        </div>
        <StatusPill status={card.status} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <span>{card.offerTypeLabel}</span>
        {card.solicitationNumber ? <span>{card.solicitationNumber}</span> : null}
        {card.selectedSinCodes.length > 0 ? <span>{card.selectedSinCodes.join(", ")}</span> : null}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric icon={<Clock className="size-3" />} label="Ready" value={`${card.readinessPercent}%`} />
        <Metric icon={<FileText className="size-3" />} label="Review" value={String(card.documentsInReview)} />
        <Metric icon={<CircleAlert className="size-3" />} label="Client" value={String(card.openClientItems)} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <UserCheck className="size-3" />
          <span className="truncate">Signer: {card.authorizedNegotiatorStatus}</span>
        </div>
        <div className="text-right text-[10px] font-bold uppercase tracking-widest text-primary">
          {card.nextAction}
        </div>
      </div>
    </Link>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-surface p-2">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}
