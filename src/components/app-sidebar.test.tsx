import { describe, expect, it } from "vitest";
import { buildActiveClientOptions } from "./app-sidebar-options";
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

describe("active client selector options", () => {
  it("uses real workspace cards instead of a static default client", () => {
    const options = buildActiveClientOptions([
      {
        id: "offer-1",
        organizationName: "Lawton Management LLC",
        name: "Squared Compass MAS Offer",
        offerType: "gsa_mas",
        offerTypeLabel: "GSA MAS",
        stage: "intake",
        stageLabel: "Intake",
        stageOrder: 1,
        status: "active",
        readinessPercent: 0,
        documentsInReview: 0,
        openClientItems: 0,
        authorizedNegotiatorStatus: "missing",
        submissionStatus: "not_started",
        solicitationNumber: "47QSMD20R0001",
        selectedSinCodes: [],
        targetSubmissionDate: null,
        updatedAt: "2026-07-13T00:00:00Z",
        nextAction: "Continue Intake",
      },
    ]);

    expect(options).toEqual([
      {
        id: "offer-1",
        label: "Lawton Management LLC",
        detail: "Squared Compass MAS Offer",
        offerType: "gsa_mas",
      },
    ]);
  });
});
