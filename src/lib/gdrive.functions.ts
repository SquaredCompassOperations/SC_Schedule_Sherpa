import { createServerFn } from "@tanstack/react-start";

const DRIVE_API_URL = "https://www.googleapis.com/drive/v3";

function authHeaders(accessToken: string) {
  if (!accessToken) {
    throw new Error("Google Drive is not connected. Sign in with Google again, then retry.");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
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

const GOOGLE_EXPORT_MIME: Record<string, string> = {
  "application/vnd.google-apps.document": "application/pdf",
  "application/vnd.google-apps.spreadsheet": "application/pdf",
  "application/vnd.google-apps.presentation": "application/pdf",
};

export const fetchDriveFile = createServerFn({ method: "POST" })
  .inputValidator((input: { fileId: string; accessToken: string }) => input)
  .handler(async ({ data }) => {
    const metaRes = await fetch(
      `${DRIVE_API_URL}/files/${data.fileId}?fields=id,name,mimeType,size`,
      { headers: authHeaders(data.accessToken) },
    );
    const meta = await metaRes.json();
    if (!metaRes.ok) {
      throw new Error(`Drive metadata failed [${metaRes.status}]: ${JSON.stringify(meta)}`);
    }

    const isGoogleDoc = (meta.mimeType as string)?.startsWith("application/vnd.google-apps.");
    const exportMime = isGoogleDoc
      ? (GOOGLE_EXPORT_MIME[meta.mimeType] ?? "application/pdf")
      : null;

    const downloadUrl = isGoogleDoc
      ? `${DRIVE_API_URL}/files/${data.fileId}/export?mimeType=${encodeURIComponent(exportMime!)}`
      : `${DRIVE_API_URL}/files/${data.fileId}?alt=media`;

    const fileRes = await fetch(downloadUrl, { headers: authHeaders(data.accessToken) });
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
