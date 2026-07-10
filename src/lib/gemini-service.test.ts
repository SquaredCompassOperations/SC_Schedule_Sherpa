import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateTextFromDocument,
  generateTextFromImage,
  generateTextFromPrompt,
} from "./gemini-service";

const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalGeminiModel = process.env.GEMINI_MODEL;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return new Response(JSON.stringify(body), { status, statusText: ok ? "OK" : "Bad Request" });
}

function lastRequestBody(fetchMock: ReturnType<typeof vi.fn>) {
  const body = fetchMock.mock.calls.at(-1)?.[1]?.body;
  if (typeof body !== "string") throw new Error("Expected fetch body to be a JSON string");
  return JSON.parse(body) as {
    model?: string;
    input?: unknown;
    system_instruction?: string;
    generation_config?: Record<string, unknown>;
  };
}

describe("Gemini service", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    delete process.env.GEMINI_MODEL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalGeminiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
    if (originalGeminiModel === undefined) {
      delete process.env.GEMINI_MODEL;
    } else {
      process.env.GEMINI_MODEL = originalGeminiModel;
    }
  });

  it("asks for the Gemini key when configuration is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(generateTextFromPrompt({ prompt: "hello" })).rejects.toThrow(
      "GEMINI_API_KEY is not configured",
    );
  });

  it("sends prompt-only requests to the Gemini Interactions API", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ output_text: "Gemini response" }));

    const text = await generateTextFromPrompt({
      prompt: "Draft a checklist",
      system: "Return concise text",
      maxOutputTokens: 1200,
    });

    expect(text).toBe("Gemini response");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-goog-api-key": "test-gemini-key",
        }),
      }),
    );
    expect(lastRequestBody(fetchMock)).toMatchObject({
      model: "gemini-3.5-flash",
      system_instruction: "Return concise text",
      input: "Draft a checklist",
      generation_config: { max_output_tokens: 1200 },
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

    expect(lastRequestBody(fetchMock).input).toContain(
      "Extracted text from sam-profile.txt (plain_text):",
    );
    expect(lastRequestBody(fetchMock).input).toContain("UEI: ABC123456789");
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
      { type: "document", data: dataBase64, mime_type: "application/pdf" },
      { type: "text", text: "Summarize" },
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
      { type: "text", text: "Read the screenshot" },
      { type: "image", data: dataBase64, mime_type: "image/png" },
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
