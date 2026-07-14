import type { SelectedSin } from "./automation-store";

export type SinScanCandidate = SelectedSin & {
  source: string;
};

export function recommendedSelectedCodes(candidates: SinScanCandidate[]): string[] {
  const strongMatches = candidates
    .filter((candidate) => candidate.confidence >= 70)
    .sort((a, b) => b.confidence - a.confidence)
    .map((candidate) => candidate.code);

  return strongMatches.length > 0
    ? strongMatches
    : candidates.slice(0, 1).map((candidate) => candidate.code);
}

export function selectSinCandidatesForSave(
  candidates: SinScanCandidate[],
  selectedCodes: string[],
): SelectedSin[] {
  const selected = new Set(selectedCodes);
  return candidates
    .filter((candidate) => selected.has(candidate.code))
    .map(({ code, title, confidence, rationale }) => ({
      code,
      title,
      confidence,
      rationale,
    }));
}
