import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  sin: z.string().min(1).max(20),
  lcats: z.array(z.string().min(1).max(200)).min(1).max(50),
});

type Row = {
  sin: string;
  clientLcat: string;
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

async function benchmarkOneLcat(sin: string, lcat: string, notes: string[]): Promise<{ rows: Row[]; scanned: number }> {
  // Build a targeted query for this single LCAT. Restrict to ACTIVE contracts only —
  // GSA Advantage lists both current and expired vendors; expired pricing is not a
  // valid benchmark for a new offer.
  const query = `site:gsaadvantage.gov ${sin} "${lcat}" price list active contract`;
  let search: Array<{ url: string; title?: string; description?: string }> = [];
  try {
    search = await firecrawlSearch(query, 6);
  } catch (e) {
    notes.push(`[${lcat}] search failed: ${e instanceof Error ? e.message : String(e)}`);
    return { rows: [], scanned: 0 };
  }

  const pdfLinks = search
    .filter((r) => r.url && /\.pdf|gsaadvantage\.gov\/ref_text/i.test(r.url))
    .slice(0, 5);

  if (pdfLinks.length === 0) {
    notes.push(`[${lcat}] no GSA Advantage results matched.`);
    return { rows: [], scanned: 0 };
  }


  const rows: Row[] = [];
  for (const link of pdfLinks) {
    const { markdown } = await firecrawlScrape(link.url);
    if (!markdown.trim()) continue;
    const contractor = link.title || link.url.split("/").pop() || "Unknown";

    const prompt = `Extract GSA Schedule pricing rows from the document below. ONLY return rows whose Labor Category is an equivalent of "${lcat}" under SIN ${sin}. An equivalent includes the same role title or a clearly synonymous title at a matching seniority level. Do NOT return unrelated LCATs.

CRITICAL — CONTRACT MUST BE ACTIVE: Inspect the document for the contract's period of performance / expiration / end date. If the contract is EXPIRED (end date is in the past relative to today, or the document is marked cancelled / terminated / not current), return [] and do NOT extract any rows. Expired pricing is not a valid market benchmark.

For each matching row from an active contract return: laborCategory (exact title as printed), unitOfIssue (e.g. "Hour"), netPrice (GSA Net Price INCLUDING IFF, e.g. "$185.50").

Respond with ONLY a JSON array. Return [] if no matching rows or the contract is expired.

Document:
${markdown}`;
    let text = "";
    try {
      text = await aiCall(prompt);
    } catch (e) {
      notes.push(`[${lcat}] extract failed for ${link.url}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const extracted = parseJson<Array<{ laborCategory: string; unitOfIssue: string; netPrice: string }>>(text, []);
    if (extracted.length === 0) {
      notes.push(`[${lcat}] ${link.url} skipped — no active-contract matches.`);
    }
    for (const row of extracted) {
      rows.push({
        sin,
        clientLcat: lcat,
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


  if (rows.length === 0) {
    notes.push(`[${lcat}] ${pdfLinks.length} PDF(s) scanned but no comparable rows extracted.`);
  }

  return { rows, scanned: pdfLinks.length };
}

export const runMarketValidation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<Result> => {
    const notes: string[] = [];
    try {
      // Iterate per LCAT so each unique offering gets its own benchmark.
      // Run sequentially to stay polite to the upstream APIs.
      const all: Row[] = [];
      let totalScanned = 0;
      for (const lcat of data.lcats) {
        const { rows, scanned } = await benchmarkOneLcat(data.sin, lcat, notes);
        all.push(...rows);
        totalScanned += scanned;
      }
      return { rows: all, contractorsScanned: totalScanned, notes };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("runMarketValidation error:", msg);
      return { rows: [], contractorsScanned: 0, notes, error: msg };
    }
  });
