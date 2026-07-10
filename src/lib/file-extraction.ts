import JSZip from "jszip";
import * as XLSX from "xlsx";

export type FileExtractionInput = {
  filename: string;
  mediaType: string;
  dataBase64: string;
};

export type ExtractedFileText =
  | { kind: "text"; text: string; source: "plain_text" | "docx" | "spreadsheet" }
  | { kind: "file"; source: "model_file_input" };

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".json", ".html", ".xml", ".csv", ".tsv"]);
const SPREADSHEET_EXTENSIONS = new Set([".xls", ".xlsx", ".xlsm", ".csv", ".tsv"]);
const MAX_EXTRACTED_CHARS = 120_000;
const MAX_SHEET_ROWS = 1000;

export function buildDataUrl(mediaType: string, dataBase64: string) {
  return `data:${mediaType || "application/octet-stream"};base64,${dataBase64}`;
}

function extensionOf(filename: string) {
  const match = filename.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? "";
}

function decodeText(bytes: Buffer) {
  return bytes.toString("utf8").split("\u0000").join("").trim();
}

function normalizeText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function extractDocxText(bytes: Buffer) {
  const zip = await JSZip.loadAsync(bytes);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) return "";

  const paragraphs = documentXml
    .split(/<\/w:p>/i)
    .map((paragraph) => {
      const textRuns = Array.from(paragraph.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi)).map(
        (match) => decodeXmlEntities(match[1] ?? ""),
      );
      return textRuns.join(" ");
    })
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return normalizeText(paragraphs.join("\n"));
}

function extractSpreadsheetText(bytes: Buffer, filename: string, mediaType: string) {
  const ext = extensionOf(filename);
  const type = ext === ".csv" || mediaType.includes("csv") ? "string" : "buffer";
  const input = type === "string" ? decodeText(bytes) : bytes;
  const workbook = XLSX.read(input, { type });
  const sections: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, {
      blankrows: false,
      strip: true,
      FS: ",",
      RS: "\n",
    });
    const rows = csv.split("\n").slice(0, MAX_SHEET_ROWS).join("\n").trim();
    if (rows) sections.push(`# Sheet: ${sheetName}\n${rows}`);
  }

  return normalizeText(sections.join("\n\n"));
}

function isPlainText(filename: string, mediaType: string) {
  const ext = extensionOf(filename);
  return mediaType.startsWith("text/") || TEXT_EXTENSIONS.has(ext);
}

function isDocx(filename: string, mediaType: string) {
  return (
    extensionOf(filename) === ".docx" ||
    mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function isSpreadsheet(filename: string, mediaType: string) {
  const ext = extensionOf(filename);
  return (
    SPREADSHEET_EXTENSIONS.has(ext) ||
    mediaType.includes("spreadsheet") ||
    mediaType.includes("excel") ||
    mediaType.includes("csv") ||
    mediaType.includes("tsv")
  );
}

export async function extractFileText(input: FileExtractionInput): Promise<ExtractedFileText> {
  const bytes = Buffer.from(input.dataBase64, "base64");

  if (isDocx(input.filename, input.mediaType)) {
    const text = await extractDocxText(bytes);
    if (text) return { kind: "text", text, source: "docx" };
  }

  if (isSpreadsheet(input.filename, input.mediaType)) {
    const text = extractSpreadsheetText(bytes, input.filename, input.mediaType);
    if (text) return { kind: "text", text, source: "spreadsheet" };
  }

  if (isPlainText(input.filename, input.mediaType)) {
    const text = normalizeText(decodeText(bytes));
    if (text) return { kind: "text", text, source: "plain_text" };
  }

  return { kind: "file", source: "model_file_input" };
}
