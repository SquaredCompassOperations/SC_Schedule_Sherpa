import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ExtractedLcat } from "./price-list-extract.functions";
import { generateTextFromPrompt } from "./gemini-service";
import { parsePriceListLcatsFromText } from "./price-list-parser";

const InputSchema = z.object({ url: z.string().url().max(500) });

type Result = {
  lcats: ExtractedLcat[];
  source?: string;
  notes: string[];
  error?: string;
};

async function firecrawlSearch(query: string, limit = 6) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY not configured");
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) throw new Error(`Firecrawl search failed [${res.status}]`);
  const j: { data?: { web?: Array<{ url: string; title?: string; description?: string }> } } =
    await res.json();
  return j.data?.web ?? [];
}

async function firecrawlScrape(url: string) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY not configured");
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  if (!res.ok) return { markdown: "" };
  const j: { data?: { markdown?: string } } = await res.json();
  return { markdown: (j.data?.markdown ?? "").slice(0, 24000) };
}

async function aiCall(prompt: string): Promise<string> {
  return generateTextFromPrompt({ prompt });
}

function parseLcats(text: string): ExtractedLcat[] {
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\])/);
  let arr: unknown;
  try {
    arr = JSON.parse(m ? m[1] : text);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: ExtractedLcat[] = [];
  const seen = new Set<string>();
  for (const r of arr) {
    if (!r || typeof r !== "object") continue;
    const obj = r as Record<string, unknown>;
    const title = String(obj.title ?? "").trim();
    if (!title) continue;
    const rate = obj.rate ? String(obj.rate).trim() : "";
    const key = `${title}|${rate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: title.slice(0, 200),
      rate: rate ? rate.slice(0, 40) : undefined,
      unit: obj.unit ? String(obj.unit).slice(0, 40) : undefined,
      sin: obj.sin ? String(obj.sin).slice(0, 40) : undefined,
    });
  }
  return out;
}

export const crawlPriceListFromSite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<Result> => {
    const notes: string[] = [];
    try {
      const domain = new URL(data.url).hostname.replace(/^www\./, "");
      const queries = [
        `site:${domain} "price list" filetype:pdf`,
        `site:${domain} "rate card" filetype:pdf`,
        `site:${domain} "labor categories" filetype:pdf`,
        `site:${domain} "price list"`,
      ];

      let pick: { url: string; title?: string } | null = null;
      for (const q of queries) {
        try {
          const results = await firecrawlSearch(q, 5);
          const pdf = results.find((r) => /\.pdf(\?|$)/i.test(r.url)) || results[0];
          if (pdf) {
            pick = pdf;
            notes.push(`Matched "${q}" → ${pdf.url}`);
            break;
          }
        } catch (e) {
          notes.push(`Search failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (!pick) {
        return { lcats: [], notes, error: "No price list found on the client's site." };
      }

      const { markdown } = await firecrawlScrape(pick.url);
      if (!markdown.trim()) {
        return {
          lcats: [],
          source: pick.url,
          notes,
          error: "Could not read the discovered price list.",
        };
      }
      const localRows = parsePriceListLcatsFromText(markdown);
      if (localRows.length > 0) {
        return { lcats: localRows, source: pick.url, notes };
      }

      const prompt = `Extract every Labor Category (LCAT) / offering from the contractor commercial price list below. Return ONLY a JSON array — no prose, no markdown fences. Each element: {"title": "<exact LCAT or offering name including seniority>", "rate": "<commercial price as printed e.g. $160.00>", "unit": "<Hour|Each|...>", "sin": "<SIN if present>"}. Return every distinct row. Do NOT collapse seniority levels. Omit fields not present. If a row has no LCAT title, skip it.

Document:
${markdown}`;
      const text = await aiCall(prompt);
      const lcats = parseLcats(text);
      if (lcats.length === 0) {
        notes.push("Document scraped but no LCAT rows could be parsed.");
      }
      return { lcats, source: pick.url, notes };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { lcats: [], notes, error: msg };
    }
  });
