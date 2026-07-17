import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateTextFromDocument,
  generateTextFromImage,
  generateTextFromPrompt,
} from "./gemini-service";

const originalOpenAIKey = process.env.OPENAI_API_KEY;
const originalOpenAIModel = process.env.OPENAI_MODEL;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return new Response(JSON.stringify(body), { status, statusText: ok ? "OK" : "Bad Request" });
}

function lastRequestBody(fetchMock: ReturnType<typeof vi.fn>) {
  const body = fetchMock.mock.calls.at(-1)?.[1]?.body;
  if (typeof body !== "string") throw new Error("Expected fetch body to be a JSON string");
  return JSON.parse(body) as {
    model?: string;
    input?: unknown;
    max_output_tokens?: number;
    text?: Record<string, unknown>;
  };
}

describe("OpenAI service", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    delete process.env.OPENAI_MODEL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalOpenAIKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAIKey;
    }
    if (originalOpenAIModel === undefined) {
      delete process.env.OPENAI_MODEL;
    } else {
      process.env.OPENAI_MODEL = originalOpenAIModel;
    }
  });

  it("asks for the OpenAI key when configuration is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(generateTextFromPrompt({ prompt: "hello" })).rejects.toThrow(
      "OPENAI_API_KEY is not configured",
    );
  });

  it("sends prompt-only requests to the OpenAI responses API", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ output_text: "OpenAI response" }));

    const text = await generateTextFromPrompt({
      prompt: "Draft a checklist",
      system: "Return concise text",
      maxOutputTokens: 1200,
    });

    expect(text).toBe("OpenAI response");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-openai-key",
        }),
      }),
    );
    expect(lastRequestBody(fetchMock)).toMatchObject({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: "Return concise text" }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: "Draft a checklist" }],
        },
      ],
      max_output_tokens: 1200,
    });
  });

  it("uses locally extracted text for readable document uploads", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ output_text: "extracted" }));

    await generateTextFromDocument({
      prompt: "Extract fields",
      file: {
        filename: "sam-profile.txt",
        mediaType: "text/plain",
        dataBase64: Buffer.from("UEI: ABC123456789").toString("base64"),
      },
    });

    expect(JSON.stringify(lastRequestBody(fetchMock).input)).toContain(
      "Extracted text from sam-profile.txt (plain_text):",
    );
    expect(JSON.stringify(lastRequestBody(fetchMock).input)).toContain("UEI: ABC123456789");
  });

  it("sends PDFs and other binary documents as inline document input", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ output_text: "pdf extraction" }));
    const dataBase64 = Buffer.from("%PDF fake").toString("base64");

    await generateTextFromDocument({
      prompt: "Summarize",
      file: {
        filename: "profile.pdf",
        mediaType: "application/pdf",
        dataBase64,
      },
    });

    expect(lastRequestBody(fetchMock).input).toEqual([
      {
        role: "user",
        content: [
          {
            type: "input_file",
            file_data: dataBase64,
            filename: "uploaded-document",
            mime_type: "application/pdf",
          },
          { type: "input_text", text: "Summarize" },
        ],
      },
    ]);
  });

  it("sends images as inline image input", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ output_text: "image extraction" }));
    const dataBase64 = Buffer.from("fake png").toString("base64");

    await generateTextFromImage({
      prompt: "Read the screenshot",
      file: {
        filename: "sba.png",
        mediaType: "image/png",
        dataBase64,
      },
    });

    expect(lastRequestBody(fetchMock).input).toEqual([
      {
        role: "user",
        content: [
          { type: "input_text", text: "Read the screenshot" },
          { type: "input_image", image_url: `data:image/png;base64,${dataBase64}` },
        ],
      },
    ]);
  });

  it("falls back to nested text when output_text is absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        steps: [{ content: [{ text: "Nested response" }] }],
      }),
    );

    await expect(generateTextFromPrompt({ prompt: "hello" })).resolves.toBe("Nested response");
  });
});
