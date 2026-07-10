import { extractFileText, type FileExtractionInput } from "./file-extraction";

type TextInput = { type: "text"; text: string };
type DocumentInput = {
  type: "document";
  data: string;
  mime_type: string;
};
type ImageInput = {
  type: "image";
  data: string;
  mime_type: string;
};
type GeminiInput = string | Array<TextInput | DocumentInput | ImageInput>;

type GenerateOptions = {
  system?: string;
  maxOutputTokens?: number;
  model?: string;
};

type DocumentOptions = GenerateOptions & {
  prompt: string;
  file: FileExtractionInput;
  detail?: "low" | "high";
};

const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEFAULT_MODEL = "gemini-3.5-flash";
const DEFAULT_MAX_OUTPUT_TOKENS = 4000;

function getGeminiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add it in Vercel Project Settings > Environment Variables.",
    );
  }
  return key;
}

function getModel(model?: string) {
  return model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

function collectOutputText(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if ("output_text" in value && typeof value.output_text === "string") {
    return [value.output_text];
  }
  if ("text" in value && typeof value.text === "string") return [value.text];

  const out: string[] = [];
  for (const nested of Object.values(value)) {
    if (Array.isArray(nested)) {
      for (const item of nested) out.push(...collectOutputText(item));
    } else if (nested && typeof nested === "object") {
      out.push(...collectOutputText(nested));
    }
  }
  return out;
}

function responseText(payload: unknown) {
  if (payload && typeof payload === "object" && "output_text" in payload) {
    const direct = (payload as { output_text?: unknown }).output_text;
    if (typeof direct === "string") return direct;
  }
  return collectOutputText(payload).join("\n").trim();
}

function binaryInputFor(file: FileExtractionInput): DocumentInput | ImageInput {
  if (file.mediaType.startsWith("image/")) {
    return {
      type: "image",
      data: file.dataBase64,
      mime_type: file.mediaType,
    };
  }

  return {
    type: "document",
    data: file.dataBase64,
    mime_type: file.mediaType,
  };
}

async function generateFromInput(
  input: GeminiInput,
  { system, maxOutputTokens, model }: GenerateOptions,
) {
  const body = {
    model: getModel(model),
    system_instruction: system,
    input,
    generation_config: {
      max_output_tokens: maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    },
  };

  const res = await fetch(GEMINI_INTERACTIONS_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": getGeminiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseBody = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini request failed [${res.status}]: ${responseBody.slice(0, 500)}`);
  }

  const parsed = JSON.parse(responseBody) as unknown;
  const text = responseText(parsed);
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

export async function generateTextFromPrompt({
  prompt,
  system,
  maxOutputTokens,
  model,
}: GenerateOptions & { prompt: string }) {
  return generateFromInput(prompt, { system, maxOutputTokens, model });
}

export async function generateTextFromDocument({
  prompt,
  file,
  system,
  maxOutputTokens,
  model,
}: DocumentOptions) {
  const extracted = await extractFileText(file);
  if (extracted.kind === "text") {
    return generateFromInput(
      `${prompt}\n\nExtracted text from ${file.filename} (${extracted.source}):\n${extracted.text}`,
      { system, maxOutputTokens, model },
    );
  }

  return generateFromInput([binaryInputFor(file), { type: "text", text: prompt }], {
    system,
    maxOutputTokens,
    model,
  });
}

export async function generateTextFromImage({
  prompt,
  file,
  system,
  maxOutputTokens,
  model,
}: DocumentOptions) {
  return generateFromInput(
    [
      { type: "text", text: prompt },
      {
        type: "image",
        data: file.dataBase64,
        mime_type: file.mediaType,
      },
    ],
    { system, maxOutputTokens, model },
  );
}
