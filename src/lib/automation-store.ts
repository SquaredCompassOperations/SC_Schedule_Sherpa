// Shared automation state. Persists outputs from each Automation Engine module so
// downstream modules can consume them without re-running. Mirrors intake-store.ts.
import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "./persist";

const PERSIST_KEY = "automation-state";

export type SelectedSin = {
  code: string;
  title: string;
  confidence: number;
  rationale: string;
};

export type SelectedLcat = {
  code: string;
  title: string;
  family: string;
  rationale: string;
};

export type MarketRow = {
  sin: string;
  clientLcat?: string;
  laborCategory: string;
  unitOfIssue: string;
  netPrice: string;
  contractor: string;
  contractNumber: string;
  sourceUrl: string;
  needsReview?: boolean;
};

export type AutomationState = {
  selectedSins: SelectedSin[];
  selectedLcats: SelectedLcat[];
  marketRows: MarketRow[];
  marketRunAt: number | null;
  pricingTemplate: "fcp-product" | "fcp-services-plus" | null;
};

const defaultState = (): AutomationState => ({
  selectedSins: [],
  selectedLcats: [],
  marketRows: [],
  marketRunAt: null,
  pricingTemplate: null,
});

let state: AutomationState = loadPersisted<AutomationState>(PERSIST_KEY, defaultState());

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const emit = () => {
  savePersisted(PERSIST_KEY, state);
  listeners.forEach((l) => l());
};

export function getAutomation(): AutomationState {
  return state;
}

export function useAutomation(): AutomationState {
  return useSyncExternalStore(subscribe, getAutomation, getAutomation);
}

export function setSelectedSins(sins: SelectedSin[]) {
  state = { ...state, selectedSins: sins };
  emit();
}

export function setSelectedLcats(lcats: SelectedLcat[]) {
  state = { ...state, selectedLcats: lcats };
  emit();
}

export function setMarketRows(rows: MarketRow[]) {
  state = { ...state, marketRows: rows, marketRunAt: Date.now() };
  emit();
}

export function setPricingTemplate(t: AutomationState["pricingTemplate"]) {
  state = { ...state, pricingTemplate: t };
  emit();
}

export function resetAutomation() {
  state = defaultState();
  emit();
}
