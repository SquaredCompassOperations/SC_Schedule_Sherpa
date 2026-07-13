import type { OfferType } from "./offer-workspace";
import { isGsaMasOfferType } from "./offer-workspace";
import { logActivity } from "./activity-log";
import { pushMessage } from "./messages-store";

export type AutomationActionId =
  | "market-validation"
  | "agent-authorization"
  | "pricing-workbook"
  | "client-update";

export type AutomationActionStatus = "enabled" | "selected" | "off" | "complete";

export type AutomationAction = {
  id: AutomationActionId;
  title: string;
  status: AutomationActionStatus;
  description: string;
  output: string;
  source: string;
  estimatedCost: string;
};

export type BuildAutomationActionsInput = {
  offerType: OfferType;
  marketRows: number;
  pricingRows: number;
  hasAgentAuthorizationDraft: boolean;
};

const GSA_AGENT_AUTHORIZATION_SOURCE = "GSA7000 (Rev. 03/2024)";

export function buildAutomationActions(input: BuildAutomationActionsInput): AutomationAction[] {
  const gsaMas = isGsaMasOfferType(input.offerType);
  return [
    {
      id: "market-validation",
      title: "Market Validation Scan",
      status: !gsaMas ? "off" : input.marketRows > 0 ? "complete" : "enabled",
      description: gsaMas
        ? "Runs controlled web search and crawl tasks for selected SIN and LCAT pricing."
        : "GSA MAS market validation is disabled for this solicitation type.",
      output: "Market Validation Spreadsheet",
      source: gsaMas ? "GSA eLibrary and GSA Advantage" : "Solicitation packet",
      estimatedCost: "$0.10",
    },
    {
      id: "agent-authorization",
      title: "Agent Authorization Letter",
      status: !gsaMas ? "off" : input.hasAgentAuthorizationDraft ? "complete" : "enabled",
      description: gsaMas
        ? "Builds GSA Form 7000 letter from intake and authorized-agent details."
        : "GSA Form 7000 is only applicable to GSA MAS offers.",
      output: "Agent Authorization Letter",
      source: GSA_AGENT_AUTHORIZATION_SOURCE,
      estimatedCost: "$0.02",
    },
    {
      id: "pricing-workbook",
      title: "Pricing Workbook Build",
      status: input.pricingRows > 0 ? "complete" : "enabled",
      description: "Generates workbook artifacts from structured pricing and packet inputs.",
      output: "Pricing Terms Workbook",
      source: gsaMas ? "GSA price templates" : "Solicitation packet forms",
      estimatedCost: "$0.04",
    },
    {
      id: "client-update",
      title: "Client Update",
      status: "enabled",
      description: "Send a request to a client for a document, information, or status.",
      output: "Client-visible update",
      source: "Client main contact",
      estimatedCost: "$0.00",
    },
  ];
}

export function sendClientUpdateRequest(input: {
  subject: string;
  body: string;
  contactEmail?: string | null;
}) {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) throw new Error("Client update subject is required");
  if (!body) throw new Error("Client update message is required");

  pushMessage({
    kind: "request",
    title: subject,
    body,
    href: "/client/messages",
  });
  logActivity({
    module: "Client Update",
    action: `requested ${subject}`,
    target: input.contactEmail?.trim() || undefined,
    clientVisible: true,
  });
}

export function getAgentAuthorizationDraftText(input: {
  legalName?: string;
  authorizedAgent?: string;
  contactEmail?: string;
}) {
  return [
    "Agent Authorization Letter",
    "",
    `Offeror: ${input.legalName || "[Offeror legal name]"}`,
    `Authorized Agent: ${input.authorizedAgent || "[Authorized agent]"}`,
    `Contact Email: ${input.contactEmail || "[Contact email]"}`,
    "",
    "Source: GSA Form GSA7000, current revision 03/2024.",
  ].join("\n");
}
