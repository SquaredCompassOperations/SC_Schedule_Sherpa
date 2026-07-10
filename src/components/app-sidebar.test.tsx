import { describe, expect, it } from "vitest";
import { workflowDotClass } from "./app-sidebar-status";

describe("workflow sidebar dot", () => {
  it("shows completed modules as green even when the route is active", () => {
    expect(workflowDotClass("ready", true, "complete")).toContain("bg-success");
    expect(workflowDotClass("ready", true, "complete")).not.toContain("bg-primary");
  });

  it("keeps active incomplete modules primary", () => {
    expect(workflowDotClass("ready", true, "in_progress")).toContain("bg-primary");
  });
});
