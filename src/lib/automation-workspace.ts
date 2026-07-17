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
  lockedOff?: boolean;
  description: string;
  output: string;
  source: string;
  estimatedCost: string;
};

export type AutomationActionCommand = {
  label: string;
  href?: "/pricing-workbook";
  disabled: boolean;
  disabledReason?: string;
};

export type AutomationActionCardCommand = {
  label: string;
  disabled: boolean;
  runnable: boolean;
  disabledReason?: string;
};

export type BuildAutomationActionsInput = {
  offerType: OfferType;
  marketRows: number;
  pricingRows: number;
  hasAgentAuthorizationDraft: boolean;
  disabledActionIds?: AutomationActionId[];
};

const GSA_AGENT_AUTHORIZATION_SOURCE = "GSA7000-24 (Rev. 03/2024)";

export function buildAutomationActions(input: BuildAutomationActionsInput): AutomationAction[] {
  const gsaMas = isGsaMasOfferType(input.offerType);
  const disabledActionIds = new Set(input.disabledActionIds ?? []);
  const applyControls = (
    action: Omit<AutomationAction, "lockedOff">,
    options: { lockedOff?: boolean } = {},
  ): AutomationAction => {
    if (options.lockedOff || action.status === "off") {
      return { ...action, status: "off", lockedOff: true };
    }
    if (disabledActionIds.has(action.id)) {
      return { ...action, status: "off", lockedOff: false };
    }
    return { ...action, lockedOff: false };
  };

  return [
    applyControls(
      {
        id: "market-validation",
        title: "Market Validation Scan",
        status: input.marketRows > 0 ? "complete" : "enabled",
        description: gsaMas
          ? "Runs controlled web search and crawl tasks for selected SIN and LCAT pricing."
          : "GSA MAS market validation is disabled for this solicitation type.",
        output: "Market Validation Spreadsheet",
        source: gsaMas ? "GSA eLibrary and GSA Advantage" : "Solicitation packet",
        estimatedCost: "$0.10",
      },
      { lockedOff: !gsaMas },
    ),
    applyControls(
      {
        id: "agent-authorization",
        title: "Agent Authorization Letter",
        status: input.hasAgentAuthorizationDraft ? "complete" : "enabled",
        description: gsaMas
          ? "Builds GSA Form 7000 letter from intake and authorized-agent details."
          : "GSA Form 7000 is only applicable to GSA MAS offers.",
        output: "Agent Authorization Letter",
        source: GSA_AGENT_AUTHORIZATION_SOURCE,
        estimatedCost: "$0.02",
      },
      { lockedOff: !gsaMas },
    ),
    applyControls({
      id: "pricing-workbook",
      title: "Pricing Workbook Build",
      status: input.pricingRows > 0 ? "complete" : "enabled",
      description: "Generates workbook artifacts from structured pricing and packet inputs.",
      output: "Pricing Terms Workbook",
      source: gsaMas ? "GSA price templates" : "Solicitation packet forms",
      estimatedCost: "$0.04",
    }),
    applyControls({
      id: "client-update",
      title: "Client Update",
      status: "enabled",
      description: "Send a request to a client for a document, information, or status.",
      output: "Client-visible update",
      source: "Client main contact",
      estimatedCost: "$0.00",
    }),
  ];
}

export function getAutomationActionCommand(action: AutomationAction): AutomationActionCommand {
  const disabled = action.status === "off";
  const disabledReason = disabled
    ? action.lockedOff
      ? "This workflow is not applicable to the selected solicitation type."
      : "This workflow is disabled in Controls."
    : undefined;

  const commands: Record<AutomationActionId, Omit<AutomationActionCommand, "disabledReason">> = {
    "market-validation": {
      label: "Run Market Validation Workflow",
      disabled,
    },
    "agent-authorization": {
      label: "Build Agent Authorization Letter",
      disabled,
    },
    "pricing-workbook": {
      label: "Open Pricing Workbook Build",
      href: "/pricing-workbook",
      disabled,
    },
    "client-update": {
      label: "Send Client Update",
      disabled,
    },
  };

  return { ...commands[action.id], disabledReason };
}

export function getAutomationActionCardCommand(
  action: AutomationAction,
): AutomationActionCardCommand {
  const command = getAutomationActionCommand(action);
  const labels: Record<AutomationActionId, string> = {
    "market-validation": "Open",
    "agent-authorization": "Build",
    "pricing-workbook": "Open",
    "client-update": "Open",
  };
  return {
    label: labels[action.id],
    disabled: command.disabled,
    disabledReason: command.disabledReason,
    runnable: action.id === "agent-authorization",
  };
}

export function isActionControlChecked(action: AutomationAction): boolean {
  return action.status !== "off";
}

export function isActionControlDisabled(action: AutomationAction): boolean {
  return Boolean(action.lockedOff);
}

export function toggleDisabledAction(
  disabledActionIds: AutomationActionId[],
  action: AutomationAction,
): AutomationActionId[] {
  if (action.lockedOff) return disabledActionIds;
  if (disabledActionIds.includes(action.id)) {
    return disabledActionIds.filter((id) => id !== action.id);
  }
  return [...disabledActionIds, action.id];
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
  const today = new Date().toISOString().slice(0, 10);
  return [
    "Agent Authorization Letter",
    "",
    `Date: ${today}`,
    "",
    "Offeror Authorization",
    `Offeror: ${input.legalName || "[Offeror legal name]"}`,
    `Authorized Agent: ${input.authorizedAgent || "[Authorized agent]"}`,
    `Contact Email: ${input.contactEmail || "[Contact email]"}`,
    "",
    "The undersigned offeror authorizes the named agent to act on behalf of the company in connection with the preparation, submission, and administration of the GSA MAS offer package, including receipt of correspondence and coordination of supporting documents as permitted by the solicitation and applicable regulations.",
    "",
    "This authorization remains in effect until modified or revoked in writing by the offeror.",
    "",
    "Signature Block",
    "Offeror Representative: ________________________________",
    "Title: ________________________________________________",
    "Authorized Agent: _____________________________________",
    "Accepted By: _________________________________________",
    "",
    "Source: GSA Form GSA7000-24, current revision 03/2024.",
  ].join("\n");
}
