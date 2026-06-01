import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway";

export type SbaCert = { program: string; status: string; expiration?: string };

const SBA_PROFILE_URL = (uei: string) =>
  `https://search.certifications.sba.gov/profile/${encodeURIComponent(uei)}`;

const EXTRACT_SYSTEM =
  'Extract active SBA certifications visible in the supplied content (markdown of an SBA Small Business Search profile page, or a screenshot of one). Output ONLY a JSON array — no prose, no fences. Each element: {"program": string (e.g. "8(a)","WOSB","EDWOSB","HUBZone","SDVOSB","VOSB"), "status": "Active"|"Expired"|"Pending", "expiration": "YYYY-MM-DD"|null}. If no certifications are visible, output []. Do not invent values.';

async function parseCertsFromText(text: string): Promise<SbaCert[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const gateway = createLovableAiGatewayProvider(key);
  const model = gateway("google/gemini-2.5-flash-lite");
  const { text: out } = await generateText({
    model,
    system: EXTRACT_SYSTEM,
    prompt: text.slice(0, 60_000),
  });
  return safeParseCerts(out);
}

function safeParseCerts(raw: string): SbaCert[] {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((c) => c && typeof c.program === "string")
      .map((c) => ({
        program: String(c.program),
        status: String(c.status ?? "Active"),
        expiration: c.expiration ? String(c.expiration) : undefined,
      }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 1) Firecrawl-backed scrape — renders the SPA, returns markdown, Gemini parses.
// ---------------------------------------------------------------------------

export const lookupSbaCertifications = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ uei: z.string().min(4).max(20) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ certs: SbaCert[]; source: string; error?: string }> => {
    const url = SBA_PROFILE_URL(data.uei);
    const fcKey = process.env.FIRECRAWL_API_KEY;
    if (!fcKey) {
      return { certs: [], source: url, error: "FIRECRAWL_API_KEY not configured" };
    }

    try {
      const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${fcKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          waitFor: 5000,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { certs: [], source: url, error: `Firecrawl ${res.status}: ${body.slice(0, 200)}` };
      }
      const payload = (await res.json()) as {
        success?: boolean;
        data?: { markdown?: string };
        markdown?: string;
        error?: string;
      };
      const md = payload?.data?.markdown ?? payload?.markdown ?? "";
      if (!md) {
        return { certs: [], source: url, error: payload?.error ?? "Empty Firecrawl response" };
      }
      const certs = await parseCertsFromText(md);
      return { certs, source: url };
    } catch (err) {
      return {
        certs: [],
        source: url,
        error: err instanceof Error ? err.message : "Firecrawl request failed",
      };
    }
  });

// ---------------------------------------------------------------------------
// 2) Screenshot fallback — user uploads a screenshot of the SBA profile row,
//    Gemini vision extracts the cert badges.
// ---------------------------------------------------------------------------

export const extractSbaCertsFromImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        filename: z.string().min(1).max(255),
        mediaType: z.string().min(1).max(128),
        dataBase64: z.string().min(1).max(20_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ certs: SbaCert[]; error?: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { certs: [], error: "LOVABLE_API_KEY not configured" };
    try {
      const gateway = createLovableAiGatewayProvider(key);
      const model = gateway("google/gemini-2.5-flash");
      const bytes = Buffer.from(data.dataBase64, "base64");
      const { text } = await generateText({
        model,
        system: EXTRACT_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract active SBA certifications visible in the image "${data.filename}". Each green/blue badge under "Active SBA certifications" is one entry. Output strict JSON array only.`,
              },
              { type: "file", data: bytes, mediaType: data.mediaType },
            ],
          },
        ],
      });
      return { certs: safeParseCerts(text) };
    } catch (err) {
      return {
        certs: [],
        error: err instanceof Error ? err.message : "Image extraction failed",
      };
    }
  });
