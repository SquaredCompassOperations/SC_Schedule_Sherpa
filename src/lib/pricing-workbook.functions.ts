import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import ExcelJS from "exceljs";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  completeAutomationRun,
  failAutomationRun,
  requireAutomationAdminAccess,
  savePricingWorkbookOutput,
  startAutomationRun,
} from "./automation-runs";

const InputSchema = z.object({
  offerId: z.string().min(1).optional(),
  template: z.enum(["fcp-product", "fcp-services-plus"]),
  sins: z.array(z.string().min(1).max(20)).min(1).max(50),
  rows: z
    .array(
      z.object({
        sin: z.string().max(20),
        title: z.string().max(200),
        description: z.string().max(1000).optional().default(""),
        keywords: z.string().max(600).optional().default(""),
        minimumEducation: z.string().max(40).optional().default(""),
        minimumYearsExperience: z.string().max(10).optional().default(""),
        unitOfMeasure: z.string().max(20).optional().default("Hour"),
        price: z.string().max(40),
        scaLaborCategory: z.string().max(200).optional().default(""),
        wageDeterminationTable: z.string().max(80).optional().default(""),
      }),
    )
    .min(1)
    .max(500),
  companyName: z.string().max(200).optional().default(""),
});

type Output = {
  filename: string;
  base64: string;
  templateRefresh: string;
  rowCount: number;
  error?: string;
};

const OFFICIAL_TEMPLATE_URLS = {
  "fcp-product":
    "https://www.gsa.gov/system/files/5.13.2026%20FCP%20Product%20File%20-%20New%20Offer%20-%20Refresh%2032_0.xlsx",
  "fcp-services-plus":
    "https://www.gsa.gov/system/files/6.12.2026%20FCP_Services_Plus_File_Refresh_32_FINAL.xlsx",
} as const;

async function loadTemplate(filename: string): Promise<ArrayBuffer> {
  // Server fn runs same-origin; fetch the bundled public asset.
  const req = getRequest();
  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/templates/${filename}`);
  if (!res.ok) throw new Error(`Failed to load template ${filename} [${res.status}]`);
  return res.arrayBuffer();
}

function parsePrice(value: string): number {
  return parseFloat(value.replace(/[$,]/g, "")) || 0;
}

export const generatePricingWorkbook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ context, data }): Promise<Output> => {
    let run: { id: string } | null = null;
    try {
      const isProduct = data.template === "fcp-product";
      const templateFile = isProduct ? "fcp-product-r32.xlsx" : "fcp-services-plus-r32.xlsx";
      if (data.offerId) {
        await requireAutomationAdminAccess(context.supabase, data.offerId);
        try {
          run = await startAutomationRun({
            offerId: data.offerId,
            module: "pricing_workbook",
            input: {
              template: data.template,
              sins: data.sins,
              rowCount: data.rows.length,
              companyName: data.companyName,
            },
            sourceUrls: [OFFICIAL_TEMPLATE_URLS[data.template]],
          });
        } catch (err) {
          console.warn("Pricing workbook automation run logging unavailable:", err);
        }
      }
      const buf = await loadTemplate(templateFile);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);

      if (isProduct) {
        const ws = wb.getWorksheet("PRODUCTS");
        if (!ws) throw new Error("PRODUCTS sheet missing");
        // Headers at row 2; example dummy data starts at row 3. Overwrite from row 3.
        let writeRow = 3;
        for (const r of data.rows) {
          ws.getCell(writeRow, 1).value = "B"; // base product
          ws.getCell(writeRow, 5).value = r.sin;
          ws.getCell(writeRow, 6).value = r.title;
          ws.getCell(writeRow, 7).value = r.description;
          ws.getCell(writeRow, 9).value = r.unitOfMeasure || "EA";
          // GSA net price column varies; common location is mfn_price or awarded_price
          ws.getCell(writeRow, 14).value = parsePrice(r.price);
          writeRow++;
        }
      } else {
        const ws = wb.getWorksheet("Pricing");
        if (!ws) throw new Error("Pricing sheet missing");
        // Headers at row 2; "do not delete" comments at row 3; dummy example at row 4.
        let writeRow = 4;
        for (const r of data.rows) {
          ws.getCell(writeRow, 1).value = `${data.companyName.replace(/\W+/g, "-")}-${writeRow}`; // unique_catalog_item_id
          ws.getCell(writeRow, 2).value = r.sin; // sin_comma_separated
          ws.getCell(writeRow, 3).value = "Commercial_Labor_Category"; // catalog_item_type
          ws.getCell(writeRow, 4).value = r.title;
          ws.getCell(writeRow, 5).value = r.description;
          ws.getCell(writeRow, 6).value = r.keywords;
          ws.getCell(writeRow, 7).value = r.minimumEducation || "Bachelors";
          ws.getCell(writeRow, 8).value = parseFloat(r.minimumYearsExperience) || 0;
          ws.getCell(writeRow, 15).value = r.unitOfMeasure || "Hour";
          ws.getCell(writeRow, 16).value = parsePrice(r.price);
          ws.getCell(writeRow, 22).value = parsePrice(r.price);
          if (r.scaLaborCategory) {
            ws.getCell(writeRow, 45).value = r.scaLaborCategory;
            ws.getCell(writeRow, 46).value = r.wageDeterminationTable || "";
          }
          writeRow++;
        }
      }

      const out = await wb.xlsx.writeBuffer();
      const base64 = Buffer.from(out).toString("base64");
      const filename = `${data.companyName || "offer"}_${data.template}_filled.xlsx`.replace(
        /\s+/g,
        "_",
      );

      if (run && data.offerId) {
        const rowsWithMissingPrice = data.rows.filter((row) => parsePrice(row.price) <= 0).length;
        await savePricingWorkbookOutput({
          runId: run.id,
          offerId: data.offerId,
          templateKind: data.template,
          templateRefresh: "32",
          filename,
          rowCount: data.rows.length,
          sourceTemplateUrl: OFFICIAL_TEMPLATE_URLS[data.template],
          outputSummary: {
            sins: data.sins,
            scaRows: data.rows.filter((row) => row.scaLaborCategory).length,
            commercialRows: data.rows.filter((row) => !row.scaLaborCategory).length,
            rowsWithMissingPrice,
          },
          needsReview: rowsWithMissingPrice > 0,
        });
        await completeAutomationRun({
          runId: run.id,
          metrics: {
            rows: data.rows.length,
            template: data.template,
            refresh: "32",
          },
          sourceUrls: [OFFICIAL_TEMPLATE_URLS[data.template]],
          needsReview: rowsWithMissingPrice > 0,
        });
      }

      return { filename, base64, templateRefresh: "32", rowCount: data.rows.length };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (run) {
        try {
          await failAutomationRun({ runId: run.id, error: e });
        } catch (logError) {
          console.warn("Pricing workbook automation run failure logging unavailable:", logError);
        }
      }
      console.error("generatePricingWorkbook error:", msg);
      return { filename: "", base64: "", templateRefresh: "32", rowCount: 0, error: msg };
    }
  });
