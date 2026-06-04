// Top-level readiness rollup. Aggregates per-module status from live stores
// (doc-store) and static mock-data into a single composite score + per-module
// readiness breakdown.

import {
  COMPLIANCE_MATRIX,
  DOCUMENT_QUEUE,
  LABOR_CATEGORIES,
  
  SIN_MATCHES,
} from "./mock-data";
import { useDocStore, COMPLIANCE_DOC_LINKS, type DocStatus } from "./doc-store";

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




  // Documents — live from doc-store, respect N/A and the mutually-exclusive
  // Relevant Project Experience ↔ Startup Springboard pair.
  const PAIR_KINDS = new Set(["relevant-project", "startup-springboard"]);
  const isKindFinal = (kind: string) => {
    const d = DOCUMENT_QUEUE.find((x) => x.kind === kind);
    if (!d) return false;
    return (docs[d.name]?.status ?? d.status) === "final" && !docs[d.name]?.na;
  };

  const activeDocs = DOCUMENT_QUEUE.filter((d) => {
    if (PAIR_KINDS.has(d.kind)) return false;
    if (docs[d.name]?.na) return false;
    return true;
  });
  const activeStatuses = activeDocs.map(
    (d) => (docs[d.name]?.status ?? d.status) as DocStatus,
  );
  const finals = activeStatuses.filter((s) => s === "final").length;
  const reviews = activeStatuses.filter((s) => s === "review").length;
  const drafts = activeStatuses.filter((s) => s === "draft").length;

  const pairSatisfied = isKindFinal("relevant-project") || isKindFinal("startup-springboard");
  const denom = (activeDocs.length + 1) * 100;
  const docScore = Math.round(
    ((finals * 100 + reviews * 70 + drafts * 30 + (pairSatisfied ? 100 : 0)) / denom) * 100,
  );
  const docBlockers: string[] = [];
  if (drafts > 0) docBlockers.push(`${drafts} document${drafts === 1 ? "" : "s"} still in draft`);
  if (!pairSatisfied)
    docBlockers.push("Finalize Relevant Project Experience or Startup Springboard");
  const docs_: ModuleReadiness = {
    slug: "/documents",
    label: "Document Generator",
    weight: 20,
    score: docScore,
    state: stateFor(docScore, false),
    summary: `${finals} final · ${reviews} review · ${drafts} draft${pairSatisfied ? " · pair ✓" : " · pair pending"}`,
    blockers: docBlockers,
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

  // Compliance — derive from live doc-store via COMPLIANCE_DOC_LINKS so
  // finalizing a linked document clears its compliance gap (mirrors export).
  const effectiveCompliance = COMPLIANCE_MATRIX.map((r) => {
    const linkedKind = COMPLIANCE_DOC_LINKS[r.ref];
    if (linkedKind && isKindFinal(linkedKind)) return { ...r, status: "valid" as const };
    return r;
  });
  const compTotal = effectiveCompliance.length;
  const compMissing = effectiveCompliance.filter((r) => r.status === "missing").length;
  const compReview = effectiveCompliance.filter((r) => r.status === "review").length;
  const compValid = effectiveCompliance.filter(
    (r) => r.status === "valid" || r.status === "na",
  ).length;
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
        ? effectiveCompliance
            .filter((r) => r.status === "missing")
            .map((r) => `${r.ref} · ${r.req}`)
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

  // Export — hard-blocked unless compliance gaps clear, pair satisfied,
  // and no active docs are still draft/review.
  const exportReady = compMissing === 0 && drafts === 0 && reviews === 0 && pairSatisfied;
  const exportScore = exportReady ? 100 : compMissing === 0 ? 60 : 30;
  const exportBlockers: string[] = [];
  if (compMissing > 0) exportBlockers.push("Compliance gaps unresolved");
  if (drafts + reviews > 0) exportBlockers.push("Documents not finalized");
  if (!pairSatisfied) exportBlockers.push("Corporate experience pair not satisfied");
  const exportMod: ModuleReadiness = {
    slug: "/export",
    label: "Export eOffer",
    weight: 10,
    score: exportScore,
    state: stateFor(exportScore, !exportReady),
    summary: exportReady
      ? "Package ready to build"
      : `${compMissing} compliance · ${drafts + reviews} non-final doc${drafts + reviews === 1 ? "" : "s"}`,
    blockers: exportBlockers,
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
