import type { AutomationState, PricingRow } from "./automation-store";

export type PricingWorkbookRow = Required<
  Pick<
    PricingRow,
    | "sin"
    | "title"
    | "description"
    | "keywords"
    | "minimumEducation"
    | "minimumYearsExperience"
    | "unitOfMeasure"
    | "price"
  >
> & {
  scaLaborCategory: string;
  wageDeterminationTable: string;
};

export function emptyPricingWorkbookRow(sin = ""): PricingWorkbookRow {
  return {
    sin,
    title: "",
    description: "",
    keywords: "",
    minimumEducation: "Bachelors",
    minimumYearsExperience: "5",
    unitOfMeasure: "Hour",
    price: "",
    scaLaborCategory: "",
    wageDeterminationTable: "",
  };
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "for",
  "to",
  "in",
  "on",
  "with",
  "by",
  "at",
  "as",
  "is",
  "are",
  "be",
  "been",
  "this",
  "that",
  "these",
  "those",
  "from",
  "into",
  "under",
  "over",
  "within",
  "across",
  "per",
  "using",
  "use",
  "their",
  "they",
  "them",
  "its",
  "it",
  "also",
  "may",
  "such",
  "including",
  "other",
  "than",
  "upon",
  "via",
  "each",
  "any",
  "all",
  "not",
  "but",
  "if",
  "when",
  "while",
  "will",
  "shall",
  "must",
  "can",
  "should",
  "would",
  "could",
  "has",
  "have",
  "had",
  "do",
  "does",
  "done",
  "being",
  "etc",
  "e.g",
  "i.e",
  "level",
  "levels",
  "ensure",
  "ensures",
  "provide",
  "provides",
  "provided",
  "perform",
  "performs",
  "performed",
  "performing",
  "support",
  "supports",
  "supported",
  "supporting",
  "work",
  "works",
  "working",
  "worked",
  "candidate",
  "candidates",
  "duties",
  "duty",
  "responsibilities",
  "responsibility",
  "experience",
  "required",
  "requires",
  "requirement",
  "requirements",
  "year",
  "years",
  "minimum",
  "preferred",
  "plus",
  "includes",
  "included",
  "tasks",
  "task",
]);

export function derivePricingKeywords(description: string): string {
  if (!description || description.trim().length < 30) return "";
  const phraseMatches = Array.from(
    description.matchAll(/\b([A-Z][a-zA-Z0-9]+(?:[ -][A-Z][a-zA-Z0-9]+){0,3})\b/g),
  ).map((match) => match[1].trim());
  const phraseFreq = new Map<string, number>();
  for (const phrase of phraseMatches) {
    if (phrase.length < 3 || phrase.length > 60) continue;
    if (STOPWORDS.has(phrase.toLowerCase())) continue;
    phraseFreq.set(phrase, (phraseFreq.get(phrase) ?? 0) + 1);
  }
  const phrases = Array.from(phraseFreq.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([phrase]) => phrase);

  const wordFreq = new Map<string, number>();
  for (const raw of description.toLowerCase().split(/[^a-z0-9-]+/)) {
    const word = raw.trim();
    if (word.length < 4 || STOPWORDS.has(word)) continue;
    wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
  }
  const words = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([word]) => word);

  const picked: string[] = [];
  const seen = new Set<string>();
  for (const candidate of [...phrases, ...words]) {
    const normalized = candidate.toLowerCase();
    if (seen.has(normalized)) continue;
    if (candidate.length > 100) continue;
    seen.add(normalized);
    picked.push(candidate);
    if (picked.length >= 5) break;
  }
  return picked.join(", ");
}

export function buildPricingRowsFromAutomation(automation: AutomationState): PricingWorkbookRow[] {
  const firstSin = automation.selectedSins[0]?.code || "";
  if (automation.pricingRows.length > 0) {
    return automation.pricingRows.map((row) => ({
      ...emptyPricingWorkbookRow(row.sin || firstSin),
      ...row,
      keywords: row.keywords ?? "",
      scaLaborCategory: row.scaLaborCategory ?? "",
      wageDeterminationTable: row.wageDeterminationTable ?? "",
    }));
  }

  if (automation.priceListLcats.length > 0) {
    const descriptionByTitle = new Map(
      automation.selectedLcats.map((lcat) => [lcat.title.toLowerCase(), lcat.rationale]),
    );
    return automation.priceListLcats.map((lcat) => {
      const description = descriptionByTitle.get(lcat.title.toLowerCase()) ?? "";
      return {
        ...emptyPricingWorkbookRow(lcat.sin || firstSin),
        title: lcat.title,
        description,
        keywords: derivePricingKeywords(description),
        unitOfMeasure: lcat.unit || "Hour",
        price: (lcat.rate || "").replace(/[$,]/g, "").trim(),
      };
    });
  }

  if (automation.selectedLcats.length > 0) {
    return automation.selectedLcats.map((lcat) => ({
      ...emptyPricingWorkbookRow(firstSin),
      title: lcat.title,
      description: lcat.rationale,
      keywords: derivePricingKeywords(lcat.rationale),
    }));
  }

  return [emptyPricingWorkbookRow(firstSin)];
}
