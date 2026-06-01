// Top-level readiness rollup. Aggregates per-module status from live stores
// (doc-store) and static mock-data into a single composite score + per-module
// readiness breakdown.

import {
  COMPLIANCE_MATRIX,
  DOCUMENT_QUEUE,
  LABOR_CATEGORIES,
  
  SIN_MATCHES,
} from "./mock-data";
import { useDocStore, type DocStatus } from "./doc-store";

export type ModuleReadiness = {
  slug: string;
  label: string;
  weight: number; // 0-100, contributes to composite
  score: number; // 0-100
  state: "ready" | "attention" | "blocked";
  summary: string;
  blockers: string[];
};

export type RollupResult = {
  modules: ModuleReadiness[];
  composite: number; // 0-100
  ready: number;
  attention: number;
  blocked: number;
  exportReady: boolean;
};

const stateFor = (score: number, hardBlocked: boolean): ModuleReadiness["state"] => {
  if (hardBlocked) return "blocked";
  if (score >= 90) return "ready";
  if (score >= 70) return "attention";
  return "blocked";
};

export function useReadinessRollup(): RollupResult {
  const docs = useDocStore();

  // Intake — static client profile fully populated in mock-data
  const intake: ModuleReadiness = {
    slug: "/intake",
    label: "Client Intake",
    weight: 10,
    score: 100,
    state: "ready",
    summary: "Master client profile populated",
    blockers: [],
  };

  // SIN — weighted by confidence of top SIN + count of viable (>=70) matches
  const viableSins = SIN_MATCHES.filter((s) => s.confidence >= 70);
  const sinScore = Math.min(
    100,
    Math.round((SIN_MATCHES[0]?.confidence ?? 0) * 0.7 + viableSins.length * 10),
  );
  const sin: ModuleReadiness = {
    slug: "/sin",
    label: "SIN Recommendation",
    weight: 10,
    score: sinScore,
    state: stateFor(sinScore, false),
    summary: `${viableSins.length}/${SIN_MATCHES.length} viable · top ${SIN_MATCHES[0]?.code} ${SIN_MATCHES[0]?.confidence}%`,
    blockers: viableSins.length === 0 ? ["No SINs above 70% confidence"] : [],
  };




  // Documents — live from doc-store
  const docStatuses = DOCUMENT_QUEUE.map(
    (d) => (docs[d.name]?.status ?? d.status) as DocStatus,
  );
  const finals = docStatuses.filter((s) => s === "final").length;
  const reviews = docStatuses.filter((s) => s === "review").length;
  const drafts = docStatuses.filter((s) => s === "draft").length;
  const docScore = Math.round(
    ((finals * 100 + reviews * 70 + drafts * 30) / (DOCUMENT_QUEUE.length * 100)) * 100,
  );
  const docs_: ModuleReadiness = {
    slug: "/documents",
    label: "Document Generator",
    weight: 20,
    score: docScore,
    state: stateFor(docScore, false),
    summary: `${finals} final · ${reviews} review · ${drafts} draft`,
    blockers: drafts > 0 ? [`${drafts} document${drafts === 1 ? "" : "s"} still in draft`] : [],
  };

  // Pricing — has labor matrix; static-ready when LCATs present
  const pricingScore = LABOR_CATEGORIES.length >= 5 ? 90 : 70;
  const pricing: ModuleReadiness = {
    slug: "/pricing",
    label: "Pricing Workbook",
    weight: 15,
    score: pricingScore,
    state: stateFor(pricingScore, false),
    summary: `${LABOR_CATEGORIES.length} labor categories · IFF applied`,
    blockers: [],
  };

  // Compliance — % non-missing (na counts as covered)
  const compTotal = COMPLIANCE_MATRIX.length;
  const compMissing = COMPLIANCE_MATRIX.filter((r) => r.status === "missing").length;
  const compReview = COMPLIANCE_MATRIX.filter((r) => r.status === "review").length;
  const compValid = COMPLIANCE_MATRIX.filter((r) => r.status === "valid").length;
  const compScore = Math.round(
    ((compValid * 100 + compReview * 60) / (compTotal * 100)) * 100,
  );
  const compliance: ModuleReadiness = {
    slug: "/compliance",
    label: "Compliance Matrix",
    weight: 20,
    score: compScore,
    state: stateFor(compScore, compMissing > 0),
    summary: `${compValid} valid · ${compReview} review · ${compMissing} missing`,
    blockers:
      compMissing > 0
        ? [`${compMissing} requirement${compMissing === 1 ? "" : "s"} missing`]
        : [],
  };

  // Review — derived: ready only when all upstream are ≥ 80
  const upstreamReady = [sin, docs_, pricing, compliance].every(
    (m) => m.score >= 80,
  );
  const reviewScore = upstreamReady ? 85 : Math.min(70, Math.round((docScore + compScore) / 2));
  const review: ModuleReadiness = {
    slug: "/review",
    label: "Review Workflow",
    weight: 5,
    score: reviewScore,
    state: stateFor(reviewScore, false),
    summary: upstreamReady ? "Upstream gates clear" : "Awaiting upstream readiness",
    blockers: upstreamReady ? [] : ["Resolve upstream module gaps first"],
  };

  // Export — hard-blocked unless compliance has 0 missing AND all docs final
  const exportReady = compMissing === 0 && drafts === 0 && reviews === 0;
  const exportScore = exportReady ? 100 : compMissing === 0 ? 60 : 30;
  const exportMod: ModuleReadiness = {
    slug: "/export",
    label: "Export eOffer",
    weight: 10,
    score: exportScore,
    state: stateFor(exportScore, !exportReady),
    summary: exportReady
      ? "Package ready to build"
      : `${compMissing} compliance · ${drafts + reviews} non-final doc${drafts + reviews === 1 ? "" : "s"}`,
    blockers: exportReady
      ? []
      : [
          ...(compMissing > 0 ? ["Compliance gaps unresolved"] : []),
          ...(drafts + reviews > 0 ? ["Documents not finalized"] : []),
        ],
  };

  const modules = [intake, sin, docs_, pricing, compliance, review, exportMod];

  const totalWeight = modules.reduce((a, m) => a + m.weight, 0);
  const composite =
    Math.round(
      (modules.reduce((a, m) => a + m.score * m.weight, 0) / totalWeight) * 10,
    ) / 10;

  return {
    modules,
    composite,
    ready: modules.filter((m) => m.state === "ready").length,
    attention: modules.filter((m) => m.state === "attention").length,
    blocked: modules.filter((m) => m.state === "blocked").length,
    exportReady,
  };
}
