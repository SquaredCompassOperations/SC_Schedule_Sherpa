// Submission Tracker store — captures the eOffer submission receipt,
// post-submission events (CO assignment, clarifications, award), and the
// archive/lock action that snapshots the final package as read-only.
import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "./persist";

const PERSIST_KEY = "submission-state";

export type Receipt = {
  confirmationNumber: string;
  submittedAt: number; // epoch ms
  submittedBy: string;
  portal: string; // e.g. "eOffer.gsa.gov"
  notes: string;
  attachmentName: string | null; // e.g. screenshot filename
};

export type TrackerEventKind =
  | "received"
  | "co_assigned"
  | "clarification_requested"
  | "clarification_responded"
  | "negotiation"
  | "final_proposal_revision"
  | "awarded"
  | "rejected"
  | "withdrawn"
  | "note";

export type TrackerEvent = {
  id: string;
  kind: TrackerEventKind;
  ts: number;
  title: string;
  detail: string;
  actor: string; // "GSA" | "Team" | "Client" | person name
};

export type Archive = {
  archivedAt: number;
  archivedBy: string;
  snapshotName: string; // filename of the locked zip
  notes: string;
};

export type SubmissionState = {
  receipt: Receipt | null;
  events: TrackerEvent[];
  archive: Archive | null;
  locked: boolean; // when true, all upstream modules are read-only
};

const defaultState = (): SubmissionState => ({
  receipt: null,
  events: [],
  archive: null,
  locked: false,
});

let state: SubmissionState = {
  ...defaultState(),
  ...loadPersisted<Partial<SubmissionState>>(PERSIST_KEY, {}),
};

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const emit = () => {
  savePersisted(PERSIST_KEY, state);
  listeners.forEach((l) => l());
};

export function getSubmission(): SubmissionState {
  return state;
}
export function useSubmission(): SubmissionState {
  return useSyncExternalStore(subscribe, getSubmission, getSubmission);
}

export function setReceipt(r: Receipt | null) {
  state = { ...state, receipt: r };
  // Seed an initial "received" event when first capturing a receipt
  if (r && state.events.length === 0) {
    state = {
      ...state,
      events: [
        {
          id: `evt-${Date.now()}`,
          kind: "received",
          ts: r.submittedAt,
          title: `Submission received by ${r.portal}`,
          detail: `Confirmation #${r.confirmationNumber}`,
          actor: "GSA",
        },
      ],
    };
  }
  emit();
}

export function addEvent(e: Omit<TrackerEvent, "id">) {
  const ev: TrackerEvent = { id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...e };
  state = { ...state, events: [ev, ...state.events] };
  emit();
}

export function removeEvent(id: string) {
  state = { ...state, events: state.events.filter((e) => e.id !== id) };
  emit();
}

export function lockArchive(a: Archive) {
  state = { ...state, archive: a, locked: true };
  emit();
}

export function unlockArchive() {
  state = { ...state, locked: false };
  emit();
}

export function resetSubmission() {
  state = defaultState();
  emit();
}

export const EVENT_KIND_META: Record<
  TrackerEventKind,
  { label: string; tone: "success" | "warning" | "info" | "destructive" | "muted" }
> = {
  received: { label: "Submission Received", tone: "info" },
  co_assigned: { label: "CO Assigned", tone: "info" },
  clarification_requested: { label: "Clarification Requested", tone: "warning" },
  clarification_responded: { label: "Clarification Responded", tone: "info" },
  negotiation: { label: "Negotiation", tone: "warning" },
  final_proposal_revision: { label: "Final Proposal Revision", tone: "warning" },
  awarded: { label: "Awarded", tone: "success" },
  rejected: { label: "Rejected", tone: "destructive" },
  withdrawn: { label: "Withdrawn", tone: "muted" },
  note: { label: "Note", tone: "muted" },
};
