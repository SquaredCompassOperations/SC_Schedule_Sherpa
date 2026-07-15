export type ParsedPriceListLcat = {
  title: string;
  rate?: string;
  unit?: string;
  sin?: string;
};

const SIN_PATTERN = /^[0-9]{3,6}[A-Z0-9-]*$/;
const PRICE_PATTERN = /^\$?\d[\d,]*(?:\.\d{2})?$/;
const UNIT_PATTERN = /^(hourly|hour|hours|each|month|monthly|year|yearly|unit|lot)$/i;

export function parsePriceListLcatsFromText(text: string): ParsedPriceListLcat[] {
  const rows: ParsedPriceListLcat[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || looksLikeHeader(line)) continue;

    const parsed = line.includes(",") ? parseCsvLikeLine(line) : parseWhitespaceLine(line);
    if (!parsed?.title) continue;

    const key = `${parsed.sin ?? ""}|${parsed.title}|${parsed.rate ?? ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(parsed);
  }

  return rows;
}

function looksLikeHeader(line: string) {
  const normalized = line.toLowerCase();
  if (normalized.includes("labor category") && normalized.includes("price")) return true;
  if (normalized === "commercial price list") return true;
  if (normalized.includes("hourly service pricing")) return true;
  return false;
}

function parseCsvLikeLine(line: string): ParsedPriceListLcat | null {
  const parts = line
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 4) return null;

  const sin = parts[0];
  const rate = parts.at(-1);
  const unit = parts.at(-2);
  if (!SIN_PATTERN.test(sin) || !rate || !PRICE_PATTERN.test(rate)) return null;

  const title = parts.slice(1, -2).join(", ").trim();
  if (!title || !unit) return null;
  return { sin, title, unit, rate: normalizeRate(rate) };
}

function parseWhitespaceLine(line: string): ParsedPriceListLcat | null {
  const match = line.match(
    /^([0-9]{3,6}[A-Z0-9-]*)\s+(.+?)\s+(Hourly|Hour|Hours|Each|Month|Monthly|Year|Yearly|Unit|Lot)\s+(\$?\d[\d,]*(?:\.\d{2})?)$/i,
  );
  if (!match) return null;

  const [, sin, title, unit, rate] = match;
  if (!title.trim() || !UNIT_PATTERN.test(unit)) return null;
  return {
    sin,
    title: title.trim(),
    unit,
    rate: normalizeRate(rate),
  };
}

function normalizeRate(rate: string) {
  const trimmed = rate.trim();
  return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
}
