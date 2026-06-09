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

export type PriceListLcat = {
  title: string;
  rate?: string;
  unit?: string;
  sin?: string;
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

export type PricingRow = {
  sin: string;
  title: string;
  description: string;
  minimumEducation: string;
  minimumYearsExperience: string;
  unitOfMeasure: string;
  price: string;
};

export type AutomationState = {
  selectedSins: SelectedSin[];
  selectedLcats: SelectedLcat[];
  priceListLcats: PriceListLcat[];
  priceListSource: string | null;
  priceListExtractedAt: number | null;
  marketRows: MarketRow[];
  marketRunAt: number | null;
  pricingTemplate: "fcp-product" | "fcp-services-plus" | null;
  pricingRows: PricingRow[];
  pricingSavedAt: number | null;
  pricingKeyTerms: string;
};

const defaultState = (): AutomationState => ({
  selectedSins: [],
  selectedLcats: [],
  priceListLcats: [],
  priceListSource: null,
  priceListExtractedAt: null,
  marketRows: [],
  marketRunAt: null,
  pricingTemplate: null,
  pricingRows: [],
  pricingSavedAt: null,
  pricingKeyTerms: defaultKeyTerms(),
});

function defaultKeyTerms(): string {
  return [
    "PRICING TERMS (auto-seeded from GSA Pricing Terms Attachment — Refresh 32). Edit per LCAT / SIN as needed.",
    "",
    "• Prompt Payment Terms — Commercial: Net 30. Government (GSA): Net 30, no early-payment discount unless otherwise stated.",
    "• Warranty — Commercial: Standard commercial warranty applies. Government (GSA): Same as commercial warranty extended to ordering activities.",
    "• Normal Delivery (ARO) — Commercial and Government delivery times stated per SIN (insert specific ARO days per labor category as applicable).",
    "• Quantity / Volume Discounts — Indicate % discount and applicable SIN(s); state whether at contract or task-order level.",
    "• Economic Price Adjustment (EPA) — Elected mechanism per GSAM 538.270-4: (a)(1) fixed escalation, (a)(2) market index, or (a)(3) established pricing. Annual on anniversary date of contract award unless otherwise stated.",
    "• Most Favored Customer (MFC) — Identify the commercial customer or category receiving the best discount that establishes the basis for GSA pricing.",
    "• Commercial Sales Practices (CSP-1) — Discounts, concessions, and terms granted to commercial customers, mapped to the proposed GSA price.",
  ].join("\n");
}


let state: AutomationState = { ...defaultState(), ...loadPersisted<Partial<AutomationState>>(PERSIST_KEY, {}) };

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

export function setPriceListLcats(lcats: PriceListLcat[], source: string | null) {
  state = {
    ...state,
    priceListLcats: lcats,
    priceListSource: source,
    priceListExtractedAt: Date.now(),
  };
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


export function savePricingRows(rows: PricingRow[]) {
  state = { ...state, pricingRows: rows, pricingSavedAt: Date.now() };
  emit();
}

export function setPricingKeyTerms(text: string) {
  state = { ...state, pricingKeyTerms: text };
  emit();
}

export function resetAutomation() {
  state = defaultState();
  emit();
}
