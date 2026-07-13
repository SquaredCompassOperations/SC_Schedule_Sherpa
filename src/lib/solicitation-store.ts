import { useSyncExternalStore } from "react";
import type { OfferType } from "./offer-workspace";
import { isGsaMasOfferType } from "./offer-workspace";
import { DOCUMENT_QUEUE } from "./mock-data";
import { loadPersisted, savePersisted } from "./persist";

const PERSIST_KEY = "solicitation-packets";

export type SolicitationFileInput = {
  filename: string;
  mediaType: string;
  size: number;
};

export type SolicitationPacketFile = SolicitationFileInput & {
  id: string;
  uploadedAt: number;
};

export type SolicitationPacket = {
  files: SolicitationPacketFile[];
  ingestedAt: number | null;
};

export type SolicitationDocumentQueueItem = {
  name: string;
  kind: string;
  status: "draft";
  sourceFile?: SolicitationPacketFile;
};

type Store = Record<string, SolicitationPacket>;

let store: Store = loadPersisted<Store>(PERSIST_KEY, {});
const EMPTY_PACKET: SolicitationPacket = {
  files: [],
  ingestedAt: null,
};

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const emit = () => {
  savePersisted(PERSIST_KEY, store);
  listeners.forEach((listener) => listener());
};

export function getSolicitationPacket(offerId: string | null | undefined): SolicitationPacket {
  if (!offerId) return EMPTY_PACKET;
  return store[offerId] ?? EMPTY_PACKET;
}

export function useSolicitationPacket(offerId: string | null | undefined): SolicitationPacket {
  return useSyncExternalStore(
    subscribe,
    () => getSolicitationPacket(offerId),
    () => getSolicitationPacket(offerId),
  );
}

export function replaceSolicitationPacket(offerId: string, files: SolicitationFileInput[]) {
  store = {
    ...store,
    [offerId]: {
      files: files.map((file, index) => ({
        ...file,
        id: `${offerId}-sol-${Date.now()}-${index}`,
        uploadedAt: Date.now(),
      })),
      ingestedAt: Date.now(),
    },
  };
  emit();
}

export function addSolicitationFiles(offerId: string, files: SolicitationFileInput[]) {
  const current = getSolicitationPacket(offerId);
  replaceSolicitationPacket(offerId, [
    ...current.files.map(({ filename, mediaType, size }) => ({ filename, mediaType, size })),
    ...files,
  ]);
}

export function deriveSolicitationDocumentName(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  return withoutExt
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

export function buildDocumentQueueForOffer(
  offerType: OfferType,
  files: SolicitationPacketFile[],
): SolicitationDocumentQueueItem[] {
  if (isGsaMasOfferType(offerType)) {
    return DOCUMENT_QUEUE.map((document) => ({
      name: document.name,
      kind: document.kind,
      status: "draft" as const,
    }));
  }
  return files.map((file) => ({
    name: deriveSolicitationDocumentName(file.filename),
    kind: "solicitation-document",
    status: "draft",
    sourceFile: file,
  }));
}

export function resetSolicitationPackets() {
  store = {};
  emit();
}
