import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildDataUrl, extractFileText } from "./file-extraction";

function toBase64(value: string | Uint8Array | Buffer) {
  return Buffer.from(value).toString("base64");
}

describe("file extraction", () => {
  it("extracts readable text from plain text uploads", async () => {
    const result = await extractFileText({
      filename: "sam-profile.txt",
      mediaType: "text/plain",
      dataBase64: toBase64("Legal Business Name: Squared Compass LLC\nUEI: ABC123456789"),
    });

    expect(result).toEqual({
      kind: "text",
      text: "Legal Business Name: Squared Compass LLC\nUEI: ABC123456789",
      source: "plain_text",
    });
  });

  it("extracts body text from DOCX uploads", async () => {
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>Company Name</w:t></w:r><w:r><w:t>Squared Compass</w:t></w:r></w:p>
          <w:p><w:r><w:t>CAGE Code 1A2B3</w:t></w:r></w:p>
        </w:body>
      </w:document>`,
    );
    const bytes = await zip.generateAsync({ type: "nodebuffer" });

    const result = await extractFileText({
      filename: "sam-profile.docx",
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      dataBase64: toBase64(bytes),
    });

    expect(result.kind).toBe("text");
    if (result.kind !== "text") throw new Error("Expected DOCX extraction to return text");
    expect(result.source).toBe("docx");
    expect(result.text).toContain("Company Name Squared Compass");
    expect(result.text).toContain("CAGE Code 1A2B3");
  });

  it("extracts sheet rows from spreadsheet uploads", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["SIN", "Labor Category", "GSA Net Price"],
      ["541611", "Program Manager", "$125.00"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Pricing");
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const result = await extractFileText({
      filename: "price-list.xlsx",
      mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dataBase64: toBase64(bytes),
    });

    expect(result.kind).toBe("text");
    if (result.kind !== "text") throw new Error("Expected spreadsheet extraction to return text");
    expect(result.source).toBe("spreadsheet");
    expect(result.text).toContain("# Sheet: Pricing");
    expect(result.text).toContain("SIN,Labor Category,GSA Net Price");
    expect(result.text).toContain("541611,Program Manager,$125.00");
  });

  it("falls back to model file input for PDFs and images", async () => {
    const result = await extractFileText({
      filename: "profile.pdf",
      mediaType: "application/pdf",
      dataBase64: toBase64("%PDF-1.4 fake test content"),
    });

    expect(result).toEqual({
      kind: "file",
      source: "model_file_input",
    });
  });

  it("builds a data URL for model file and image inputs", () => {
    expect(buildDataUrl("application/pdf", "YWJj")).toBe("data:application/pdf;base64,YWJj");
  });
});
