import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateTextFromDocument } from "./gemini-service";

const FIELDS = [
  // Company details
  "uei",
  "cageCode",
  "orgType",
  "parentUei",
  "legalName",
  "dba",
  "ein",
  "businessTypes",
  "samStatus",
  "samExpires",
  "website",
  "naicsPrimary",
  "entityStartDate",
  // Company address
  "addrStreet1",
  "addrStreet2",
  "addrCity",
  "addrState",
  "addrZip",
  "addrCountry",
  // Mailing address
  "mailStreet1",
  "mailStreet2",
  "mailCity",
  "mailState",
  "mailZip",
  "mailCountry",
  // Government Business POC (authorized negotiator candidate from SAM profile)
  "pocName",
  "pocTitle",
  "pocEmail",
  "pocPhone",
] as const;

export type ExtractedIdentity = Partial<Record<(typeof FIELDS)[number], string>>;

export const extractBusinessIdentity = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        filename: z.string().min(1).max(255),
        mediaType: z.string().min(1).max(128),
        dataBase64: z.string().min(1).max(20_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const text = await generateTextFromDocument({
      system:
        'You extract structured federal contractor business-identity data from SAM.gov entity registration profiles (PDF printouts, exports, screenshots) and similar documents. Return ONLY a single JSON object — no prose, no markdown fences. Keys: uei (12-char SAM.gov UEI), cageCode (5-char CAGE/NCAGE code), orgType (e.g. "Limited Liability Company", "Corporate Entity (Tax Exempt)"), parentUei (Common Parent UEI if present, else omit), legalName (Legal Business Name), dba (Doing Business As), ein (XX-XXXXXXX), businessTypes (comma-separated list of "Business Types" registered in SAM), samStatus ("Active" | "Expired" | "Submitted" | "Inactive"), samExpires (Registration Expiration Date, ISO YYYY-MM-DD), website, naicsPrimary (6-digit Primary NAICS), entityStartDate (ISO YYYY-MM-DD). Also extract the Physical Address (addrStreet1, addrStreet2, addrCity, addrState, addrZip, addrCountry) and the Mailing Address (mailStreet1, mailStreet2, mailCity, mailState, mailZip, mailCountry). CRITICAL: also extract the "Government Business POC" (sometimes labeled "Points of Contact — Government Business") and return: pocName (full name "First Last"), pocTitle, pocEmail, pocPhone. This person is the authorized negotiator candidate. If multiple POCs are listed, prefer the one explicitly labeled Government Business POC; otherwise use the primary POC. Omit any field you cannot find with reasonable confidence. Never invent values.',
      prompt: `Extract the business identity fields from "${data.filename}". Output strict JSON only.`,
      file: data,
      detail: "high",
    });

    const cleaned = text
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed: ExtractedIdentity = {};
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
      // Empty result on parse failure.
    }

    return { fields: parsed, raw: text };
  });
