import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway";

export type SbaCert = { program: string; status: string; expiration?: string };

// Best-effort: fetch SBA Small Business Search results for the given UEI and
// parse active certifications. The page is rendered server-side with results
// embedded; if the structure changes we fall back to AI parsing of the HTML.
export const lookupSbaCertifications = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ uei: z.string().min(4).max(20) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ certs: SbaCert[]; source: string; error?: string }> => {
    const url = `https://search.certifications.sba.gov/profile/${encodeURIComponent(data.uei)}`;
    let html = "";
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 ScheduleBuilder Intake Bot" },
      });
      html = await res.text();
      if (!res.ok) {
        return { certs: [], source: url, error: `SBA search returned ${res.status}` };
      }
    } catch (err) {
      return {
        certs: [],
        source: url,
        error: err instanceof Error ? err.message : "Fetch failed",
      };
    }

    // Hand the HTML to the LLM to extract active certifications. Cheap, robust
    // to layout shifts vs brittle regex.
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { certs: [], source: url, error: "LOVABLE_API_KEY not configured" };

    try {
      const gateway = createLovableAiGatewayProvider(key);
      const model = gateway("google/gemini-2.5-flash-lite");
      const snippet = html.slice(0, 60_000);
      const { text } = await generateText({
        model,
        system:
          'Extract active SBA certifications from the supplied HTML of an SBA Small Business Search profile page. Output ONLY a JSON array (no prose, no fences). Each element: {"program": string (e.g. "8(a)", "WOSB", "EDWOSB", "HUBZone", "SDVOSB", "VOSB"), "status": "Active" | "Expired" | "Pending", "expiration": "YYYY-MM-DD" | null}. If no certifications are visible or the profile is not found, output [].',
        prompt: snippet,
      });
      const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const arr = JSON.parse(cleaned);
      const certs: SbaCert[] = Array.isArray(arr)
        ? arr
            .filter((c) => c && typeof c.program === "string")
            .map((c) => ({
              program: String(c.program),
              status: String(c.status ?? "Unknown"),
              expiration: c.expiration ? String(c.expiration) : undefined,
            }))
        : [];
      return { certs, source: url };
    } catch (err) {
      return {
        certs: [],
        source: url,
        error: err instanceof Error ? err.message : "Parse failed",
      };
    }
  });
