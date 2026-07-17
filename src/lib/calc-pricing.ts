import type { MarketRow, PriceListLcat } from "./automation-store";

const CALC_API_BASE = "https://buy.gsa.gov/pricing/api/v3/search/ceilingrates/";
const CALC_QR_BASE = "https://buy.gsa.gov/pricing/qr/mas";

export type CalcPricingComparable = {
  laborCategory: string;
  price: number | null;
  contractor: string;
  contractNumber: string;
  sin: string;
  schedule: string;
  educationLevel: string;
  minYearsExperience: number | null;
  worksite: string;
  contractEnd: string;
};

export type CalcBenchmark = {
  laborCategory: string;
  clientRate: number | null;
  count: number;
  min?: number;
  average?: number;
  median?: number;
  max?: number;
  comparables: CalcPricingComparable[];
  sourceUrl: string;
};

export type CalcPricingPosture =
  | "below_market"
  | "market_aligned"
  | "above_market"
  | "no_calc_match";

export type CalcComparison = {
  posture: CalcPricingPosture;
  delta: number | null;
  deltaPercent: number | null;
};

type CalcSource = Record<string, unknown>;

type CalcResponse = {
  hits?: {
    total?: number | { value?: number; relation?: string };
    hits?: Array<{ _source?: CalcSource }>;
  };
  aggregations?: {
    wage_stats?: {
      count?: number;
      min?: number;
      max?: number;
      avg?: number;
    };
    median_price?: {
      values?: Record<string, number | null | undefined>;
    };
  };
};

export function buildCalcPricingUrl(input: {
  laborCategory: string;
  sin?: string;
  page?: number;
  pageSize?: number;
}) {
  const url = new URL(CALC_API_BASE);
  url.searchParams.set("search", `labor_category:${input.laborCategory.trim()}`);
  url.searchParams.set("page", String(input.page ?? 1));
  url.searchParams.set("page_size", String(input.pageSize ?? 20));
  url.searchParams.set("ordering", "current_price");
  url.searchParams.set("sort", "asc");
  url.searchParams.set("exclude", "");
  url.searchParams.append("filter", "histogram:12");
  url.searchParams.append("filter", "experience_range:0,45");
  url.searchParams.append("filter", "price_range:15,500");
  if (input.sin?.trim()) url.searchParams.append("filter", `sin:${input.sin.trim()}`);
  return url;
}

export function buildCalcQrUrl(input: { laborCategory: string; sin?: string }) {
  const url = new URL(CALC_QR_BASE);
  url.searchParams.set("query_by", "labor_category");
  url.searchParams.set("q", input.laborCategory.trim());
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "20");
  url.searchParams.set("histogram", "12");
  url.searchParams.set("experience_range", "0,45");
  url.searchParams.set("price_range", "15,500");
  url.searchParams.set("ordering", "current_price");
  url.searchParams.set("acceptsDataDisclosure", "true");
  url.searchParams.set("sort", "asc");
  url.searchParams.set("labor_category", input.laborCategory.trim());
  if (input.sin?.trim()) url.searchParams.set("sin", input.sin.trim());
  return url.toString();
}

export function parseCurrency(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value) return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return `$${value.toFixed(2)}`;
}

export function normalizeCalcPricingResponse(input: {
  laborCategory: string;
  clientRate?: string | number;
  response: unknown;
  sourceUrl?: string;
}): CalcBenchmark {
  const response = input.response as CalcResponse;
  const hits = response.hits?.hits ?? [];
  const stats = response.aggregations?.wage_stats;
  const median = response.aggregations?.median_price?.values?.["50.0"] ?? undefined;
  const count =
    typeof stats?.count === "number"
      ? stats.count
      : typeof response.hits?.total === "number"
        ? response.hits.total
        : (response.hits?.total?.value ?? hits.length);

  return {
    laborCategory: input.laborCategory,
    clientRate: parseCurrency(input.clientRate),
    count,
    min: roundCurrency(stats?.min),
    average: roundCurrency(stats?.avg),
    median: roundCurrency(median),
    max: roundCurrency(stats?.max),
    comparables: hits.map((hit) => normalizeComparable(hit._source ?? {})),
    sourceUrl: input.sourceUrl ?? buildCalcQrUrl({ laborCategory: input.laborCategory }),
  };
}

export function compareClientPriceToCalc(input: {
  clientRate: number | null | undefined;
  calcMedian: number | null | undefined;
}): CalcComparison {
  if (!input.clientRate || !input.calcMedian) {
    return { posture: "no_calc_match", delta: null, deltaPercent: null };
  }

  const delta = roundNumber(input.clientRate - input.calcMedian);
  const deltaPercent = roundNumber((delta / input.calcMedian) * 100);
  if (deltaPercent <= -10) return { posture: "below_market", delta, deltaPercent };
  if (deltaPercent >= 10) return { posture: "above_market", delta, deltaPercent };
  return { posture: "market_aligned", delta, deltaPercent };
}

export function buildCalcBenchmarkRows(input: {
  sin: string;
  lcats: PriceListLcat[];
  benchmarks: CalcBenchmark[];
}): MarketRow[] {
  const benchmarkByTitle = new Map(
    input.benchmarks.map((benchmark) => [benchmark.laborCategory.toLowerCase(), benchmark]),
  );

  return input.lcats.map((lcat) => {
    const benchmark = benchmarkByTitle.get(lcat.title.toLowerCase());
    const comparable = benchmark?.comparables[0];
    const comparison = compareClientPriceToCalc({
      clientRate: benchmark?.clientRate ?? parseCurrency(lcat.rate),
      calcMedian: benchmark?.median,
    });
    const sin = lcat.sin || comparable?.sin || input.sin;

    return {
      sin,
      clientLcat: lcat.title,
      laborCategory: comparable?.laborCategory || benchmark?.laborCategory || lcat.title,
      unitOfIssue: normalizeUnit(lcat.unit),
      netPrice: formatCurrency(comparable?.price),
      contractor: comparable?.contractor || "",
      contractNumber: comparable?.contractNumber || "",
      sourceUrl: benchmark?.sourceUrl ?? buildCalcQrUrl({ laborCategory: lcat.title, sin }),
      educationLevel: comparable?.educationLevel || "",
      minYearsExperience: comparable?.minYearsExperience ?? null,
      needsReview: comparison.posture !== "market_aligned",
      clientPrice: formatCurrency(parseCurrency(lcat.rate)),
      calcAverage: formatCurrency(benchmark?.average),
      calcMedian: formatCurrency(benchmark?.median),
      calcRange:
        benchmark?.min && benchmark.max
          ? `${formatCurrency(benchmark.min)} - ${formatCurrency(benchmark.max)}`
          : "",
      calcSampleSize: benchmark?.count ?? 0,
      pricingPosition: comparison.posture,
      pricingDelta:
        comparison.delta === null || comparison.deltaPercent === null
          ? ""
          : `${formatCurrency(comparison.delta)} (${comparison.deltaPercent.toFixed(2)}%)`,
    };
  });
}

function normalizeComparable(source: CalcSource): CalcPricingComparable {
  return {
    laborCategory: stringValue(source.labor_category),
    price: parseCurrency(source.current_price as string | number | null | undefined),
    contractor: stringValue(source.vendor_name),
    contractNumber: stringValue(source.idv_piid),
    sin: stringValue(source.sin),
    schedule: stringValue(source.schedule),
    educationLevel: stringValue(source.education_level),
    minYearsExperience: numberValue(source.min_years_experience),
    worksite: stringValue(source.worksite),
    contractEnd: stringValue(source.contract_end),
  };
}

function normalizeUnit(unit: string | undefined): string {
  if (!unit) return "Hour";
  return unit.toLowerCase() === "hourly" ? "Hour" : unit;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundCurrency(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.round(value * 100) / 100;
}

function roundNumber(value: number): number {
  return Math.round(value * 100) / 100;
}
