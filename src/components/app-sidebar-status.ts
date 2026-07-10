import type { ModuleStatus } from "@/lib/mock-data";

export type WorkflowTone = "active" | "ready" | "watch";

export function workflowDotClass(tone: WorkflowTone, active: boolean, status?: ModuleStatus) {
  if (status === "complete") return "bg-success";
  if (status === "blocked") return "bg-destructive";
  if (active) return "bg-primary";
  if (tone === "ready") return "bg-success";
  if (tone === "watch") return "bg-warning";
  return "border border-border bg-card";
}
