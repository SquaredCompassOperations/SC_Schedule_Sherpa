// Persistent review-gate store. Survives reloads and route changes so users
// don't lose approval state when bouncing between gates and other modules.
import { useSyncExternalStore } from "react";
import { REVIEW_GATES, DOCUMENT_QUEUE } from "./mock-data";
import { loadPersisted, savePersisted } from "./persist";

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

const GATE_DELIVERABLES: Record<string, string[]> = {
  "Intake QA": ["capability-statement"],
  "SIN Mapping Review": ["corporate-experience"],
  "Pricing Review": ["compensation-plan", "uncompensated-overtime"],
  "Compliance Matrix Sign-off": ["quality-control", "epa-narrative"],
  "Authorized Negotiator Certify": [],
};

const seed = (): { gates: Gate[]; certifyName: string; certifyTitle: string; certifyAck: boolean } => ({
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
});

let state = loadPersisted<ReturnType<typeof seed>>(PERSIST_KEY, seed());

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

export function setCertify(patch: Partial<{ certifyName: string; certifyTitle: string; certifyAck: boolean }>) {
  state = { ...state, ...patch };
  emit();
}

export function resetReview() {
  state = seed();
  emit();
}

// Keep DOCUMENT_QUEUE referenced to avoid unused import in some builds
export const _docs = DOCUMENT_QUEUE;
