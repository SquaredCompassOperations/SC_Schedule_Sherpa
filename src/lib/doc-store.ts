// Shared document store. Lives outside React so both /documents and
// /compliance can subscribe and stay in sync without a router-level provider.
// Persisted to localStorage so drafts survive reloads/tab close.
import { useSyncExternalStore } from "react";
import { DOCUMENT_QUEUE } from "./mock-data";
import { loadPersisted, savePersisted } from "./persist";
import { pushMessage } from "./messages-store";
import { logActivity } from "./activity-log";

const PERSIST_KEY = "doc-store";

export type DocStatus = "draft" | "review" | "final";
// GSAM 538.270-4 EPA mechanism keys, in canonical (a)(1) → (a)(3) order.
export type EpaMechanism = "fixed-escalation" | "market-index" | "established-pricing";
export type DocSource = "generated" | "client-upload";

export type DocSignOff = {
  signedBy: string;
  signerEmail: string;
  signerTitle: string;
  signedAt: number;
};

export type DocState = {
  text: string;
  status: DocStatus;
  savedAt: number | null;
  dirty: boolean;
  na?: boolean;
  epaMechanism?: EpaMechanism;
  source?: DocSource;
  sourceFile?: { filename: string; uploadedAt: number } | null;
  signOff?: DocSignOff | null;
};
type Store = Record<string, DocState>;

const defaultStore = (): Store =>
  Object.fromEntries(
    DOCUMENT_QUEUE.map((d) => [
      d.name,
      {
        text: "",
        status: d.status as DocStatus,
        savedAt: null,
        dirty: false,
        source: "generated" as DocSource,
        sourceFile: null,
        signOff: null,
      },
    ]),
  );

// Migrate legacy EPA mechanism keys → canonical (a)(1)-(a)(3) keys.
const EPA_LEGACY_MAP: Record<string, EpaMechanism> = {
  "commercial-price-list": "established-pricing",
  "market-indicator": "market-index",
  "fixed-ceiling": "fixed-escalation",
};
const migrate = (s: Store): Store => {
  const next: Store = { ...s };
  for (const k of Object.keys(next)) {
    const d = next[k];
    if (d && d.epaMechanism && EPA_LEGACY_MAP[d.epaMechanism as string]) {
      next[k] = { ...d, epaMechanism: EPA_LEGACY_MAP[d.epaMechanism as string] };
    }
  }
  return next;
};

let store: Store = migrate({ ...defaultStore(), ...loadPersisted<Store>(PERSIST_KEY, {}) });

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
  const prev = store[name];
  store = { ...store, [name]: { ...prev, ...patch } };

  // Notify the client when a doc transitions into "review" (ready for review).
  if (patch.status === "review" && prev.status !== "review") {
    pushMessage({
      kind: "doc-ready",
      title: `${name} is ready for your review`,
      body: "Open the Review Workflow to read the draft and sign off when satisfied.",
      href: "/review",
    });
    logActivity({ module: "Documentation", action: "ready for review", target: name, clientVisible: true });
  } else if (patch.status === "final" && prev.status !== "final") {
    logActivity({ module: "Documentation", action: "marked final", target: name, clientVisible: true });
  } else if (patch.status === "draft" && prev.status !== "draft") {
    logActivity({ module: "Documentation", action: "moved back to draft", target: name });
  }
  emit();
}

/** Mark a doc as final, sourced from a client intake upload. Used when the
 *  client supplies the artifact during intake so the generator skips drafting. */
export function setDocFromUpload(name: string, filename: string) {
  if (!store[name]) return;
  store = {
    ...store,
    [name]: {
      ...store[name],
      status: "final",
      source: "client-upload",
      sourceFile: { filename, uploadedAt: Date.now() },
      savedAt: Date.now(),
      dirty: false,
      text: store[name].text || `[Client-supplied document: ${filename}]`,
    },
  };
  logActivity({
    module: "Documentation",
    action: `replaced with client upload (${filename})`,
    target: name,
    clientVisible: true,
  });
  emit();
}

/** Flip a client-upload doc back to draft so the team can regenerate from template. */
export function regenerateUploadedDoc(name: string) {
  if (!store[name]) return;
  store = {
    ...store,
    [name]: {
      ...store[name],
      status: "draft",
      source: "generated",
      text: "",
      savedAt: null,
      dirty: false,
      signOff: null,
    },
  };
  logActivity({ module: "Documentation", action: "regenerated from template", target: name });
  emit();
}

export function signOffDoc(name: string, signOff: DocSignOff) {
  if (!store[name]) return;
  store = { ...store, [name]: { ...store[name], signOff, status: "final" } };
  logActivity({
    module: "Documentation",
    action: `signed off by ${signOff.signedBy}`,
    target: name,
    actor: signOff.signedBy,
    clientVisible: true,
  });
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
  "GSAR 552.238-120": "epa-narrative",
};
