import { buildDataUrl, extractFileText, type FileExtractionInput } from "./file-extraction";

type TextContent = { type: "input_text"; text: string };
type FileContent = {
  type: "input_file";
  filename: string;
  file_data: string;
  detail?: "low" | "high";
};
type ImageContent = {
  type: "input_image";
  image_url: string;
  detail?: "low" | "high";
};
type InputContent = TextContent | FileContent | ImageContent;

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

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1";
const DEFAULT_MAX_OUTPUT_TOKENS = 4000;

function getOpenAiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Add it in Vercel Project Settings > Environment Variables.",
    );
  }
  return key;
}

function getModel(model?: string) {
  return model || process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

function collectOutputText(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if ("text" in value && typeof value.text === "string") return [value.text];
  if ("output_text" in value && typeof value.output_text === "string") return [value.output_text];

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

async function generateFromContent(
  content: InputContent[],
  { system, maxOutputTokens, model }: GenerateOptions,
) {
  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getModel(model),
      instructions: system,
      input: [{ role: "user", content }],
      max_output_tokens: maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      store: false,
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI request failed [${res.status}]: ${body.slice(0, 500)}`);
  }

  const parsed = JSON.parse(body) as unknown;
  const text = responseText(parsed);
  if (!text) throw new Error("OpenAI returned an empty response.");
  return text;
}

export async function generateTextFromPrompt({
  prompt,
  system,
  maxOutputTokens,
  model,
}: GenerateOptions & { prompt: string }) {
  return generateFromContent([{ type: "input_text", text: prompt }], {
    system,
    maxOutputTokens,
    model,
  });
}

export async function generateTextFromDocument({
  prompt,
  file,
  system,
  detail = "low",
  maxOutputTokens,
  model,
}: DocumentOptions) {
  const extracted = await extractFileText(file);
  if (extracted.kind === "text") {
    return generateFromContent(
      [
        {
          type: "input_text",
          text: `${prompt}\n\nExtracted text from ${file.filename} (${extracted.source}):\n${extracted.text}`,
        },
      ],
      { system, maxOutputTokens, model },
    );
  }

  return generateFromContent(
    [
      {
        type: "input_file",
        filename: file.filename,
        file_data: buildDataUrl(file.mediaType, file.dataBase64),
        detail,
      },
      { type: "input_text", text: prompt },
    ],
    { system, maxOutputTokens, model },
  );
}

export async function generateTextFromImage({
  prompt,
  file,
  system,
  detail = "high",
  maxOutputTokens,
  model,
}: DocumentOptions) {
  return generateFromContent(
    [
      {
        type: "input_image",
        image_url: buildDataUrl(file.mediaType, file.dataBase64),
        detail,
      },
      { type: "input_text", text: prompt },
    ],
    { system, maxOutputTokens, model },
  );
}
