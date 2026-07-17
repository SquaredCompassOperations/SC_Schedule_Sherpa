import { afterEach, describe, expect, it } from "vitest";
import { getActivityLog, resetActivityLog } from "./activity-log";
import { getMessages, resetMessages } from "./messages-store";
import {
  buildAutomationActions,
  getAutomationActionCardCommand,
  getAutomationActionCommand,
  getAgentAuthorizationDraftText,
  sendClientUpdateRequest,
} from "./automation-workspace";

describe("automation workspace actions", () => {
  it("exposes the requested four action cards in order", () => {
    expect(
      buildAutomationActions({
        offerType: "gsa_mas",
        marketRows: 0,
        pricingRows: 0,
        hasAgentAuthorizationDraft: false,
      }).map((action) => action.title),
    ).toEqual([
      "Market Validation Scan",
      "Agent Authorization Letter",
      "Pricing Workbook Build",
      "Client Update",
    ]);
  });

  it("disables MAS-specific actions for non-GSA offers", () => {
    const actions = buildAutomationActions({
      offerType: "va_fss",
      marketRows: 0,
      pricingRows: 0,
      hasAgentAuthorizationDraft: false,
    });

    expect(actions.find((action) => action.id === "market-validation")?.status).toBe("off");
    expect(actions.find((action) => action.id === "agent-authorization")?.status).toBe("off");
  });

  it("lets controls turn off an otherwise available workflow", () => {
    const actions = buildAutomationActions({
      offerType: "gsa_mas",
      marketRows: 0,
      pricingRows: 0,
      hasAgentAuthorizationDraft: false,
      disabledActionIds: ["pricing-workbook"],
    });

    expect(actions.find((action) => action.id === "pricing-workbook")).toMatchObject({
      status: "off",
      lockedOff: false,
    });
    expect(actions.find((action) => action.id === "market-validation")?.status).toBe("enabled");
  });

  it("locks non-applicable workflows off instead of treating them as control toggles", () => {
    const actions = buildAutomationActions({
      offerType: "va_fss",
      marketRows: 0,
      pricingRows: 0,
      hasAgentAuthorizationDraft: false,
      disabledActionIds: [],
    });

    expect(actions.find((action) => action.id === "market-validation")).toMatchObject({
      status: "off",
      lockedOff: true,
    });
  });

  it("returns the bottom-panel command for a selected workspace", () => {
    const actions = buildAutomationActions({
      offerType: "gsa_mas",
      marketRows: 0,
      pricingRows: 0,
      hasAgentAuthorizationDraft: false,
    });

    expect(
      getAutomationActionCommand(actions.find((action) => action.id === "market-validation")!),
    ).toMatchObject({
      label: "Run Market Validation Workflow",
      disabled: false,
    });
    expect(
      getAutomationActionCommand(actions.find((action) => action.id === "pricing-workbook")!),
    ).toMatchObject({
      label: "Open Pricing Workbook Build",
      href: "/pricing-workbook",
      disabled: false,
    });
  });

  it("shows agent authorization as a runnable card action", () => {
    const actions = buildAutomationActions({
      offerType: "gsa_mas",
      marketRows: 0,
      pricingRows: 0,
      hasAgentAuthorizationDraft: false,
    });

    expect(
      getAutomationActionCardCommand(
        actions.find((action) => action.id === "agent-authorization")!,
      ),
    ).toMatchObject({
      label: "Build",
      disabled: false,
      runnable: true,
    });
  });

  it("builds a fuller agent authorization draft", () => {
    const draft = getAgentAuthorizationDraftText({
      legalName: "Squared Compass LLC",
      authorizedAgent: "Jordan Smith",
      contactEmail: "jordan@squaredcompass.com",
    });

    expect(draft).toContain("Agent Authorization Letter");
    expect(draft).toContain("Squared Compass LLC");
    expect(draft).toContain("Jordan Smith");
    expect(draft).toContain("jordan@squaredcompass.com");
    expect(draft).toContain("Offeror Authorization");
    expect(draft).toContain("GSA Form GSA7000-24");
  });
});

describe("sendClientUpdateRequest", () => {
  afterEach(() => {
    resetMessages();
    resetActivityLog();
  });

  it("creates a client-visible message and activity entry", () => {
    sendClientUpdateRequest({
      subject: "Need updated pricing",
      body: "Please upload the revised commercial price list.",
      contactEmail: "client@example.com",
    });

    expect(getMessages()[0]).toMatchObject({
      kind: "request",
      title: "Need updated pricing",
      body: "Please upload the revised commercial price list.",
      href: "/client/messages",
    });
    expect(getActivityLog()[0]).toMatchObject({
      module: "Client Update",
      action: "requested Need updated pricing",
      target: "client@example.com",
      clientVisible: true,
    });
  });
});
