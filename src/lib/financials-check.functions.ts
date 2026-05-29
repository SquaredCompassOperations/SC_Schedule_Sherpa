import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway";

// Inspects a P&L document and reports whether the period showed a net loss.
export const detectPnlLoss = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        filename: z.string().min(1).max(255),
        mediaType: z.string().min(1).max(128),
        dataBase64: z.string().min(1).max(20_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ loss: boolean | null; netIncome?: string; note?: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");
    const bytes = Buffer.from(data.dataBase64, "base64");

    const { text } = await generateText({
      model,
      system:
        'You read profit & loss / income statements. Output ONLY a JSON object (no prose, no fences): {"loss": true|false|null, "netIncome": string, "note": string}. "loss" is true if the bottom-line net income/loss for the reported period is negative, false if non-negative, null if the document is not a P&L or the figure cannot be determined. "netIncome" is the bottom-line figure as printed (with sign, currency, parentheses preserved). "note" is a one-sentence explanation.',
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Analyze "${data.filename}". Return strict JSON only.` },
            { type: "file", data: bytes, mediaType: data.mediaType },
          ],
        },
      ],
    });

    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      const obj = JSON.parse(cleaned);
      return {
        loss: typeof obj.loss === "boolean" ? obj.loss : null,
        netIncome: obj.netIncome ? String(obj.netIncome) : undefined,
        note: obj.note ? String(obj.note) : undefined,
      };
    } catch {
      return { loss: null, note: "Could not parse model response." };
    }
  });
