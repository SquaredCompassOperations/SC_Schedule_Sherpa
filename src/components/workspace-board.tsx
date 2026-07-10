import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Clock,
  FileArchive,
  FileText,
  FolderKanban,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { StatusPill } from "@/components/ui-primitives";
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
  useSelectedOfferId,
  type OfferStage,
  type OfferWorkspaceCard,
} from "@/lib/offer-workspace";
import { offerWorkspaceQueryKeys } from "@/lib/offer-workspace-query";
import { useAuth } from "@/lib/auth-context";
import { COMPLIANCE_MATRIX, REGISTRATION_ITEMS, SIN_MATCHES } from "@/lib/mock-data";

const STAGE_ORDER: OfferStage[] = [
  "intake",
  "readiness",
  "automation",
  "review",
  "submission",
  "post_submission",
];

const WORKFLOW_OVERVIEW = [
  {
    label: "Workspace",
    detail: "Master offer record",
    route: "/" as const,
    icon: FolderKanban,
  },
  {
    label: "Intake",
    detail: "Profile, files, readiness",
    route: "/intake" as const,
    icon: ClipboardList,
  },
  {
    label: "Automation",
    detail: "Narratives and pricing",
    route: "/market-validation" as const,
    icon: Bot,
  },
  {
    label: "Documents",
    detail: "Drafts and source files",
    route: "/documents" as const,
    icon: FileText,
  },
  {
    label: "Review",
    detail: "Client sign-off and package",
    route: "/review" as const,
    icon: CheckCircle2,
  },
];

export function WorkspaceBoard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const selectedOfferId = useSelectedOfferId();
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
          queryClient.invalidateQueries({
            queryKey: offerWorkspaceQueryKeys.organizations(user.id),
          }),
        ]);
      }
      setCreateOpen(false);
      navigate({ to: "/" });
    },
  });

  const cards = useMemo(() => query.data ?? [], [query.data]);
  const filtered = useMemo(
    () =>
      filterOfferWorkspaceCards(cards, {
        search,
        stage,
        blockedOnly,
      }),
    [cards, search, stage, blockedOnly],
  );

  const activeCard = useMemo(() => {
    if (filtered.length === 0) return null;
    return (
      filtered.find((card) => card.id === selectedOfferId) ??
      cards.find((card) => card.id === selectedOfferId) ??
      filtered[0]
    );
  }, [cards, filtered, selectedOfferId]);

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Via Schedule Sherpa
          </div>
          <h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight text-foreground">
            Active Offer: {activeCard ? activeCard.organizationName : "Workspace"}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Master intake record feeds every module below. All data shown is sourced from the single
            client profile.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeCard ? <ReadinessBadge card={activeCard} /> : null}
          <button
            type="button"
            onClick={() => setCreateOpen((open) => !open)}
            aria-expanded={createOpen}
            aria-controls="create-workspace-form"
            className="inline-flex h-9 items-center gap-2 rounded-sm bg-primary px-3 text-xs font-bold uppercase tracking-widest text-primary-foreground"
          >
            <BriefcaseBusiness className="size-4" />
            New Offer
          </button>
        </div>
      </section>

      {createOpen ? (
        <CreateWorkspaceForm
          busy={createMutation.isPending}
          error={createMutation.error ? (createMutation.error as Error).message : null}
          organizationError={organizations.isError ? (organizations.error as Error).message : null}
          organizationsLoading={organizations.isPending}
          organizations={organizations.data ?? []}
          onCancel={() => setCreateOpen(false)}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      ) : null}

      <WorkspaceFilters
        search={search}
        stage={stage}
        blockedOnly={blockedOnly}
        onSearch={setSearch}
        onStage={setStage}
        onBlockedOnly={setBlockedOnly}
      />

      {query.isLoading ? (
        <div className="rounded-sm border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading workspaces...
        </div>
      ) : query.isError ? (
        <div className="rounded-sm border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          {(query.error as Error).message}
        </div>
      ) : activeCard === null ? (
        <EmptyWorkspaceState hasFilters={Boolean(search || stage !== "all" || blockedOnly)} />
      ) : (
        <ActiveOfferDashboard
          activeCard={activeCard}
          workspaces={filtered}
          onSelectWorkspace={(id) => selectOffer(id)}
        />
      )}
    </div>
  );
}

function ReadinessBadge({ card }: { card: OfferWorkspaceCard }) {
  return (
    <div className="flex h-9 items-center gap-3 rounded-sm border border-border bg-card px-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Readiness
      </span>
      <div className="h-2 w-24 overflow-hidden rounded-sm bg-muted">
        <div
          className="h-full bg-primary"
          style={{ width: `${Math.min(100, Math.max(0, card.readinessPercent))}%` }}
        />
      </div>
      <span className="font-mono text-sm font-bold text-primary">{card.readinessPercent}%</span>
    </div>
  );
}

function WorkspaceFilters({
  search,
  stage,
  blockedOnly,
  onSearch,
  onStage,
  onBlockedOnly,
}: {
  search: string;
  stage: OfferStage | "all";
  blockedOnly: boolean;
  onSearch: (value: string) => void;
  onStage: (value: OfferStage | "all") => void;
  onBlockedOnly: (value: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto_auto]">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          aria-label="Search workspaces"
          placeholder="Search client, offer, solicitation, or type"
          className="h-9 w-full rounded-sm border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
      </label>
      <select
        value={stage}
        onChange={(event) => onStage(event.target.value as OfferStage | "all")}
        aria-label="Filter workspaces by stage"
        className="h-9 rounded-sm border border-border bg-card px-3 text-sm"
      >
        <option value="all">All stages</option>
        {STAGE_ORDER.map((stageId) => (
          <option key={stageId} value={stageId}>
            {OFFER_STAGE_META[stageId].label}
          </option>
        ))}
      </select>
      <label className="flex h-9 items-center gap-2 rounded-sm border border-border bg-card px-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <input
          type="checkbox"
          checked={blockedOnly}
          onChange={(event) => onBlockedOnly(event.target.checked)}
        />
        Blocked only
      </label>
    </div>
  );
}

function ActiveOfferDashboard({
  activeCard,
  workspaces,
  onSelectWorkspace,
}: {
  activeCard: OfferWorkspaceCard;
  workspaces: OfferWorkspaceCard[];
  onSelectWorkspace: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.15fr_0.82fr]">
      <RegistrationPanel card={activeCard} />
      <CompliancePanel card={activeCard} />
      <ExportPanel card={activeCard} />
      <SinPanel card={activeCard} />
      <ProgressPanel card={activeCard} />
      <WorkspaceQueuePanel
        activeCard={activeCard}
        workspaces={workspaces}
        onSelectWorkspace={onSelectWorkspace}
      />
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  children,
  action,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-sm border border-border bg-card ${className}`}>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="truncate text-sm font-extrabold uppercase tracking-wide text-foreground">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function RegistrationPanel({ card }: { card: OfferWorkspaceCard }) {
  const items = REGISTRATION_ITEMS.map((item) => {
    if (item.label === "eOffer Digital Cert") {
      return {
        ...item,
        status: card.authorizedNegotiatorStatus === "ready" ? "ok" : "gap",
        note:
          card.authorizedNegotiatorStatus === "ready" ? "Authorized negotiator ready" : item.note,
      };
    }
    if (item.label === "Readiness Assessment") {
      return {
        ...item,
        status: card.readinessPercent >= 100 ? "ok" : "gap",
        note:
          card.readinessPercent >= 100
            ? "Readiness assessment complete"
            : `${card.readinessPercent}% complete`,
      };
    }
    return item;
  });

  return (
    <Panel title="Registration Gaps" eyebrow={card.offerTypeLabel}>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-3 px-4 py-3">
            <StatusIcon status={item.status} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{item.label}</div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.note}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CompliancePanel({ card }: { card: OfferWorkspaceCard }) {
  const verifiedCount = COMPLIANCE_MATRIX.filter((item) => item.status === "valid").length;
  const reviewCount = Math.max(
    card.documentsInReview,
    COMPLIANCE_MATRIX.filter((item) => item.status === "review").length,
  );

  return (
    <Panel
      title="Compliance Matrix Progress"
      eyebrow={`${verifiedCount} verified · ${reviewCount} review`}
      action={<StatusPill status={card.status} />}
    >
      <div className="grid grid-cols-[1fr_1.35fr_0.9fr_auto] border-b border-border px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <span>Ref</span>
        <span>Requirement</span>
        <span>Source</span>
        <span>Status</span>
      </div>
      <div className="divide-y divide-border">
        {COMPLIANCE_MATRIX.slice(0, 6).map((item) => (
          <div
            key={`${item.ref}-${item.req}`}
            className="grid grid-cols-[1fr_1.35fr_0.9fr_auto] items-center gap-3 px-4 py-2.5 text-xs"
          >
            <span className="font-mono text-muted-foreground">{item.ref}</span>
            <span className="min-w-0 truncate font-medium text-foreground">{item.req}</span>
            <span className="min-w-0 truncate text-muted-foreground">{item.source}</span>
            <MatrixStatus status={item.status} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ExportPanel({ card }: { card: OfferWorkspaceCard }) {
  return (
    <section className="flex min-h-64 flex-col justify-between rounded-sm border border-primary/20 bg-[#15152b] p-4 text-primary-foreground">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/55">
          Export Ready
        </div>
        <h2 className="mt-2 text-xl font-extrabold tracking-tight">eOffer package assembly</h2>
        <p className="mt-2 text-sm text-primary-foreground/70">
          Package locked source files, finalized narratives, pricing workbook, and client sign-off
          into a submission-ready zip.
        </p>
      </div>
      <div className="mt-6 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Metric
            icon={<Clock className="size-3" />}
            label="Ready"
            value={`${card.readinessPercent}%`}
          />
          <Metric
            icon={<FileText className="size-3" />}
            label="Review"
            value={String(card.documentsInReview)}
          />
          <Metric
            icon={<CircleAlert className="size-3" />}
            label="Client"
            value={String(card.openClientItems)}
          />
        </div>
        <Link
          to="/export"
          onClick={() => selectOffer(card.id)}
          className="flex h-10 items-center justify-center gap-2 rounded-sm bg-primary px-3 text-xs font-bold uppercase tracking-widest text-primary-foreground"
        >
          <FileArchive className="size-4" />
          Generate eOffer Zip
        </Link>
      </div>
    </section>
  );
}

function SinPanel({ card }: { card: OfferWorkspaceCard }) {
  const sinCodes =
    card.selectedSinCodes.length > 0
      ? card.selectedSinCodes.map((code, index) => ({
          code,
          title: index === 0 ? "Selected scope" : "Additional scope",
          confidence: Math.max(58, 96 - index * 12),
        }))
      : SIN_MATCHES.slice(0, 3);

  return (
    <Panel
      title="SIN Recommendation"
      action={
        <Link to="/sin" className="text-[10px] font-bold uppercase tracking-widest text-primary">
          View all
        </Link>
      }
    >
      <div className="divide-y divide-border">
        {sinCodes.map((sin) => (
          <div key={sin.code} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="font-mono text-sm font-bold text-foreground">{sin.code}</div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{sin.title}</div>
            </div>
            <span
              className={`rounded-sm border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                sin.confidence >= 90
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-warning/30 bg-warning/10 text-warning"
              }`}
            >
              {sin.confidence >= 90 ? "Match" : "Watch"}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ProgressPanel({ card }: { card: OfferWorkspaceCard }) {
  return (
    <Panel title="Progress Queue" eyebrow={card.nextAction}>
      <div className="grid gap-2 p-3 md:grid-cols-5 xl:grid-cols-1">
        {WORKFLOW_OVERVIEW.map((item, index) => {
          const status = workflowState(card, index);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.route}
              onClick={() => selectOffer(card.id)}
              className="flex items-center gap-3 rounded-sm border border-border bg-surface px-3 py-2.5 transition hover:border-primary/40 hover:bg-card"
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-sm ${
                  status === "complete"
                    ? "bg-success/10 text-success"
                    : status === "active"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {item.label}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {item.detail}
                </span>
              </span>
              <WorkflowStatePill state={status} />
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}

function WorkspaceQueuePanel({
  activeCard,
  workspaces,
  onSelectWorkspace,
}: {
  activeCard: OfferWorkspaceCard;
  workspaces: OfferWorkspaceCard[];
  onSelectWorkspace: (id: string) => void;
}) {
  return (
    <Panel title="Workspace Queue" eyebrow={`${workspaces.length} active`}>
      <div className="divide-y divide-border">
        {workspaces.slice(0, 4).map((workspace) => {
          const active = workspace.id === activeCard.id;
          return (
            <button
              key={workspace.id}
              type="button"
              onClick={() => onSelectWorkspace(workspace.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface ${
                active ? "bg-primary/5" : ""
              }`}
            >
              <span
                className={`size-2 shrink-0 rounded-full ${active ? "bg-primary" : "bg-muted"}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {workspace.organizationName}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {workspace.name}
                </span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function workflowState(card: OfferWorkspaceCard, index: number): "complete" | "active" | "queued" {
  if (index === 0) return "active";
  if (index === 1) {
    if (card.stageOrder > OFFER_STAGE_META.readiness.order || card.readinessPercent >= 100)
      return "complete";
    return card.stage === "intake" || card.stage === "readiness" ? "active" : "queued";
  }
  if (index === 2) {
    if (card.stageOrder > OFFER_STAGE_META.automation.order) return "complete";
    return card.stage === "automation" ? "active" : "queued";
  }
  if (index === 3) {
    if (card.stageOrder > OFFER_STAGE_META.review.order) return "complete";
    return card.documentsInReview > 0 || card.stage === "review" ? "active" : "queued";
  }
  if (card.stage === "review" || card.stage === "submission") return "active";
  if (
    card.stage === "post_submission" ||
    card.status === "submitted" ||
    card.status === "awarded"
  ) {
    return "complete";
  }
  return "queued";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "ok") {
    return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />;
  }
  if (status === "gap") {
    return <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />;
  }
  return <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
}

function MatrixStatus({ status }: { status: string }) {
  const label =
    status === "valid"
      ? "Valid"
      : status === "review"
        ? "Review"
        : status === "missing"
          ? "Missing"
          : "N/A";
  const tone =
    status === "valid"
      ? "border-success/30 bg-success/10 text-success"
      : status === "missing"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : status === "review"
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`rounded-sm border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${tone}`}
    >
      {label}
    </span>
  );
}

function WorkflowStatePill({ state }: { state: "complete" | "active" | "queued" }) {
  const label = state === "complete" ? "Done" : state === "active" ? "Active" : "Draft";
  const tone =
    state === "complete"
      ? "bg-success/10 text-success"
      : state === "active"
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={`rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${tone}`}
    >
      {label}
    </span>
  );
}

function CreateWorkspaceForm({
  busy,
  error,
  organizationError,
  organizationsLoading,
  organizations,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  organizationError: string | null;
  organizationsLoading: boolean;
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
      className="rounded-sm border border-border bg-card p-4"
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
            onChange={(event) =>
              setOrganizationId(event.target.value === "new" ? null : event.target.value)
            }
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
      {organizationError ? (
        <div role="alert" className="mt-3 text-sm text-destructive">
          Could not load existing organizations. Try again before creating a workspace.{" "}
          {organizationError}
        </div>
      ) : null}
      {organizationsLoading ? (
        <div role="status" className="mt-3 text-sm text-muted-foreground">
          Loading existing organizations before workspace creation...
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
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
          disabled={busy || organizationsLoading || Boolean(organizationError)}
          className="rounded-sm bg-primary px-3 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
        >
          {busy
            ? "Creating..."
            : organizationsLoading
              ? "Loading organizations..."
              : "Create workspace"}
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
          : "Create the first GSA MAS workspace to start intake, automation, documents, and review."}
      </p>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-sm border border-primary-foreground/10 bg-primary-foreground/5 p-2">
      <div className="flex items-center gap-1 text-[10px] text-primary-foreground/60">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-bold text-primary-foreground">{value}</div>
    </div>
  );
}
