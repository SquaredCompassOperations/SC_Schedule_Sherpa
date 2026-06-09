import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import ExcelJS from "exceljs";
import { getRequest } from "@tanstack/react-start/server";

const InputSchema = z.object({
  template: z.enum(["fcp-product", "fcp-services-plus"]),
  sins: z.array(z.string().min(1).max(20)).min(1).max(50),
  rows: z
    .array(
      z.object({
        sin: z.string().max(20),
        title: z.string().max(200),
        description: z.string().max(1000).optional().default(""),
        minimumEducation: z.string().max(40).optional().default(""),
        minimumYearsExperience: z.string().max(10).optional().default(""),
        unitOfMeasure: z.string().max(20).optional().default("Hour"),
        price: z.string().max(40),
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

async function loadTemplate(filename: string): Promise<ArrayBuffer> {
  // Server fn runs same-origin; fetch the bundled public asset.
  const req = getRequest();
  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/templates/${filename}`);
  if (!res.ok) throw new Error(`Failed to load template ${filename} [${res.status}]`);
  return res.arrayBuffer();
}

export const generatePricingWorkbook = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<Output> => {
    try {
      const isProduct = data.template === "fcp-product";
      const templateFile = isProduct ? "fcp-product-r32.xlsx" : "fcp-services-plus-r32.xlsx";
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
          ws.getCell(writeRow, 14).value = parseFloat(r.price.replace(/[$,]/g, "")) || 0;
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
          ws.getCell(writeRow, 7).value = r.minimumEducation || "Bachelors";
          ws.getCell(writeRow, 8).value = parseFloat(r.minimumYearsExperience) || 0;
          writeRow++;
          // Note: pricing tier rows (price, MFC discount, etc.) typically live in
          // adjacent columns 10+; left for user to complete since they depend on
          // contract-specific commercial price list.
        }
      }

      const out = await wb.xlsx.writeBuffer();
      const base64 = Buffer.from(out).toString("base64");
      const filename = `${data.companyName || "offer"}_${data.template}_filled.xlsx`.replace(/\s+/g, "_");

      return { filename, base64, templateRefresh: "31", rowCount: data.rows.length };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("generatePricingWorkbook error:", msg);
      return { filename: "", base64: "", templateRefresh: "31", rowCount: 0, error: msg };
    }
  });
