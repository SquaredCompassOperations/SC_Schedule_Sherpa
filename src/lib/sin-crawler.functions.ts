import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  url: z.string().url().max(500),
});

type SinCandidate = {
  code: string;
  title: string;
  confidence: number;
  rationale: string;
  source: string;
};

type CrawlResult = {
  keywords: string[];
  summary: string;
  candidates: SinCandidate[];
  error?: string;
};

async function firecrawlScrape(url: string): Promise<{ markdown: string; title: string }> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY not configured");
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  if (!res.ok) throw new Error(`Firecrawl scrape failed [${res.status}]: ${await res.text()}`);
  const j: any = await res.json();
  const data = j.data ?? j;
  return { markdown: (data.markdown || "").slice(0, 8000), title: data.metadata?.title || "" };
}

async function firecrawlSearch(query: string, limit = 5): Promise<Array<{ url: string; title: string; description: string }>> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY not configured");
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) throw new Error(`Firecrawl search failed [${res.status}]: ${await res.text()}`);
  const j: any = await res.json();
  const results = j.data?.web ?? j.web ?? j.data ?? [];
  return Array.isArray(results)
    ? results.map((r: any) => ({ url: r.url, title: r.title || "", description: r.description || r.snippet || "" }))
    : [];
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
  if (!res.ok) throw new Error(`AI gateway failed [${res.status}]: ${await res.text()}`);
  const j: any = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

function parseJson<T>(text: string, fallback: T): T {
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  try {
    return JSON.parse(m ? m[1] : text);
  } catch {
    return fallback;
  }
}

export const crawlClientForSins = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<CrawlResult> => {
    try {
      // 1. Scrape client website
      const { markdown, title } = await firecrawlScrape(data.url);
      if (!markdown.trim()) {
        return { keywords: [], summary: "", candidates: [], error: "No content scraped from URL" };
      }

      // 2. Extract keywords + business summary via AI
      const extraction = await aiCall(
        `You are a GSA Schedule analyst. Read this company website content and respond with ONLY a JSON object:
{"summary": "<1-sentence description of what they sell/do>", "keywords": ["<10-15 short procurement-relevant keywords/phrases>"]}

Website: ${title}
Content:
${markdown}`,
      );
      const extracted = parseJson<{ summary: string; keywords: string[] }>(extraction, {
        summary: "",
        keywords: [],
      });

      if (extracted.keywords.length === 0) {
        return { keywords: [], summary: extracted.summary, candidates: [], error: "Could not extract keywords" };
      }

      // 3. Search GSA eLibrary for SINs matching keywords
      const query = `site:gsaelibrary.gsa.gov SIN ${extracted.keywords.slice(0, 6).join(" ")}`;
      let searchResults: Array<{ url: string; title: string; description: string }> = [];
      try {
        searchResults = await firecrawlSearch(query, 8);
      } catch (e) {
        console.error("eLibrary search failed:", e);
      }

      // 4. Ask AI to rank/recommend SINs based on extracted keywords + search results
      const ranking = await aiCall(
        `You are a GSA MAS Schedule expert. Based on this company profile and GSA eLibrary search results, recommend the most applicable Special Item Numbers (SINs).

Company summary: ${extracted.summary}
Keywords: ${extracted.keywords.join(", ")}

eLibrary search results:
${searchResults.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description}`).join("\n\n") || "(no results)"}

Respond with ONLY a JSON array of 4-6 SIN candidates, ordered by relevance:
[{"code": "<SIN code like 54151S>", "title": "<official SIN title>", "confidence": <0-100>, "rationale": "<1 sentence why it fits>", "source": "<eLibrary URL or 'GSA MAS knowledge'>"}]

Use your knowledge of current GSA MAS SINs even if not in search results. Be specific — prefer narrow SINs over broad ones.`,
      );
      const candidates = parseJson<SinCandidate[]>(ranking, []);

      return {
        keywords: extracted.keywords,
        summary: extracted.summary,
        candidates: Array.isArray(candidates) ? candidates : [],
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("crawlClientForSins error:", msg);
      return { keywords: [], summary: "", candidates: [], error: msg };
    }
  });
