import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  completeAutomationRun,
  failAutomationRun,
  requireAutomationAdminAccess,
  saveMarketValidationResults,
  startAutomationRun,
} from "./automation-runs";
import type { MarketRow, PriceListLcat } from "./automation-store";
import {
  buildCalcBenchmarkRows,
  buildCalcPricingUrl,
  buildCalcQrUrl,
  normalizeCalcPricingResponse,
  type CalcBenchmark,
} from "./calc-pricing";

const InputSchema = z.object({
  offerId: z.string().min(1).optional(),
  sin: z.string().min(1).max(20),
  lcats: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        rate: z.string().max(40).optional(),
        unit: z.string().max(40).optional(),
        sin: z.string().max(20).optional(),
      }),
    )
    .min(1)
    .max(50),
});

type Result = {
  rows: MarketRow[];
  benchmarks: CalcBenchmark[];
  notes: string[];
  runId?: string;
  error?: string;
};

export const runCalcPricingBenchmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ context, data }): Promise<Result> => {
    const notes: string[] = [];
    let run: { id: string } | null = null;
    const sourceUrls = new Set<string>(["https://buy.gsa.gov/pricing/"]);

    try {
      if (data.offerId) {
        await requireAutomationAdminAccess(context.supabase, data.offerId);
        try {
          run = await startAutomationRun({
            offerId: data.offerId,
            module: "market_validation",
            input: { source: "GSA CALC", sin: data.sin, lcats: data.lcats },
            sourceUrls: Array.from(sourceUrls),
          });
        } catch (e) {
          notes.push(
            `Automation run logging unavailable: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      const benchmarks: CalcBenchmark[] = [];
      for (const lcat of data.lcats) {
        const sourceUrl = buildCalcQrUrl({ laborCategory: lcat.title, sin: lcat.sin || data.sin });
        sourceUrls.add(sourceUrl);

        try {
          const url = buildCalcPricingUrl({
            laborCategory: lcat.title,
            sin: lcat.sin || data.sin,
            pageSize: 20,
          });
          const response = await fetch(url, {
            headers: { Accept: "application/json" },
          });
          if (!response.ok) {
            notes.push(`[${lcat.title}] CALC lookup failed with status ${response.status}.`);
            continue;
          }
          const body = await response.json();
          const benchmark = normalizeCalcPricingResponse({
            laborCategory: lcat.title,
            clientRate: lcat.rate,
            response: body,
            sourceUrl,
          });
          benchmarks.push(benchmark);

          if (benchmark.comparables.length === 0) {
            notes.push(`[${lcat.title}] CALC returned no comparable MAS ceiling-rate rows.`);
          } else {
            notes.push(
              `[${lcat.title}] CALC found ${benchmark.count} comparable row${
                benchmark.count === 1 ? "" : "s"
              }.`,
            );
          }
        } catch (e) {
          notes.push(
            `[${lcat.title}] CALC lookup failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      const rows = buildCalcBenchmarkRows({
        sin: data.sin,
        lcats: data.lcats as PriceListLcat[],
        benchmarks,
      });

      if (run && data.offerId) {
        await saveMarketValidationResults({ runId: run.id, offerId: data.offerId, rows });
        await completeAutomationRun({
          runId: run.id,
          metrics: {
            source: "GSA CALC",
            lcats: data.lcats.length,
            rows: rows.length,
            benchmarks: benchmarks.length,
            notes: notes.length,
          },
          sourceUrls: Array.from(sourceUrls),
          needsReview: rows.some((row) => row.needsReview),
        });
      }

      return { rows, benchmarks, notes, runId: run?.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (run) {
        try {
          await failAutomationRun({ runId: run.id, error: e });
        } catch (logError) {
          notes.push(
            `Automation run failure logging unavailable: ${
              logError instanceof Error ? logError.message : String(logError)
            }`,
          );
        }
      }
      console.error("runCalcPricingBenchmark error:", msg);
      return { rows: [], benchmarks: [], notes, runId: run?.id, error: msg };
    }
  });
