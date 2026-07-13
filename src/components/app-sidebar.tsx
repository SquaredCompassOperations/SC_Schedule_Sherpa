import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  FileArchive,
  FileText,
  FolderKanban,
  ClipboardList,
} from "lucide-react";
import type { ComponentType } from "react";
import { useModuleStatuses } from "@/lib/module-status-store";
import { listOfferWorkspaces } from "@/lib/offer-workspace.functions";
import { offerWorkspaceQueryKeys } from "@/lib/offer-workspace-query";
import { selectOffer, useSelectedOfferId } from "@/lib/offer-workspace";
import { useAuth } from "@/lib/auth-context";
import { buildActiveClientOptions } from "./app-sidebar-options";
import { workflowDotClass, type WorkflowTone } from "./app-sidebar-status";

type WorkflowItem = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  activePaths: string[];
  tone: WorkflowTone;
  statusSlug?: string;
};

const workflowItems: WorkflowItem[] = [
  {
    label: "Workspace",
    to: "/",
    icon: FolderKanban,
    activePaths: ["/", "/status", "/status/milestones", "/status/open-items", "/status/activity"],
    tone: "active",
    statusSlug: "/status",
  },
  {
    label: "Intake",
    to: "/intake",
    icon: ClipboardList,
    activePaths: ["/intake", "/readiness", "/sin"],
    tone: "ready",
    statusSlug: "/intake",
  },
  {
    label: "Automation",
    to: "/market-validation",
    icon: Bot,
    activePaths: ["/market-validation", "/sca", "/pricing-workbook"],
    tone: "watch",
    statusSlug: "/market-validation",
  },
  {
    label: "Documents",
    to: "/documents",
    icon: FileText,
    activePaths: ["/documents"],
    tone: "watch",
    statusSlug: "/documents",
  },
  {
    label: "Review",
    to: "/review",
    icon: CheckCircle2,
    activePaths: ["/review", "/export", "/submission"],
    tone: "watch",
    statusSlug: "/review",
  },
  {
    label: "Submission",
    to: "/submission",
    icon: FileArchive,
    activePaths: ["/submission", "/export"],
    tone: "watch",
    statusSlug: "/submission",
  },
];

function isActive(pathname: string, item: WorkflowItem) {
  return item.activePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const moduleStatuses = useModuleStatuses();
  const selectedOfferId = useSelectedOfferId();
  const { user } = useAuth();
  const workspaces = useQuery({
    queryKey: offerWorkspaceQueryKeys.list(user?.id ?? "anonymous"),
    queryFn: () => listOfferWorkspaces(),
    enabled: Boolean(user?.id),
  });
  const activeClientOptions = buildActiveClientOptions(workspaces.data ?? []);

  return (
    <aside className="sticky top-14 h-[calc(100vh-3.5rem)] w-40 shrink-0 border-r border-border bg-sidebar">
      <nav aria-label="Workflow" className="flex h-full flex-col gap-2 px-3 py-5">
        <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Workflow
        </div>
        <div className="flex flex-col gap-1">
          {workflowItems.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            const status = item.statusSlug ? moduleStatuses[item.statusSlug] : undefined;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`group flex h-9 items-center gap-2 rounded-sm border px-2 text-xs font-semibold transition ${
                  active
                    ? "border-border bg-card text-foreground shadow-sm"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
                }`}
              >
                <span
                  className={`size-1.5 shrink-0 rounded-full ${workflowDotClass(
                    item.tone,
                    active,
                    status,
                  )}`}
                />
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="mt-auto border-t border-border pt-3">
          <label className="block">
            <span className="block pb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Active Client
            </span>
            <select
              value={selectedOfferId ?? ""}
              onChange={(event) => {
                const option = activeClientOptions.find((item) => item.id === event.target.value);
                if (option) selectOffer(option.id, option.offerType);
              }}
              disabled={activeClientOptions.length === 0}
              className="h-8 w-full rounded-sm border border-border bg-card px-2 text-[11px] font-semibold text-foreground disabled:text-muted-foreground"
            >
              <option value="">
                {activeClientOptions.length === 0 ? "No active clients" : "Select client"}
              </option>
              {activeClientOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </nav>
    </aside>
  );
}
