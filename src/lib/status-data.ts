// Derives Status Tracker data from existing stores + readiness rollup.
// Pure view-layer: no business logic, no persistence.

import { useReadinessRollup, type ModuleReadiness } from "./readiness-rollup";
import { useIntake } from "./intake-store";
import { useAutomation } from "./automation-store";
import { useDocStore } from "./doc-store";
import { CLIENT, DOCUMENT_QUEUE } from "./mock-data";

export type StageId = "intake" | "engine" | "review" | "submission";
export type Stage = {
  id: StageId;
  label: string;
  status: "complete" | "active" | "pending";
  description: string;
};

export type Milestone = {
  id: string;
  label: string;
  date: string;
  status: "done" | "current" | "upcoming";
  detail: string;
};

export type OpenItem = {
  id: string;
  title: string;
  module: string;
  owner: "Team" | "Client";
  severity: "low" | "med" | "high";
};

export type ActivityEntry = {
  id: string;
  ts: string;
  module: string;
  message: string;
  clientVisible: boolean;
};

export function useStatus() {
  const rollup = useReadinessRollup();
  const intake = useIntake();
  const automation = useAutomation();
  const docs = useDocStore();

  // Stage derivation
  const intakeComplete = !!(intake.corporate.legalName && intake.corporate.uei);
  const engineActive =
    automation.selectedSins.length > 0 || automation.selectedLcats.length > 0;
  const docsActive = Object.values(docs).some((d) => d?.status === "review" || d?.status === "final");
  const exportReady = rollup.exportReady;

  const stages: Stage[] = [
    {
      id: "intake",
      label: "Intake & Readiness",
      status: intakeComplete ? "complete" : "active",
      description: intakeComplete
        ? "Corporate profile captured"
        : "Collecting corporate profile",
    },
    {
      id: "engine",
      label: "Automation Engine",
      status: !intakeComplete ? "pending" : engineActive ? "active" : "active",
      description: engineActive
        ? `${automation.selectedSins.length} SIN${automation.selectedSins.length === 1 ? "" : "s"} · ${automation.selectedLcats.length} LCAT${automation.selectedLcats.length === 1 ? "" : "s"} selected`
        : "Awaiting SIN selection",
    },
    {
      id: "review",
      label: "Review & QA",
      status: docsActive ? "active" : "pending",
      description: docsActive ? "Documents in review" : "Awaiting upstream gates",
    },
    {
      id: "submission",
      label: "eOffer Submission",
      status: exportReady ? "active" : "pending",
      description: exportReady ? "Package ready to build" : "Blocked by upstream gaps",
    },
  ];

  const currentStage = stages.find((s) => s.status === "active") ?? stages[0];

  // Milestones — synthesized from module status + readiness
  const today = new Date();
  const offset = (d: number) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + d);
    return dt.toISOString().slice(0, 10);
  };

  const milestones: Milestone[] = [
    {
      id: "kickoff",
      label: "Engagement Kickoff",
      date: offset(-21),
      status: "done",
      detail: `${CLIENT.name} onboarded`,
    },
    {
      id: "intake-done",
      label: "Intake Complete",
      date: offset(-14),
      status: intakeComplete ? "done" : "current",
      detail: intakeComplete ? "Corporate profile locked" : "Profile in progress",
    },
    {
      id: "sin-lock",
      label: "SIN Selection Locked",
      date: offset(-7),
      status: automation.selectedSins.length > 0 ? "done" : "current",
      detail:
        automation.selectedSins.length > 0
          ? automation.selectedSins.map((s) => s.code).join(", ")
          : "Pending recommendation review",
    },
    {
      id: "doc-review",
      label: "Document Review",
      date: offset(7),
      status: docsActive ? "current" : "upcoming",
      detail: `${DOCUMENT_QUEUE.length} narratives in queue`,
    },
    {
      id: "submission",
      label: "eOffer Submission",
      date: offset(21),
      status: exportReady ? "current" : "upcoming",
      detail: "Package upload to GSA eOffer portal",
    },
  ];

  // Open items — derived from module blockers
  const openItems: OpenItem[] = [];
  rollup.modules.forEach((m: ModuleReadiness) => {
    m.blockers.forEach((b, i) => {
      openItems.push({
        id: `${m.slug}-${i}`,
        title: b,
        module: m.label,
        owner: m.slug === "/intake" ? "Client" : "Team",
        severity: m.state === "blocked" ? "high" : "med",
      });
    });
  });

  // Activity log — synthesized from current state snapshots
  const activity: ActivityEntry[] = [
    {
      id: "a1",
      ts: offset(0),
      module: "Status",
      message: `Composite readiness updated to ${rollup.composite}%`,
      clientVisible: true,
    },
    ...(automation.selectedSins.length > 0
      ? [
          {
            id: "a-sin",
            ts: offset(-2),
            module: "SIN Recommendation",
            message: `Selected SINs: ${automation.selectedSins.map((s) => s.code).join(", ")}`,
            clientVisible: true,
          },
        ]
      : []),
    ...(automation.selectedLcats.length > 0
      ? [
          {
            id: "a-lcat",
            ts: offset(-1),
            module: "SCA Matrix",
            message: `${automation.selectedLcats.length} labor categor${automation.selectedLcats.length === 1 ? "y" : "ies"} mapped`,
            clientVisible: false,
          },
        ]
      : []),
    ...Object.entries(docs)
      .filter(([, d]) => d?.status === "final" || d?.status === "review")
      .slice(0, 5)
      .map(([name, d], i) => ({
        id: `a-doc-${i}`,
        ts: offset(-3 - i),
        module: "Documentation",
        message: `${name} marked ${d?.status}`,
        clientVisible: true,
      })),
    {
      id: "a-kickoff",
      ts: offset(-21),
      module: "Engagement",
      message: "Engagement kicked off",
      clientVisible: true,
    },
  ];

  return {
    composite: rollup.composite,
    stages,
    currentStage,
    milestones,
    openItems,
    activity,
    rollup,
  };
}
