import { afterEach, describe, expect, it } from "vitest";
import { getActivityLog, resetActivityLog } from "./activity-log";
import { getMessages, resetMessages } from "./messages-store";
import { buildAutomationActions, sendClientUpdateRequest } from "./automation-workspace";

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
