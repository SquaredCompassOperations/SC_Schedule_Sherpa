import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import scaData from "./sca-occupations.json";

const InputSchema = z.object({
  sins: z.array(z.object({ code: z.string(), title: z.string() })).min(1).max(20),
  businessSummary: z.string().max(2000).optional(),
});

type Suggestion = {
  code: string;
  title: string;
  family: string;
  confidence: number;
  rationale: string;
};

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

export const suggestScaLcats = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<{ suggestions: Suggestion[]; error?: string }> => {
    try {
      const catalog = scaData.occupations
        .map((o) => `${o.code} | ${o.title} (${o.family})`)
        .join("\n");
      const sinList = data.sins.map((s) => `${s.code} — ${s.title}`).join("\n");
      const prompt = `You are a GSA Schedule analyst mapping SCA Labor Categories from the DOL SCA Directory of Occupations (Fifth Edition) to a contractor's proposed SINs.

Proposed SINs:
${sinList}

Business summary: ${data.businessSummary || "(not provided)"}

Below is the catalog of SCA occupation codes available. Pick ONLY codes from this list that are likely applicable to the proposed SINs and business profile. Prefer specific roles over broad ones. Aim for 5-15 best matches.

Catalog:
${catalog}

Respond with ONLY a JSON array (no prose):
[{"code": "<exact code from catalog>", "confidence": <0-100>, "rationale": "<1 sentence>"}]`;

      const text = await aiCall(prompt);
      const raw = parseJson<Array<{ code: string; confidence: number; rationale: string }>>(text, []);

      const byCode = new Map(scaData.occupations.map((o) => [o.code, o]));
      const suggestions: Suggestion[] = raw
        .map((r) => {
          const occ = byCode.get(r.code);
          if (!occ) return null;
          return {
            code: occ.code,
            title: occ.title,
            family: occ.family,
            confidence: Math.max(0, Math.min(100, Math.round(r.confidence))),
            rationale: String(r.rationale || "").slice(0, 300),
          };
        })
        .filter((x): x is Suggestion => x !== null)
        .sort((a, b) => b.confidence - a.confidence);

      return { suggestions };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("suggestScaLcats error:", msg);
      return { suggestions: [], error: msg };
    }
  });

export const SCA_DIRECTORY_URL =
  "https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/SCADirectVers5.pdf";
