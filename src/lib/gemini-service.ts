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
type OpenAIInput = string | Array<TextInput | DocumentInput | ImageInput>;

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
const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_MAX_OUTPUT_TOKENS = 4000;

function getOpenAIKey() {
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
  if ("output_text" in value && typeof (value as { output_text?: unknown }).output_text === "string") {
    return [(value as { output_text: string }).output_text];
  }
  if ("text" in value && typeof (value as { text?: unknown }).text === "string") {
    return [(value as { text: string }).text];
  }

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

function mapContentItem(item: TextInput | DocumentInput | ImageInput) {
  if (item.type === "text") {
    return { type: "input_text" as const, text: item.text };
  }
  if (item.type === "document") {
    return {
      type: "input_file" as const,
      file_data: item.data,
      filename: "uploaded-document",
      mime_type: item.mime_type,
    };
  }
  return {
    type: "input_image" as const,
    image_url: `data:${item.mime_type};base64,${item.data}`,
  };
}

async function generateFromInput(
  input: OpenAIInput,
  { system, maxOutputTokens, model }: GenerateOptions,
) {
  const content: Array<TextInput | DocumentInput | ImageInput> =
    typeof input === "string" ? [{ type: "text", text: input }] : input;
  const mappedContent = content.map((item) => mapContentItem(item));
  const body = {
    model: getModel(model),
    input: [
      ...(system ? [{ role: "system", content: [{ type: "input_text", text: system }] }] : []),
      { role: "user", content: mappedContent },
    ],
    max_output_tokens: maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    text: { format: { type: "text" } },
  };

  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseBody = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI request failed [${res.status}]: ${responseBody.slice(0, 500)}`);
  }

  const parsed = JSON.parse(responseBody) as unknown;
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
