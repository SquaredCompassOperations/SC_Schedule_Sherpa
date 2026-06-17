// MAS Readiness Assessment state — client portal landing flow.
// Mirrors GSA's MAS Readiness Assessment form (Oct 2024). Persisted to
// localStorage so the client can complete sections across sessions.
import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "./persist";
import { logActivity } from "./activity-log";

const PERSIST_KEY = "readiness-assessment";

export type YesNo = "yes" | "no" | "";
export type YesNoUnsure = "yes" | "no" | "unsure" | "";
export type YesNoUnsureNa = "yes" | "no" | "unsure" | "na" | "";
export type PricePosture = "higher" | "same" | "mix" | "lower" | "";
export type AnnualSales = "<25k" | "25-50k" | "50-75k" | "75-100k" | "100k+" | "";

export type ReadinessSection = "basics" | "compliance" | "fit" | "commercial" | "submit";

export type ReadinessState = {
  // Basics
  pathwaysCompleted: YesNo;
  uei: string;
  offeringDescription: string;
  category: string;
  sin: string;
  hasContractAdmin: "yes" | "no" | "unsure" | "";
  adminName: string;
  adminTitle: string;
  adminEmail: string;
  // Compliance
  taaCompliant: YesNoUnsureNa;
  taaMonitoring: string;
  section889Provides: YesNoUnsure;
  section889Uses: YesNoUnsure;
  section889Monitoring: string;
  fascsaUnderstood: YesNoUnsure;
  fascsaMonitoring: string;
  prohibitedMonitoring: string;
  // Market fit
  soldToGovBefore: YesNo;
  targetAgencies: string;
  // Commercial
  pricePosture: PricePosture;
  annualSales: AnnualSales;
  wantsFeedback: YesNo;
  feedbackFirstName: string;
  feedbackLastName: string;
  feedbackEmail: string;
  feedbackCompany: string;
  // Lifecycle
  sectionsComplete: Record<ReadinessSection, boolean>;
  submittedAt: number | null;
  savedAt: number | null;
};

const defaults = (): ReadinessState => ({
  pathwaysCompleted: "",
  uei: "",
  offeringDescription: "",
  category: "",
  sin: "",
  hasContractAdmin: "",
  adminName: "",
  adminTitle: "",
  adminEmail: "",
  taaCompliant: "",
  taaMonitoring: "",
  section889Provides: "",
  section889Uses: "",
  section889Monitoring: "",
  fascsaUnderstood: "",
  fascsaMonitoring: "",
  prohibitedMonitoring: "",
  soldToGovBefore: "",
  targetAgencies: "",
  pricePosture: "",
  annualSales: "",
  wantsFeedback: "",
  feedbackFirstName: "",
  feedbackLastName: "",
  feedbackEmail: "",
  feedbackCompany: "",
  sectionsComplete: { basics: false, compliance: false, fit: false, commercial: false, submit: false },
  submittedAt: null,
  savedAt: null,
});

let state: ReadinessState = { ...defaults(), ...loadPersisted<ReadinessState>(PERSIST_KEY, defaults()) };

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const emit = () => { savePersisted(PERSIST_KEY, state); listeners.forEach((l) => l()); };

export const getReadiness = () => state;
export const useReadiness = () => useSyncExternalStore(subscribe, getReadiness, getReadiness);

export function patchReadiness(patch: Partial<ReadinessState>) {
  state = { ...state, ...patch, savedAt: Date.now() };
  emit();
}

export function completeSection(section: ReadinessSection) {
  if (state.sectionsComplete[section]) return;
  state = {
    ...state,
    sectionsComplete: { ...state.sectionsComplete, [section]: true },
    savedAt: Date.now(),
  };
  logActivity({ module: "MAS Readiness", action: `completed section "${section}"`, clientVisible: true });
  emit();
}

export function submitReadiness() {
  state = { ...state, submittedAt: Date.now(), savedAt: Date.now() };
  logActivity({ module: "MAS Readiness", action: "submitted assessment", clientVisible: true });
  emit();
}

export function resetReadiness() {
  state = defaults();
  emit();
}

export function readinessStatus(s: ReadinessState): "complete" | "in_progress" | "not_started" {
  if (s.submittedAt) return "complete";
  const any = Object.values(s.sectionsComplete).some(Boolean);
  return any ? "in_progress" : "not_started";
}
