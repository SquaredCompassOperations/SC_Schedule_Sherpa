// Lightweight in-app message/alert feed for the client portal. Used by the
// Document Generator to notify clients when a document is ready for review.
import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "./persist";

const PERSIST_KEY = "client-messages";

export type Message = {
  id: string;
  ts: number;
  kind: "doc-ready" | "info" | "request" | "sign-off";
  title: string;
  body: string;
  read: boolean;
  href?: string;
};

let state: Message[] = loadPersisted<Message[]>(PERSIST_KEY, []);
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const emit = () => { savePersisted(PERSIST_KEY, state); listeners.forEach((l) => l()); };

export const getMessages = () => state;
export const useMessages = () => useSyncExternalStore(subscribe, getMessages, getMessages);

export function pushMessage(m: Omit<Message, "id" | "ts" | "read">) {
  // Dedup by title+kind within the last minute (avoid spam on rapid status flips).
  const existing = state.find(
    (x) => x.title === m.title && x.kind === m.kind && Date.now() - x.ts < 60_000,
  );
  if (existing) return;
  const next: Message = {
    ...m,
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    read: false,
  };
  state = [next, ...state].slice(0, 100);
  emit();
}

export function markRead(id: string) {
  state = state.map((m) => (m.id === id ? { ...m, read: true } : m));
  emit();
}

export function markAllRead() {
  state = state.map((m) => ({ ...m, read: true }));
  emit();
}

export function resetMessages() {
  state = [];
  emit();
}
