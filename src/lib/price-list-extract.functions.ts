import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { extractFileText } from "./file-extraction";
import { generateTextFromDocument, generateTextFromPrompt } from "./openai-service";
import { parsePriceListLcatsFromText } from "./price-list-parser";

export type ExtractedLcat = {
  title: string;
  rate?: string;
  unit?: string;
  sin?: string;
};

export const extractPriceListLcats = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        filename: z.string().min(1).max(255),
        mediaType: z.string().min(1).max(128),
        dataBase64: z.string().min(1).max(20_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ lcats: ExtractedLcat[]; raw: string; error?: string }> => {
    try {
      const extracted = await extractFileText(data);
      if (extracted.kind === "text") {
        const localRows = parsePriceListLcatsFromText(extracted.text);
        if (localRows.length > 0) return { lcats: localRows, raw: extracted.text };
      }

      const system =
        "You extract Labor Categories (LCATs) and offerings from a contractor's Commercial Price List. Return ONLY a JSON array — no prose, no markdown fences. Each element is an object with keys: title (the exact LCAT or offering name, including seniority level e.g. 'Project Manager II'), rate (commercial hourly/unit price as printed, e.g. '$160.00' — omit if not present), unit (e.g. 'Hour', 'Each' — omit if not present), sin (the SIN this offering falls under, e.g. '541611' — omit if not present). Return EVERY distinct LCAT/offering row. Do NOT collapse seniority levels (Level I and Level II are separate rows). Do NOT invent values. If a row has only a description but no LCAT title, skip it.";
      const prompt = `Extract every Labor Category / offering from "${data.filename}". Output a strict JSON array only.`;

      const text =
        extracted.kind === "text"
          ? await generateTextFromPrompt({
              system,
              prompt: `${prompt}\n\nExtracted text from ${data.filename} (${extracted.source}):\n${extracted.text}`,
            })
          : await generateTextFromDocument({
              system,
              prompt,
              file: data,
              detail: "high",
            });

      const cleaned = text
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
      let lcats: ExtractedLcat[] = [];
      try {
        const arr = JSON.parse(cleaned);
        if (Array.isArray(arr)) {
          const seen = new Set<string>();
          for (const r of arr) {
            if (!r || typeof r !== "object") continue;
            const title = String((r as Record<string, unknown>).title ?? "").trim();
            if (!title) continue;
            const rate = ((r as Record<string, unknown>).rate ?? "") as string;
            const dedupeKey = `${title}|${rate}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);

            lcats.push({
              title: title.slice(0, 200),
              rate: rate ? String(rate).trim().slice(0, 40) : undefined,
              unit: ((r as Record<string, unknown>).unit ?? undefined) as string | undefined,
              sin: ((r as Record<string, unknown>).sin ?? undefined) as string | undefined,
            });
          }
        }
      } catch {
        lcats = parsePriceListLcatsFromText(text);
      }

      return { lcats, raw: text };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { lcats: [], raw: "", error: msg };
    }
  });
