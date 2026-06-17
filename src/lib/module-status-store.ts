// Per-module completion override. When a user clicks "Save & Continue" on a
// module, that module's slug is marked complete and the sidebar indicator
// turns green. Independent of the readiness rollup score.
import { useSyncExternalStore } from "react";
import { MODULES, type ModuleStatus } from "./mock-data";
import { loadPersisted, savePersisted } from "./persist";

const PERSIST_KEY = "module-status-overrides";

type Overrides = Record<string, ModuleStatus>;

let state: Overrides = loadPersisted<Overrides>(PERSIST_KEY, {});

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const emit = () => { savePersisted(PERSIST_KEY, state); listeners.forEach((l) => l()); };

export const getModuleStatuses = () => state;
export const useModuleStatuses = () => useSyncExternalStore(subscribe, getModuleStatuses, getModuleStatuses);

export function markModuleComplete(slug: string) {
  if (state[slug] === "complete") return;
  state = { ...state, [slug]: "complete" };
  emit();
}

export function setModuleStatus(slug: string, status: ModuleStatus) {
  state = { ...state, [slug]: status };
  emit();
}

export function clearModuleStatus(slug: string) {
  const next = { ...state };
  delete next[slug];
  state = next;
  emit();
}

export function resetModuleStatuses() {
  state = {};
  emit();
}

/** Returns MODULES with statuses overridden by the store. */
export function useResolvedModules() {
  const overrides = useModuleStatuses();
  return MODULES.map((m) => ({ ...m, status: overrides[m.slug] ?? m.status }));
}
