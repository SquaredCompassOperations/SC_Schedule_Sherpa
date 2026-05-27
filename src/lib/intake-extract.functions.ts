import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const FIELDS = [
  "legalName",
  "uei",
  "cage",
  "ein",
  "naicsPrimary",
  "employees",
] as const;

export type ExtractedIdentity = Partial<Record<(typeof FIELDS)[number], string>>;

export const extractBusinessIdentity = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        filename: z.string().min(1).max(255),
        mediaType: z.string().min(1).max(128),
        // base64-encoded file contents
        dataBase64: z.string().min(1).max(20_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const bytes = Buffer.from(data.dataBase64, "base64");

    const { text } = await generateText({
      model,
      system:
        'You extract structured federal contractor business-identity data from documents. Return ONLY a single JSON object — no prose, no markdown fences. Keys: legalName, uei (12-char SAM.gov UEI), cage (5-char CAGE code), ein (XX-XXXXXXX), naicsPrimary (6-digit), employees (integer string). Omit any field you cannot find with reasonable confidence. Do not invent values.',
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract the business identity fields from "${data.filename}". Output strict JSON only.`,
            },
            {
              type: "file",
              data: bytes,
              mediaType: data.mediaType,
            },
          ],
        },
      ],
    });

    // Strip code fences if model added any, then parse JSON.
    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: ExtractedIdentity = {};
    try {
      const obj = JSON.parse(cleaned);
      if (obj && typeof obj === "object") {
        for (const f of FIELDS) {
          const v = (obj as Record<string, unknown>)[f];
          if (v !== undefined && v !== null && String(v).trim() !== "") {
            parsed[f] = String(v).trim();
          }
        }
      }
    } catch {
      // Return empty extraction on parse failure rather than crashing.
    }

    return { fields: parsed, raw: text };
  });
