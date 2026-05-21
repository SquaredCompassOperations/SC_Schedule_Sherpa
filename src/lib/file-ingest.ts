// Centralized file ingest policy for ScheduleBuilder.
// Mirrors GSA eOffer practical caps; tune as policy evolves.

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per file (GSA eOffer cap)
export const MAX_TOTAL_BYTES = 250 * 1024 * 1024; // 250 MB per batch

export type IngestCategory =
  | "Office"
  | "PDF"
  | "Spreadsheet"
  | "Text"
  | "Image"
  | "Email"
  | "Archive"
  | "Data"
  | "Diagram"
  | "Signature";

export type AcceptedType = {
  ext: string;
  mime: string[];
  category: IngestCategory;
  note?: string;
};

export const ACCEPTED_TYPES: AcceptedType[] = [
  // Office
  { ext: ".doc", mime: ["application/msword"], category: "Office" },
  { ext: ".docx", mime: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], category: "Office" },
  { ext: ".ppt", mime: ["application/vnd.ms-powerpoint"], category: "Office" },
  { ext: ".pptx", mime: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"], category: "Office" },
  { ext: ".rtf", mime: ["application/rtf", "text/rtf"], category: "Office" },
  { ext: ".odt", mime: ["application/vnd.oasis.opendocument.text"], category: "Office" },
  // PDF
  { ext: ".pdf", mime: ["application/pdf"], category: "PDF" },
  // Spreadsheet
  { ext: ".xls", mime: ["application/vnd.ms-excel"], category: "Spreadsheet" },
  { ext: ".xlsx", mime: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], category: "Spreadsheet" },
  { ext: ".csv", mime: ["text/csv", "application/csv"], category: "Spreadsheet" },
  { ext: ".ods", mime: ["application/vnd.oasis.opendocument.spreadsheet"], category: "Spreadsheet" },
  // Text
  { ext: ".txt", mime: ["text/plain"], category: "Text" },
  { ext: ".md", mime: ["text/markdown", "text/plain"], category: "Text" },
  // Images
  { ext: ".jpg", mime: ["image/jpeg"], category: "Image" },
  { ext: ".jpeg", mime: ["image/jpeg"], category: "Image" },
  { ext: ".png", mime: ["image/png"], category: "Image" },
  { ext: ".tif", mime: ["image/tiff"], category: "Image" },
  { ext: ".tiff", mime: ["image/tiff"], category: "Image" },
  // Email
  { ext: ".msg", mime: ["application/vnd.ms-outlook", "application/octet-stream"], category: "Email" },
  { ext: ".eml", mime: ["message/rfc822"], category: "Email" },
  // Archive
  { ext: ".zip", mime: ["application/zip", "application/x-zip-compressed"], category: "Archive" },
  // Data
  { ext: ".xml", mime: ["application/xml", "text/xml"], category: "Data" },
  { ext: ".json", mime: ["application/json"], category: "Data" },
  // Diagrams
  { ext: ".vsd", mime: ["application/vnd.visio"], category: "Diagram" },
  { ext: ".vsdx", mime: ["application/vnd.ms-visio.drawing"], category: "Diagram" },
  // Digital signature certs (metadata only)
  { ext: ".p7s", mime: ["application/pkcs7-signature"], category: "Signature" },
  { ext: ".p7m", mime: ["application/pkcs7-mime"], category: "Signature" },
  { ext: ".pfx", mime: ["application/x-pkcs12"], category: "Signature" },
];

// Blocked for security — executables, scripts, active content.
export const BLOCKED_EXTS = new Set([
  ".exe", ".bat", ".cmd", ".com", ".scr", ".msi", ".dll",
  ".js", ".mjs", ".vbs", ".ps1", ".sh", ".jar", ".app",
  ".htm", ".html", ".svg",
]);

export const ACCEPT_ATTR = ACCEPTED_TYPES.map((t) => t.ext).join(",");

export function categoryFor(filename: string): IngestCategory | null {
  const ext = extOf(filename);
  return ACCEPTED_TYPES.find((t) => t.ext === ext)?.category ?? null;
}

export function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

export type ValidationResult =
  | { ok: true; category: IngestCategory }
  | { ok: false; reason: string };

export function validateFile(file: File): ValidationResult {
  const ext = extOf(file.name);
  if (!ext) return { ok: false, reason: "Missing file extension" };
  if (BLOCKED_EXTS.has(ext)) return { ok: false, reason: `Blocked file type (${ext})` };
  const match = ACCEPTED_TYPES.find((t) => t.ext === ext);
  if (!match) return { ok: false, reason: `Unsupported file type (${ext})` };
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, reason: `Exceeds 25 MB limit (${formatBytes(file.size)})` };
  }
  if (file.size === 0) return { ok: false, reason: "Empty file" };
  return { ok: true, category: match.category };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
