// Shared intake state. Lives outside React so Intake and Readiness pages stay
// in sync without router-level providers. Same useSyncExternalStore pattern as
// doc-store.ts. In-memory only — survives navigation, resets on reload.
import { useSyncExternalStore } from "react";

export type CorporateInfo = {
  uei: string;
  cageCode: string;
  orgType: string;
  parentUei: string;
  legalName: string;
  dba: string;
  ein: string;
  businessTypes: string;
  samStatus: string;
  samExpires: string;
  website: string;
  naicsPrimary: string;
  entityStartDate: string;
  yearsInBusiness: string;
};

export type Address = {
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

export type Negotiator = {
  name: string;
  title: string;
  phoneUs: string;
  phoneIntl: string;
  email: string;
  faxUs: string;
  faxIntl: string;
  authorizedToSign: boolean;
};

export type DocKey =
  | "compensationPlan"
  | "uotPolicy"
  | "corporatePriceList"
  | "pnlYear1"
  | "pnlYear2"
  | "balanceYear1"
  | "balanceYear2";

export type DocEntry = {
  filename: string;
  size: number;
  uploadedAt: number;
  // Optional analysis result for P&L (net loss detection)
  loss?: boolean | null;
};

export type SbaCert = {
  program: string;
  status: string;
  expiration?: string;
};

export type PastPerformanceCategory =
  | "Capability Statement"
  | "Case Study"
  | "Reference"
  | "Project Experience"
  | "CPARS";

export type PastPerformanceEntry = DocEntry & {
  id: string;
  category: PastPerformanceCategory;
};

export type IntakeState = {
  corporate: CorporateInfo;
  companyAddress: Address;
  mailingSame: boolean;
  mailingAddress: Address;
  negotiators: Negotiator[];
  documents: Partial<Record<DocKey, DocEntry>>;
  pastPerformance: PastPerformanceEntry[];
  sbaCerts: SbaCert[];
  sbaScannedAt: number | null;
};

const emptyAddress = (): Address => ({
  street1: "",
  street2: "",
  city: "",
  state: "",
  zip: "",
  country: "United States",
});

const emptyNegotiator = (): Negotiator => ({
  name: "",
  title: "",
  phoneUs: "",
  phoneIntl: "",
  email: "",
  faxUs: "",
  faxIntl: "",
  authorizedToSign: false,
});

let state: IntakeState = {
  corporate: {
    uei: "",
    orgType: "",
    parentUei: "",
    legalName: "",
    dba: "",
    ein: "",
    businessTypes: "",
    samStatus: "",
    samExpires: "",
    website: "",
    naicsPrimary: "",
    entityStartDate: "",
    yearsInBusiness: "",
  },
  companyAddress: emptyAddress(),
  mailingSame: true,
  mailingAddress: emptyAddress(),
  negotiators: [emptyNegotiator()],
  documents: {},
  pastPerformance: [],
  sbaCerts: [],
  sbaScannedAt: null,
};

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const emit = () => listeners.forEach((l) => l());

export function getIntake(): IntakeState {
  return state;
}

export function useIntake(): IntakeState {
  return useSyncExternalStore(subscribe, getIntake, getIntake);
}

export function patchCorporate(patch: Partial<CorporateInfo>) {
  state = { ...state, corporate: { ...state.corporate, ...patch } };
  // derive years in business if entityStartDate present
  if (patch.entityStartDate) {
    const start = new Date(patch.entityStartDate);
    if (!isNaN(start.getTime())) {
      const years = Math.floor((Date.now() - start.getTime()) / (365.25 * 24 * 3600 * 1000));
      state = {
        ...state,
        corporate: { ...state.corporate, yearsInBusiness: String(years) },
      };
    }
  }
  emit();
}

export function patchCompanyAddress(patch: Partial<Address>) {
  state = { ...state, companyAddress: { ...state.companyAddress, ...patch } };
  emit();
}

export function patchMailingAddress(patch: Partial<Address>) {
  state = { ...state, mailingAddress: { ...state.mailingAddress, ...patch } };
  emit();
}

export function setMailingSame(same: boolean) {
  state = { ...state, mailingSame: same };
  emit();
}

export function setNegotiator(index: number, patch: Partial<Negotiator>) {
  const next = [...state.negotiators];
  next[index] = { ...next[index], ...patch };
  state = { ...state, negotiators: next };
  emit();
}

export function addNegotiator() {
  if (state.negotiators.length >= 4) return;
  state = { ...state, negotiators: [...state.negotiators, emptyNegotiator()] };
  emit();
}

export function removeNegotiator(index: number) {
  if (state.negotiators.length <= 1) return;
  state = { ...state, negotiators: state.negotiators.filter((_, i) => i !== index) };
  emit();
}

export function setDocument(key: DocKey, entry: DocEntry | null) {
  const docs = { ...state.documents };
  if (entry) docs[key] = entry;
  else delete docs[key];
  state = { ...state, documents: docs };
  emit();
}

export function setSbaCerts(certs: SbaCert[]) {
  state = { ...state, sbaCerts: certs, sbaScannedAt: Date.now() };
  emit();
}

export const REQUIRED_CORPORATE_KEYS: (keyof CorporateInfo)[] = [
  "uei",
  "legalName",
  "ein",
  "naicsPrimary",
  "samStatus",
  "samExpires",
];

export const DOC_LABELS: Record<DocKey, string> = {
  compensationPlan: "Professional/Employee Compensation Plan",
  uotPolicy: "Uncompensated Overtime Policy",
  corporatePriceList: "Corporate Price List(s)",
  pnlYear1: "P&L Statement — Year 1",
  pnlYear2: "P&L Statement — Year 2",
  balanceYear1: "Balance Sheet — Year 1",
  balanceYear2: "Balance Sheet — Year 2",
};

export const PAST_PERFORMANCE_CATEGORIES: PastPerformanceCategory[] = [
  "Capability Statement",
  "Case Study",
  "Reference",
  "Project Experience",
  "CPARS",
];

export function addPastPerformance(entry: Omit<PastPerformanceEntry, "id">) {
  const id = `pp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  state = { ...state, pastPerformance: [...state.pastPerformance, { ...entry, id }] };
  emit();
}

export function removePastPerformance(id: string) {
  state = { ...state, pastPerformance: state.pastPerformance.filter((e) => e.id !== id) };
  emit();
}
