import { Link, useRouterState } from "@tanstack/react-router";
import { Bot, CheckCircle2, FileText, FolderKanban, ClipboardList } from "lucide-react";
import type { ComponentType } from "react";
import { useModuleStatuses } from "@/lib/module-status-store";
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
];

function isActive(pathname: string, item: WorkflowItem) {
  return item.activePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const moduleStatuses = useModuleStatuses();

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
      </nav>
    </aside>
  );
}
