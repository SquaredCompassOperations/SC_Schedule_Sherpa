// Shared in-memory document store. Lives outside React so both /documents and
// /compliance can subscribe and stay in sync without a router-level provider.
import { useSyncExternalStore } from "react";
import { DOCUMENT_QUEUE } from "./mock-data";

export type DocStatus = "draft" | "review" | "final";
export type DocState = {
  text: string;
  status: DocStatus;
  savedAt: number | null;
  dirty: boolean;
};

type Store = Record<string, DocState>;

let store: Store = Object.fromEntries(
  DOCUMENT_QUEUE.map((d) => [
    d.name,
    { text: "", status: d.status as DocStatus, savedAt: null, dirty: false },
  ]),
);

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const emit = () => listeners.forEach((l) => l());

export function patchDoc(name: string, patch: Partial<DocState>) {
  if (!store[name]) return;
  store = { ...store, [name]: { ...store[name], ...patch } };
  emit();
}

export function getDocStore(): Store {
  return store;
}

export function useDocStore(): Store {
  return useSyncExternalStore(subscribe, getDocStore, getDocStore);
}

// Map from a compliance row's solicitation reference → document kind in DOCUMENT_QUEUE.
// Status of the linked doc derives compliance status (final=valid, review=review, draft=missing).
export const COMPLIANCE_DOC_LINKS: Record<string, string> = {
  "SCP-FSS-001": "corporate-experience",
  "FAR 52.222-46": "compensation-plan",
  "FAR 52.237-10": "uncompensated-overtime",
  "GSAR 552.216-70": "epa-narrative",
  "FAR 31.201-2": "accounting-controls",
};
