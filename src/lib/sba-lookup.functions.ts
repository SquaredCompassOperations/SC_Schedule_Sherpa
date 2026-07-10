import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway";
import {
  completeAutomationRun,
  failAutomationRun,
  requireAutomationAdminAccess,
  saveSbaCertificationResults,
  startAutomationRun,
} from "./automation-runs";

export type SbaCert = { program: string; status: string; expiration?: string };

// ---------------------------------------------------------------------------
// 1) Direct profile lookup — calls the SBA Small Business Search internal
//    JSON API. Returns clean, structured cert data without scraping or AI.
//    Requires UEI + CAGE code (both surfaced from SAM.gov extraction in Step 1).
// ---------------------------------------------------------------------------

const SBA_PROFILE_API = (uei: string, cage: string) =>
  `https://search.certifications.sba.gov/_api/v2/profile/${encodeURIComponent(uei)}/${encodeURIComponent(cage)}`;

type SbaProfileEntity = {
  certs?: Array<{
    name?: string;
    status?: string;
    active?: boolean;
    entranceDate?: string;
    exitDate?: string;
  }>;
};

export const lookupSbaCertifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        offerId: z.string().min(1).optional(),
        uei: z.string().min(4).max(20),
        cageCode: z.string().min(3).max(10).optional(),
      })
      .parse(input),
  )
  .handler(
    async ({ context, data }): Promise<{ certs: SbaCert[]; source: string; error?: string }> => {
      if (!data.cageCode) {
        return {
          certs: [],
          source: "",
          error:
            "CAGE code is required for the SBA profile lookup. Add it to Step 1 (it appears on the SAM.gov profile next to the UEI), then re-run.",
        };
      }
      const url = SBA_PROFILE_API(data.uei, data.cageCode);
      let run: { id: string } | null = null;
      try {
        if (data.offerId) {
          await requireAutomationAdminAccess(context.supabase, data.offerId);
          try {
            run = await startAutomationRun({
              offerId: data.offerId,
              module: "sba_status",
              input: { uei: data.uei, cageCode: data.cageCode },
              sourceUrls: [url],
            });
          } catch (err) {
            console.warn("SBA automation run logging unavailable:", err);
          }
        }
        const res = await fetch(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; MAS-Pilot/1.0; +https://mas-pilot.lovable.app)",
          },
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          if (run) {
            try {
              await failAutomationRun({
                runId: run.id,
                error: `SBA profile API ${res.status}: ${body.slice(0, 200) || res.statusText}`,
              });
            } catch (logError) {
              console.warn("SBA automation run failure logging unavailable:", logError);
            }
          }
          return {
            certs: [],
            source: url,
            error: `SBA profile API ${res.status}: ${body.slice(0, 200) || res.statusText}`,
          };
        }
        const payload = (await res.json()) as { entity?: SbaProfileEntity };
        const raw = payload?.entity?.certs ?? [];
        const certs: SbaCert[] = raw
          .filter((c) => c && typeof c.name === "string")
          .map((c) => ({
            program: String(c.name),
            status: String(c.status ?? (c.active ? "Active" : "Inactive")),
            expiration: c.exitDate || undefined,
          }));
        if (run && data.offerId) {
          await saveSbaCertificationResults({
            runId: run.id,
            offerId: data.offerId,
            uei: data.uei,
            cageCode: data.cageCode,
            sourceUrl: url,
            evidenceType: "sba_profile",
            certs,
          });
          await completeAutomationRun({
            runId: run.id,
            metrics: { certifications: certs.length, evidenceType: "sba_profile" },
            sourceUrls: [url],
            needsReview: certs.length === 0,
          });
        }
        return { certs, source: url };
      } catch (err) {
        if (run) {
          try {
            await failAutomationRun({ runId: run.id, error: err });
          } catch (logError) {
            console.warn("SBA automation run failure logging unavailable:", logError);
          }
        }
        return {
          certs: [],
          source: url,
          error: err instanceof Error ? err.message : "SBA profile request failed",
        };
      }
    },
  );

// ---------------------------------------------------------------------------
// 2) Screenshot fallback — user uploads a screenshot of the SBA profile row,
//    Gemini vision extracts the cert badges. Used when CAGE is unknown or the
//    direct API fails for any reason.
// ---------------------------------------------------------------------------

const EXTRACT_SYSTEM =
  'Extract active SBA certifications visible in the supplied screenshot of an SBA Small Business Search profile. Output ONLY a JSON array — no prose, no fences. Each element: {"program": string (e.g. "8(a)","WOSB","EDWOSB","HUBZone","SDVOSB","VOSB"), "status": "Active"|"Expired"|"Pending", "expiration": "YYYY-MM-DD"|null}. If no certifications are visible, output []. Do not invent values.';

function safeParseCerts(raw: string): SbaCert[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
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

export const extractSbaCertsFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        offerId: z.string().min(1).optional(),
        uei: z.string().min(4).max(20).optional(),
        cageCode: z.string().min(3).max(10).optional(),
        filename: z.string().min(1).max(255),
        mediaType: z.string().min(1).max(128),
        dataBase64: z.string().min(1).max(20_000_000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ certs: SbaCert[]; error?: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { certs: [], error: "LOVABLE_API_KEY not configured" };
    let run: { id: string } | null = null;
    try {
      if (data.offerId) {
        await requireAutomationAdminAccess(context.supabase, data.offerId);
        try {
          run = await startAutomationRun({
            offerId: data.offerId,
            module: "sba_status",
            input: {
              uei: data.uei ?? null,
              cageCode: data.cageCode ?? null,
              filename: data.filename,
            },
            sourceUrls: [],
          });
        } catch (err) {
          console.warn("SBA screenshot automation run logging unavailable:", err);
        }
      }
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
                text: `Extract active SBA certifications visible in the image "${data.filename}". Each green/blue badge under "Active SBA certifications" / "Current SBA certifications" is one entry. Output strict JSON array only.`,
              },
              { type: "file", data: bytes, mediaType: data.mediaType },
            ],
          },
        ],
      });
      const certs = safeParseCerts(text);
      if (run && data.offerId) {
        if (data.uei) {
          await saveSbaCertificationResults({
            runId: run.id,
            offerId: data.offerId,
            uei: data.uei,
            cageCode: data.cageCode,
            sourceUrl: `sba-screenshot:${data.filename}`,
            evidenceType: "screenshot",
            certs,
          });
        }
        await completeAutomationRun({
          runId: run.id,
          metrics: {
            certifications: certs.length,
            evidenceType: "screenshot",
            missingUei: !data.uei,
          },
          sourceUrls: [],
          needsReview: true,
        });
      }
      return { certs };
    } catch (err) {
      if (run) {
        try {
          await failAutomationRun({ runId: run.id, error: err });
        } catch (logError) {
          console.warn("SBA screenshot automation run failure logging unavailable:", logError);
        }
      }
      return {
        certs: [],
        error: err instanceof Error ? err.message : "Image extraction failed",
      };
    }
  });
