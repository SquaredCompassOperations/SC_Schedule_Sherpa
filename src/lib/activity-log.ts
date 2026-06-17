// Centralized activity log. Stores explicit mutation events (not snapshots).
// Stores can push events here; status-data merges them into the activity feed.
import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "./persist";

const PERSIST_KEY = "activity-log";
const MAX_EVENTS = 200;

export type ActivityEvent = {
  id: string;
  ts: number;
  module: string;
  action: string;
  target?: string;
  actor?: string;
  clientVisible?: boolean;
};

let events: ActivityEvent[] = loadPersisted<ActivityEvent[]>(PERSIST_KEY, []);

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const emit = () => { savePersisted(PERSIST_KEY, events); listeners.forEach((l) => l()); };

export const getActivityLog = () => events;
export const useActivityLog = () => useSyncExternalStore(subscribe, getActivityLog, getActivityLog);

export function logActivity(e: Omit<ActivityEvent, "id" | "ts"> & { ts?: number }) {
  const ev: ActivityEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: e.ts ?? Date.now(),
    module: e.module,
    action: e.action,
    target: e.target,
    actor: e.actor,
    clientVisible: e.clientVisible ?? false,
  };
  events = [ev, ...events].slice(0, MAX_EVENTS);
  emit();
}

export function resetActivityLog() {
  events = [];
  emit();
}
