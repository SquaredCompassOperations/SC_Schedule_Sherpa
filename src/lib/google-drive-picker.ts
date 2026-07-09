import type { GDriveFile } from "@/lib/gdrive.functions";
import { getStoredGoogleProviderToken } from "@/lib/google-auth";

type PickerBuilderInstance = {
  addView: (view: unknown) => PickerBuilderInstance;
  setCallback: (callback: (data: Record<string, unknown>) => void) => PickerBuilderInstance;
  setDeveloperKey: (key: string) => PickerBuilderInstance;
  setOAuthToken: (token: string) => PickerBuilderInstance;
  build: () => { setVisible: (value: boolean) => void };
};

type PickerNamespace = {
  Action: { PICKED: string; CANCEL: string };
  DocsView: new (viewId?: string) => {
    setIncludeFolders: (value: boolean) => void;
    setSelectFolderEnabled: (value: boolean) => void;
  };
  Document: Record<string, string>;
  PickerBuilder: new () => PickerBuilderInstance;
  Response: Record<string, string>;
  ViewId: { DOCS: string };
};

type GoogleApiWindow = Window & {
  gapi?: {
    load: (api: string, callback: () => void) => void;
  };
  google?: {
    picker?: PickerNamespace;
  };
};

let googleApiScript: Promise<void> | null = null;
let googlePickerApi: Promise<PickerNamespace> | null = null;

function getGoogleWindow() {
  return window as GoogleApiWindow;
}

function getPickerApiKey() {
  return import.meta.env.VITE_GOOGLE_DRIVE_PICKER_API_KEY as string | undefined;
}

function loadGoogleApiScript() {
  if (getGoogleWindow().gapi) return Promise.resolve();
  if (googleApiScript) return googleApiScript;

  googleApiScript = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://apis.google.com/js/api.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google API script failed to load.")),
        {
          once: true,
        },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google API script failed to load."));
    document.head.appendChild(script);
  });

  return googleApiScript;
}

async function loadGooglePickerApi() {
  if (googlePickerApi) return googlePickerApi;

  googlePickerApi = loadGoogleApiScript().then(
    () =>
      new Promise<PickerNamespace>((resolve, reject) => {
        const googleWindow = getGoogleWindow();
        googleWindow.gapi?.load("picker", () => {
          const picker = googleWindow.google?.picker;
          if (picker) resolve(picker);
          else reject(new Error("Google Drive picker is unavailable."));
        });
      }),
  );

  return googlePickerApi;
}

function pickString(document: Record<string, unknown>, ...keys: Array<string | undefined>) {
  for (const key of keys) {
    if (!key) continue;
    const value = document[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function toDriveFile(document: Record<string, unknown>, picker: PickerNamespace): GDriveFile {
  const id = pickString(document, picker.Document.ID, "id");
  if (!id) throw new Error("Google Drive did not return a file ID.");

  const size = document[picker.Document.SIZE_BYTES] ?? document.sizeBytes;

  return {
    id,
    name: pickString(document, picker.Document.NAME, "name") ?? "Google Drive file",
    mimeType:
      pickString(document, picker.Document.MIME_TYPE, "mimeType") ?? "application/octet-stream",
    size: typeof size === "number" ? String(size) : typeof size === "string" ? size : undefined,
    modifiedTime: pickString(document, picker.Document.LAST_EDITED_UTC, "lastEditedUtc"),
    iconLink: pickString(document, picker.Document.ICON_URL, "iconUrl"),
  };
}

export async function openGoogleDrivePicker() {
  const accessToken = getStoredGoogleProviderToken();
  if (!accessToken) {
    throw new Error(
      "Google Drive is not connected. Sign out and sign back in with Google, then retry.",
    );
  }

  const apiKey = getPickerApiKey();
  if (!apiKey) {
    throw new Error(
      "Google Drive Picker API key is missing. Add VITE_GOOGLE_DRIVE_PICKER_API_KEY in Vercel.",
    );
  }

  const picker = await loadGooglePickerApi();

  return new Promise<GDriveFile | null>((resolve, reject) => {
    const view = new picker.DocsView(picker.ViewId.DOCS);
    view.setIncludeFolders(true);
    view.setSelectFolderEnabled(false);

    const builtPicker = new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback((data) => {
        const action = data[picker.Response.ACTION] ?? data.action;
        if (action === picker.Action.CANCEL) {
          resolve(null);
          return;
        }

        if (action !== picker.Action.PICKED) return;

        const docs = data[picker.Response.DOCUMENTS] ?? data.docs;
        const selected = Array.isArray(docs) ? docs[0] : null;
        if (!selected || typeof selected !== "object") {
          reject(new Error("Google Drive did not return a selected file."));
          return;
        }

        try {
          resolve(toDriveFile(selected as Record<string, unknown>, picker));
        } catch (error) {
          reject(error);
        }
      })
      .build();

    builtPicker.setVisible(true);
  });
}
