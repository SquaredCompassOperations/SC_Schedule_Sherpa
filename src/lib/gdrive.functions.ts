import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

function authHeaders() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const GOOGLE_DRIVE_API_KEY = process.env.GOOGLE_DRIVE_API_KEY;
  if (!GOOGLE_DRIVE_API_KEY) throw new Error("GOOGLE_DRIVE_API_KEY is not configured");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_DRIVE_API_KEY,
  };
}

export type GDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  iconLink?: string;
};

export const listDriveFiles = createServerFn({ method: "POST" })
  .inputValidator((input: { query?: string; pageToken?: string }) => input)
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      pageSize: "25",
      fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime,iconLink)",
      orderBy: "modifiedTime desc",
      q: data.query
        ? `name contains '${data.query.replace(/'/g, "\\'")}' and trashed=false`
        : "trashed=false",
    });
    if (data.pageToken) params.set("pageToken", data.pageToken);

    const res = await fetch(`${GATEWAY_URL}/files?${params}`, { headers: authHeaders() });
    const body = await res.json();
    if (!res.ok) throw new Error(`Drive list failed [${res.status}]: ${JSON.stringify(body)}`);
    return {
      files: (body.files ?? []) as GDriveFile[],
      nextPageToken: (body.nextPageToken ?? null) as string | null,
    };
  });

const GOOGLE_EXPORT_MIME: Record<string, string> = {
  "application/vnd.google-apps.document": "application/pdf",
  "application/vnd.google-apps.spreadsheet": "application/pdf",
  "application/vnd.google-apps.presentation": "application/pdf",
};

export const fetchDriveFile = createServerFn({ method: "POST" })
  .inputValidator((input: { fileId: string }) => input)
  .handler(async ({ data }) => {
    // Get metadata
    const metaRes = await fetch(
      `${GATEWAY_URL}/files/${data.fileId}?fields=id,name,mimeType,size`,
      { headers: authHeaders() },
    );
    const meta = await metaRes.json();
    if (!metaRes.ok) {
      throw new Error(`Drive metadata failed [${metaRes.status}]: ${JSON.stringify(meta)}`);
    }

    const isGoogleDoc = (meta.mimeType as string)?.startsWith("application/vnd.google-apps.");
    const exportMime = isGoogleDoc ? GOOGLE_EXPORT_MIME[meta.mimeType] ?? "application/pdf" : null;

    const downloadUrl = isGoogleDoc
      ? `${GATEWAY_URL}/files/${data.fileId}/export?mimeType=${encodeURIComponent(exportMime!)}`
      : `${GATEWAY_URL}/files/${data.fileId}?alt=media`;

    const fileRes = await fetch(downloadUrl, { headers: authHeaders() });
    if (!fileRes.ok) {
      const text = await fileRes.text();
      throw new Error(`Drive download failed [${fileRes.status}]: ${text.slice(0, 200)}`);
    }
    const buf = await fileRes.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const dataBase64 = btoa(binary);

    return {
      filename: isGoogleDoc ? `${meta.name}.pdf` : (meta.name as string),
      mediaType: exportMime ?? (meta.mimeType as string),
      dataBase64,
    };
  });
