import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  uei: z.string().min(6).max(20).regex(/^[A-Z0-9]+$/i),
});

export type SamEntity = {
  found: boolean;
  source: "sam.gov" | "mock";
  uei?: string;
  cage?: string | null;
  legalName?: string;
  registrationStatus?: string;
  registrationDate?: string;
  expirationDate?: string;
  lastUpdate?: string;
  purposeOfRegistration?: string;
  physicalAddress?: string;
  naics?: string[];
  pscs?: string[];
  exclusionStatus?: string;
  daysUntilExpiration?: number | null;
  note?: string;
};

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 86400000);
}

export const lookupSamEntity = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<SamEntity> => {
    const uei = data.uei.toUpperCase();
    const apiKey = process.env.SAM_GOV_API_KEY;

    // Fallback: no key configured → return realistic mock so the module remains usable
    if (!apiKey) {
      return {
        found: true,
        source: "mock",
        uei,
        cage: "8K2P7",
        legalName: "Advantix Systems LLC",
        registrationStatus: "Active",
        registrationDate: "2022-04-12",
        expirationDate: "2025-04-12",
        lastUpdate: "2024-04-10",
        purposeOfRegistration: "All Awards",
        physicalAddress: "8200 Greensboro Dr, McLean, VA 22102",
        naics: ["541512", "541511", "541519"],
        pscs: ["D302", "D307", "R425"],
        exclusionStatus: "No active exclusions",
        daysUntilExpiration: daysUntil("2025-04-12"),
        note: "Showing mock data — add SAM_GOV_API_KEY to enable live lookups.",
      };
    }

    try {
      const url = new URL("https://api.sam.gov/entity-information/v3/entities");
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("ueiSAM", uei);
      url.searchParams.set("samRegistered", "Yes");

      const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
      if (!res.ok) {
        return { found: false, source: "sam.gov", uei, note: `SAM.gov returned ${res.status}` };
      }
      const json = (await res.json()) as {
        totalRecords?: number;
        entityData?: Array<{
          entityRegistration?: Record<string, string>;
          coreData?: {
            entityInformation?: Record<string, string>;
            physicalAddress?: Record<string, string>;
          };
          assertions?: { goodsAndServices?: { naicsList?: Array<{ naicsCode: string }>; pscList?: Array<{ pscCode: string }> } };
        }>;
      };

      if (!json.totalRecords || !json.entityData?.length) {
        return { found: false, source: "sam.gov", uei, note: "No SAM.gov record matched this UEI." };
      }

      const e = json.entityData[0];
      const reg = e.entityRegistration ?? {};
      const addr = e.coreData?.physicalAddress ?? {};
      const physical = [addr.addressLine1, addr.city, addr.stateOrProvinceCode, addr.zipCode]
        .filter(Boolean)
        .join(", ");

      return {
        found: true,
        source: "sam.gov",
        uei,
        cage: reg.cageCode ?? null,
        legalName: reg.legalBusinessName,
        registrationStatus: reg.registrationStatus,
        registrationDate: reg.registrationDate,
        expirationDate: reg.registrationExpirationDate,
        lastUpdate: reg.lastUpdateDate,
        purposeOfRegistration: reg.purposeOfRegistrationDesc,
        physicalAddress: physical || undefined,
        naics: e.assertions?.goodsAndServices?.naicsList?.map((n) => n.naicsCode).slice(0, 6),
        pscs: e.assertions?.goodsAndServices?.pscList?.map((p) => p.pscCode).slice(0, 6),
        exclusionStatus: reg.exclusionStatusFlag === "Y" ? "Active exclusions on file" : "No active exclusions",
        daysUntilExpiration: daysUntil(reg.registrationExpirationDate),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { found: false, source: "sam.gov", uei, note: `Lookup failed: ${msg}` };
    }
  });
