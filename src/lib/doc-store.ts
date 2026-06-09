// Shared document store. Lives outside React so both /documents and
// /compliance can subscribe and stay in sync without a router-level provider.
// Persisted to localStorage so drafts survive reloads/tab close.
import { useSyncExternalStore } from "react";
import { DOCUMENT_QUEUE } from "./mock-data";
import { loadPersisted, savePersisted } from "./persist";

const PERSIST_KEY = "doc-store";

export type DocStatus = "draft" | "review" | "final";
export type EpaMechanism = "commercial-price-list" | "market-indicator" | "fixed-ceiling";
export type DocState = {
  text: string;
  status: DocStatus;
  savedAt: number | null;
  dirty: boolean;
  na?: boolean;
  epaMechanism?: EpaMechanism;
};




type Store = Record<string, DocState>;

const defaultStore = (): Store =>
  Object.fromEntries(
    DOCUMENT_QUEUE.map((d) => [
      d.name,
      { text: "", status: d.status as DocStatus, savedAt: null, dirty: false },
    ]),
  );

let store: Store = { ...defaultStore(), ...loadPersisted<Store>(PERSIST_KEY, {}) };

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const emit = () => {
  savePersisted(PERSIST_KEY, store);
  listeners.forEach((l) => l());
};

export function patchDoc(name: string, patch: Partial<DocState>) {
  if (!store[name]) return;
  store = { ...store, [name]: { ...store[name], ...patch } };
  emit();
}

export function resetDocStore() {
  store = defaultStore();
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
  "I-FSS-969": "epa-narrative",
};

