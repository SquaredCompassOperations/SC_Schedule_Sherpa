import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  sin: z.string().min(1).max(20),
  lcats: z.array(z.string().min(1).max(200)).max(50).default([]),
});

type Row = {
  sin: string;
  laborCategory: string;
  unitOfIssue: string;
  netPrice: string;
  contractor: string;
  contractNumber: string;
  sourceUrl: string;
  needsReview?: boolean;
};

type Result = {
  rows: Row[];
  contractorsScanned: number;
  notes: string[];
  error?: string;
};

async function firecrawlSearch(query: string, limit = 8) {
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
  return { markdown: (j.data?.markdown ?? "").slice(0, 16000) };
}

async function aiCall(prompt: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`AI gateway failed [${res.status}]`);
  const j: { choices?: Array<{ message?: { content?: string } }> } = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

function parseJson<T>(text: string, fallback: T): T {
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\])/);
  try {
    return JSON.parse(m ? m[1] : text);
  } catch {
    return fallback;
  }
}

export const runMarketValidation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<Result> => {
    const notes: string[] = [];
    try {
      // 1. Search GSA eLibrary + GSA Advantage for price list PDFs matching SIN
      const query = `site:gsaadvantage.gov ${data.sin} price list ${data.lcats.slice(0, 3).join(" ")}`;
      const search = await firecrawlSearch(query, 10);
      const pdfLinks = search
        .filter((r) => r.url && /\.pdf|gsaadvantage\.gov\/ref_text/i.test(r.url))
        .slice(0, 5);

      if (pdfLinks.length === 0) {
        notes.push("No GSA Advantage price-list PDFs found via search. Try broadening SIN/LCAT terms.");
        return { rows: [], contractorsScanned: 0, notes };
      }

      const allRows: Row[] = [];
      for (const link of pdfLinks) {
        const { markdown } = await firecrawlScrape(link.url);
        if (!markdown.trim()) {
          notes.push(`Could not extract ${link.url}`);
          continue;
        }
        const contractor = link.title || link.url.split("/").pop() || "Unknown";

        const prompt = `Extract GSA Schedule pricing rows from this price-list document. Focus on SIN ${data.sin}${data.lcats.length ? ` and Labor Categories matching: ${data.lcats.join(", ")}` : ""}.

For each pricing row return: sin, laborCategory, unitOfIssue (e.g. "Hour", "Each"), netPrice (the GSA Net Price INCLUDING IFF, as a string like "$185.50").

Respond with ONLY a JSON array. Return [] if no matching rows.

Document:
${markdown}`;
        const text = await aiCall(prompt);
        const extracted = parseJson<Array<{ sin: string; laborCategory: string; unitOfIssue: string; netPrice: string }>>(text, []);
        for (const row of extracted) {
          allRows.push({
            sin: row.sin || data.sin,
            laborCategory: String(row.laborCategory || "").slice(0, 200),
            unitOfIssue: String(row.unitOfIssue || "").slice(0, 40),
            netPrice: String(row.netPrice || "").slice(0, 40),
            contractor: contractor.slice(0, 120),
            contractNumber: (link.url.match(/[A-Z0-9]{8,}/)?.[0] || "").slice(0, 40),
            sourceUrl: link.url,
            needsReview: !row.netPrice || !row.laborCategory,
          });
        }
      }

      if (allRows.length === 0) {
        notes.push("PDFs were scanned but no clean pricing rows could be extracted. Open source URLs manually to review.");
      }

      return { rows: allRows, contractorsScanned: pdfLinks.length, notes };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("runMarketValidation error:", msg);
      return { rows: [], contractorsScanned: 0, notes, error: msg };
    }
  });
