import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceBoard } from "@/components/workspace-board";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Workspace Board — Offer Automation Workspace" },
      {
        name: "description",
        content:
          "Active offer workspace board for GSA MAS submissions, client blockers, document reviews, and eOffer progress.",
      },
    ],
  }),
  component: WorkspaceBoard,
});
