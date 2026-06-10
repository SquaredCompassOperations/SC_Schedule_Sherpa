// Compliance requirements store — persists user edits to the matrix:
// per-row linked doc, status overrides, and additional custom rows.
import { useSyncExternalStore } from "react";
import { COMPLIANCE_MATRIX } from "./mock-data";
import { loadPersisted, savePersisted } from "./persist";

const PERSIST_KEY = "requirements-store";

export type ReqStatus = "valid" | "review" | "missing" | "na";
export type ReqCat = "technical" | "pricing" | "administrative" | "compliance";

export type Requirement = {
  ref: string;
  cat: ReqCat;
  req: string;
  linkedDoc: string | null; // name from DOCUMENT_QUEUE; null = none/external
  externalRef?: string; // free-text fallback (e.g. legacy `source`)
  status: ReqStatus;
  custom?: boolean;
};

type State = { rows: Requirement[] };

const seed = (): State => ({
  rows: COMPLIANCE_MATRIX.map((r) => ({
    ref: r.ref,
    cat: r.cat as ReqCat,
    req: r.req,
    linkedDoc: null,
    externalRef: r.source !== "—" ? r.source : undefined,
    status: r.status as ReqStatus,
  })),
});

const RETIRED_REFS = new Set(["FAR 31.201-2", "GSAR 552.216-70", "I-FSS-969"]);
const migrate = (s: State): State => {
  const rows = s.rows.filter((r) => !RETIRED_REFS.has(r.ref));
  // Ensure current EPA clause is present if any EPA row was removed
  if (!rows.some((r) => r.ref === "GSAR 552.238-120")) {
    const seeded = seed().rows.find((r) => r.ref === "GSAR 552.238-120");
    if (seeded) rows.push(seeded);
  }
  return { rows };
};

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

export const getRequirements = () => state;
export const useRequirements = () =>
  useSyncExternalStore(subscribe, getRequirements, getRequirements);

export function updateRequirement(ref: string, patch: Partial<Requirement>) {
  state = {
    rows: state.rows.map((r) => (r.ref === ref ? { ...r, ...patch } : r)),
  };
  emit();
}

export function addRequirement(r: Omit<Requirement, "custom">) {
  if (state.rows.some((x) => x.ref === r.ref)) return;
  state = { rows: [...state.rows, { ...r, custom: true }] };
  emit();
}

export function removeRequirement(ref: string) {
  state = { rows: state.rows.filter((r) => r.ref !== ref) };
  emit();
}

export function resetRequirements() {
  state = seed();
  emit();
}
