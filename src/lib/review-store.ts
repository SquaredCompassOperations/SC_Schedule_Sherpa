// Persistent review-gate store. Survives reloads and route changes so users
// don't lose approval state when navigating between gates and other modules.
import { useSyncExternalStore } from "react";
import { REVIEW_GATES } from "./mock-data";
import { loadPersisted, savePersisted } from "./persist";
import { logActivity } from "./activity-log";

const PERSIST_KEY = "review-store";

export type GateStatus = "approved" | "in_review" | "changes_requested" | "pending";
export type Comment = { id: string; author: string; text: string; ts: number };
export type Gate = {
  stage: string;
  owner: string;
  reviewer: string;
  status: GateStatus;
  approvedAt: number | null;
  approvedBy: string | null;
  comments: Comment[];
  deliverables: string[];
};

// Deliverable keys are either DOCUMENT_QUEUE `kind` values, the synthetic
// "pricing-workbook" key (status derived from automation-store), or a pipe-
// separated alternates expression ("a|b") meaning either suffices.
export const GATE_DELIVERABLES: Record<string, string[]> = {
  "Intake QA": ["capability-statement"],
  "SIN Mapping Review": [],
  "Pricing Review": [
    "epa-narrative",
    "compensation-plan",
    "uncompensated-overtime",
    "pricing-workbook",
  ],
  "Compliance Matrix Sign-off": [
    "corporate-experience",
    "quality-control",
    "relevant-project|startup-springboard",
  ],
  "Authorized Negotiator Certify": [],
};

export type DeliverableSignOff = {
  deliverable: string;
  signerName: string;
  signerEmail: string;
  signerTitle: string;
  signedAt: number;
};

type State = {
  gates: Gate[];
  certifyName: string;
  certifyTitle: string;
  certifyAck: boolean;
  /** Sign-offs collected from Authorized Negotiators per deliverable. */
  signOffs: DeliverableSignOff[];
};

const seed = (): State => ({
  gates: REVIEW_GATES.map((g) => ({
    stage: g.stage,
    owner: g.owner,
    reviewer: g.owner,
    status: g.status as GateStatus,
    approvedAt: g.status === "approved" ? Date.now() - 86_400_000 : null,
    approvedBy: g.status === "approved" ? g.owner : null,
    comments: [],
    deliverables: GATE_DELIVERABLES[g.stage] ?? [],
  })),
  certifyName: "",
  certifyTitle: "Authorized Negotiator",
  certifyAck: false,
  signOffs: [],
});

const migrate = (s: State): State => ({
  ...s,
  signOffs: s.signOffs ?? [],
  gates: s.gates.map((g) => ({
    ...g,
    deliverables: GATE_DELIVERABLES[g.stage] ?? g.deliverables ?? [],
  })),
});

let state: State = migrate(loadPersisted<State>(PERSIST_KEY, seed()));

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const emit = () => {
  savePersisted(PERSIST_KEY, state);
  listeners.forEach((l) => l());
};

export const getReview = () => state;
export const useReview = () => useSyncExternalStore(subscribe, getReview, getReview);

export function patchGate(index: number, patch: Partial<Gate>) {
  state = {
    ...state,
    gates: state.gates.map((g, i) => (i === index ? { ...g, ...patch } : g)),
  };
  emit();
}

export function setCertify(
  patch: Partial<{ certifyName: string; certifyTitle: string; certifyAck: boolean }>,
) {
  state = { ...state, ...patch };
  emit();
}

export function addSignOff(s: DeliverableSignOff) {
  // One sign-off per deliverable+signer pair (replace existing).
  const filtered = state.signOffs.filter(
    (x) => !(x.deliverable === s.deliverable && x.signerEmail.toLowerCase() === s.signerEmail.toLowerCase()),
  );
  state = { ...state, signOffs: [...filtered, s] };
  logActivity({
    module: "Review & Sign-Off",
    action: `signed off by ${s.signerName} (${s.signerTitle})`,
    target: s.deliverable,
    actor: s.signerName,
    clientVisible: true,
  });
  emit();
}

export function removeSignOff(deliverable: string, signerEmail: string) {
  state = {
    ...state,
    signOffs: state.signOffs.filter(
      (x) => !(x.deliverable === deliverable && x.signerEmail.toLowerCase() === signerEmail.toLowerCase()),
    ),
  };
  logActivity({ module: "Review & Sign-Off", action: "revoked sign-off", target: deliverable, actor: signerEmail });
  emit();
}

export function resetReview() {
  state = seed();
  emit();
}
