import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import scaData from "./sca-occupations.json";
import { generateTextFromPrompt } from "./gemini-service";
import {
  completeAutomationRun,
  failAutomationRun,
  requireAutomationAdminAccess,
  saveScaLcatMatches,
  startAutomationRun,
} from "./automation-runs";

const InputSchema = z.object({
  offerId: z.string().min(1).optional(),
  sins: z
    .array(z.object({ code: z.string(), title: z.string() }))
    .min(1)
    .max(20),
  businessSummary: z.string().max(2000).optional(),
  lcats: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
      }),
    )
    .max(100)
    .optional(),
});

type Suggestion = {
  code: string;
  title: string;
  family: string;
  confidence: number;
  rationale: string;
};

type RawScaMatch = {
  clientLcat?: string;
  code?: string | null;
  confidence?: number;
  rationale?: string;
  matchStatus?: "matched" | "no_equivalent" | "needs_review";
};

async function aiCall(prompt: string): Promise<string> {
  return generateTextFromPrompt({ prompt });
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ suggestions: Suggestion[]; error?: string }> => {
    let run: { id: string } | null = null;
    try {
      if (data.offerId) {
        await requireAutomationAdminAccess(context.supabase, data.offerId);
        try {
          run = await startAutomationRun({
            offerId: data.offerId,
            module: "sca_lcat_confirmation",
            input: {
              sins: data.sins,
              lcats: data.lcats ?? [],
              businessSummary: data.businessSummary ?? null,
            },
            sourceUrls: [SCA_DIRECTORY_URL],
          });
        } catch (err) {
          console.warn("SCA automation run logging unavailable:", err);
        }
      }
      const catalog = scaData.occupations
        .map((o) => `${o.code} | ${o.title} (${o.family})`)
        .join("\n");
      const sinList = data.sins.map((s) => `${s.code} — ${s.title}`).join("\n");
      const lcatList = (data.lcats ?? [])
        .map((l) => `- ${l.title}${l.description ? `: ${l.description}` : ""}`)
        .join("\n");
      const prompt = `You are a GSA Schedule analyst mapping SCA Labor Categories from the DOL SCA Directory of Occupations (Fifth Edition) to a contractor's proposed SINs.

Proposed SINs:
${sinList}

Client LCATs / offerings from the commercial price list:
${lcatList || "(not provided)"}

Business summary: ${data.businessSummary || "(not provided)"}

Below is the catalog of SCA occupation codes available. Pick ONLY codes from this list.

If client LCATs are provided, evaluate EVERY client LCAT / offering exactly once. Return the original clientLcat string, the best SCA code when one exists, matchStatus "matched" when confidence is 80 or higher, "needs_review" when there may be a fit but confidence is below 80, and "no_equivalent" with code null when the role is commercial or no SCA equivalent applies.

If no client LCATs are provided, return 5-15 best SCA matches for the SINs and business profile.

Catalog:
${catalog}

Respond with ONLY a JSON array (no prose):
[{"clientLcat": "<original client LCAT when provided>", "code": "<exact code from catalog or null>", "matchStatus": "matched|needs_review|no_equivalent", "confidence": <0-100>, "rationale": "<1 sentence>"}]`;

      const text = await aiCall(prompt);
      const raw = parseJson<RawScaMatch[]>(text, []);

      const byCode = new Map(scaData.occupations.map((o) => [o.code, o]));
      const suggestions: Suggestion[] = raw
        .map((r) => {
          const occ = typeof r.code === "string" ? byCode.get(r.code) : null;
          if (!occ) return null;
          return {
            code: occ.code,
            title: occ.title,
            family: occ.family,
            confidence: Math.max(0, Math.min(100, Math.round(r.confidence ?? 0))),
            rationale: String(r.rationale || "").slice(0, 300),
          };
        })
        .filter((x): x is Suggestion => x !== null)
        .sort((a, b) => b.confidence - a.confidence);

      if (run && data.offerId) {
        const inputLcats = data.lcats ?? [];
        const rawByClientLcat = new Map(
          raw
            .filter((r) => r.clientLcat)
            .map((r) => [String(r.clientLcat).trim().toLowerCase(), r]),
        );
        const matches =
          inputLcats.length > 0
            ? inputLcats.map((lcat) => {
                const rawMatch = rawByClientLcat.get(lcat.title.trim().toLowerCase());
                const rawCode = rawMatch?.code ?? null;
                const occ = typeof rawCode === "string" ? byCode.get(rawCode) : null;
                const confidence = Math.max(
                  0,
                  Math.min(100, Math.round(rawMatch?.confidence ?? 0)),
                );
                const matchStatus =
                  rawMatch?.matchStatus ??
                  (occ
                    ? confidence >= 80
                      ? ("matched" as const)
                      : ("needs_review" as const)
                    : ("no_equivalent" as const));
                return {
                  clientLcat: lcat.title,
                  clientDescription: lcat.description ?? data.businessSummary,
                  matchStatus: occ ? matchStatus : ("no_equivalent" as const),
                  scaCode: occ?.code ?? null,
                  scaTitle: occ?.title ?? null,
                  scaFamily: occ?.family ?? null,
                  confidence,
                  rationale:
                    rawMatch?.rationale ?? "No SCA equivalent identified for this client LCAT.",
                  sourceUrl: SCA_DIRECTORY_URL,
                  wageDeterminationTable: null,
                };
              })
            : suggestions.map((suggestion) => ({
                clientLcat: suggestion.title,
                clientDescription: data.businessSummary,
                matchStatus:
                  suggestion.confidence >= 80 ? ("matched" as const) : ("needs_review" as const),
                scaCode: suggestion.code,
                scaTitle: suggestion.title,
                scaFamily: suggestion.family,
                confidence: suggestion.confidence,
                rationale: suggestion.rationale,
                sourceUrl: SCA_DIRECTORY_URL,
                wageDeterminationTable: null,
              }));
        await saveScaLcatMatches({ runId: run.id, offerId: data.offerId, matches });
        await completeAutomationRun({
          runId: run.id,
          metrics: {
            suggestions: suggestions.length,
            inputLcats: inputLcats.length,
            noEquivalent: matches.filter((match) => match.matchStatus === "no_equivalent").length,
            lowConfidence: matches.filter((match) => (match.confidence ?? 0) < 80).length,
          },
          sourceUrls: [SCA_DIRECTORY_URL],
          needsReview:
            matches.length === 0 ||
            matches.some(
              (match) => match.matchStatus !== "matched" || (match.confidence ?? 0) < 80,
            ),
        });
      }

      return { suggestions };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (run) {
        try {
          await failAutomationRun({ runId: run.id, error: e });
        } catch (logError) {
          console.warn("SCA automation run failure logging unavailable:", logError);
        }
      }
      console.error("suggestScaLcats error:", msg);
      return { suggestions: [], error: msg };
    }
  });

export const SCA_DIRECTORY_URL =
  "https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/SCADirectVers5.pdf";
