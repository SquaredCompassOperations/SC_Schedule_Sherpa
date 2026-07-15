import JSZip from "jszip";
import { inflateSync } from "node:zlib";
import * as XLSX from "xlsx";

export type FileExtractionInput = {
  filename: string;
  mediaType: string;
  dataBase64: string;
};

export type ExtractedFileText =
  | { kind: "text"; text: string; source: "plain_text" | "docx" | "spreadsheet" | "pdf" }
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

function isPdf(filename: string, mediaType: string) {
  return extensionOf(filename) === ".pdf" || mediaType === "application/pdf";
}

type PdfObject = {
  id: string;
  body: string;
};

function extractPdfText(bytes: Buffer) {
  const raw = bytes.toString("latin1");
  const objects = parsePdfObjects(raw);
  const cMaps = new Map<string, Map<string, string>>();

  for (const object of objects.values()) {
    const stream = decodePdfStream(object.body);
    if (stream.includes("begincmap")) cMaps.set(object.id, parseToUnicodeCMap(stream));
  }

  const fontObjectCMaps = new Map<string, Map<string, string>>();
  for (const object of objects.values()) {
    const toUnicode = object.body.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
    if (toUnicode) fontObjectCMaps.set(object.id, cMaps.get(toUnicode[1]) ?? new Map());
  }

  const lines: string[] = [];
  for (const page of objects.values()) {
    if (!/\/Type\s*\/Page\b/.test(page.body)) continue;
    const fonts = getPageFontCMaps(page.body, fontObjectCMaps);
    for (const contentId of getPageContentIds(page.body)) {
      const content = objects.get(contentId);
      if (!content) continue;
      lines.push(...extractPdfTextRuns(decodePdfStream(content.body), fonts));
    }
  }

  return normalizeText(lines.join("\n"));
}

function parsePdfObjects(raw: string) {
  const objects = new Map<string, PdfObject>();
  for (const match of raw.matchAll(/(\d+)\s+0\s+obj\s*([\s\S]*?)\s*endobj/g)) {
    objects.set(match[1], { id: match[1], body: match[2] });
  }
  return objects;
}

function decodePdfStream(objectBody: string) {
  const streamStart = objectBody.indexOf("stream");
  if (streamStart < 0) return "";

  let contentStart = streamStart + "stream".length;
  if (objectBody[contentStart] === "\r" && objectBody[contentStart + 1] === "\n") {
    contentStart += 2;
  } else if (objectBody[contentStart] === "\n") {
    contentStart += 1;
  }

  const contentEnd = objectBody.indexOf("endstream", contentStart);
  if (contentEnd < 0) return "";

  let bytes = Buffer.from(objectBody.slice(contentStart, contentEnd), "latin1");
  if (bytes.at(-1) === 10) bytes = bytes.subarray(0, -1);
  if (bytes.at(-1) === 13) bytes = bytes.subarray(0, -1);

  if (!objectBody.includes("/FlateDecode")) return bytes.toString("latin1");

  try {
    return inflateSync(bytes).toString("latin1");
  } catch {
    return "";
  }
}

function parseToUnicodeCMap(cmap: string) {
  const values = new Map<string, string>();

  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const match of block[1].matchAll(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/g)) {
      values.set(match[1].toUpperCase(), decodeUnicodeHex(match[2]));
    }
  }

  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const match of block[1].matchAll(
      /<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/g,
    )) {
      const start = parseInt(match[1], 16);
      const end = parseInt(match[2], 16);
      const destination = parseInt(match[3], 16);
      const width = match[1].length;
      for (let code = start; code <= end; code += 1) {
        values.set(
          code.toString(16).toUpperCase().padStart(width, "0"),
          String.fromCodePoint(destination + code - start),
        );
      }
    }

    for (const match of block[1].matchAll(
      /<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+\[([\s\S]*?)\]/g,
    )) {
      const start = parseInt(match[1], 16);
      const width = match[1].length;
      const destinations = Array.from(match[3].matchAll(/<([0-9A-Fa-f]+)>/g));
      destinations.forEach((destination, index) => {
        values.set(
          (start + index).toString(16).toUpperCase().padStart(width, "0"),
          decodeUnicodeHex(destination[1]),
        );
      });
    }
  }

  return values;
}

function getPageFontCMaps(pageBody: string, fontObjectCMaps: Map<string, Map<string, string>>) {
  const fonts = new Map<string, Map<string, string>>();
  for (const match of pageBody.matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g)) {
    fonts.set(match[1], fontObjectCMaps.get(match[2]) ?? new Map());
  }
  return fonts;
}

function getPageContentIds(pageBody: string) {
  const arrayMatch = pageBody.match(/\/Contents\s+\[([\s\S]*?)\]/);
  if (arrayMatch) {
    return Array.from(arrayMatch[1].matchAll(/(\d+)\s+0\s+R/g)).map((match) => match[1]);
  }
  const singleMatch = pageBody.match(/\/Contents\s+(\d+)\s+0\s+R/);
  return singleMatch ? [singleMatch[1]] : [];
}

function extractPdfTextRuns(content: string, fonts: Map<string, Map<string, string>>) {
  const lines: string[] = [];
  let currentFont = "";

  for (const block of content.matchAll(/BT([\s\S]*?)ET/g)) {
    const font = block[1].match(/\/(F\d+)\s+[\d.]+\s+Tf/);
    if (font) currentFont = font[1];

    const cmap = fonts.get(currentFont) ?? new Map();
    const text = Array.from(block[1].matchAll(/(?:<([0-9A-Fa-f]+)>|\(([^()]*)\))\s*Tj/g))
      .map((match) =>
        match[1] ? decodePdfHexText(match[1], cmap) : decodePdfLiteralText(match[2] ?? ""),
      )
      .join("")
      .trim();

    if (text) lines.push(text);
  }

  return lines;
}

function decodePdfHexText(hex: string, cmap: Map<string, string>) {
  const normalized = hex.toUpperCase();
  let output = "";
  let index = 0;

  while (index < normalized.length) {
    const fourByteCode = normalized.slice(index, index + 4);
    if (fourByteCode.length === 4 && cmap.has(fourByteCode)) {
      output += cmap.get(fourByteCode);
      index += 4;
      continue;
    }

    const twoByteCode = normalized.slice(index, index + 2);
    if (twoByteCode.length < 2) break;

    if (cmap.has(twoByteCode)) {
      output += cmap.get(twoByteCode);
      index += 2;
      continue;
    }

    output += String.fromCharCode(parseInt(twoByteCode, 16));
    index += 2;
  }

  return output;
}

function decodeUnicodeHex(hex: string) {
  let output = "";
  for (let index = 0; index < hex.length; index += 4) {
    output += String.fromCodePoint(parseInt(hex.slice(index, index + 4), 16));
  }
  return output;
}

function decodePdfLiteralText(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\([\\()])/g, "$1");
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

  if (isPdf(input.filename, input.mediaType)) {
    const text = extractPdfText(bytes);
    if (text) return { kind: "text", text, source: "pdf" };
  }

  if (isPlainText(input.filename, input.mediaType)) {
    const text = normalizeText(decodeText(bytes));
    if (text) return { kind: "text", text, source: "plain_text" };
  }

  return { kind: "file", source: "model_file_input" };
}
