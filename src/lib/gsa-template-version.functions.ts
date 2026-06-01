import { createServerFn } from "@tanstack/react-start";
import manifest from "../../public/templates/manifest.json";

type VersionStatus = {
  bundledRefresh: string;
  latestDetected: string | null;
  upToDate: boolean;
  message: string;
};

// Quick HEAD-check of GSA template URLs. GSA names files like "Refresh 31",
// "Refresh 32", etc. We probe the next 3 increments to see if a newer one exists.
export const checkGsaTemplateVersion = createServerFn({ method: "GET" }).handler(
  async (): Promise<VersionStatus> => {
    const bundled = parseInt(manifest.refresh, 10);
    let latest = bundled;
    try {
      for (let i = 1; i <= 3; i++) {
        const probe = bundled + i;
        const url = `https://www.gsa.gov/system/files/Pricing%20Terms%20Attachment%20-Refresh%20${probe}_01.xlsx`;
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok) latest = probe;
      }
    } catch {
      // network failure — treat as up-to-date
    }
    const upToDate = latest === bundled;
    return {
      bundledRefresh: manifest.refresh,
      latestDetected: upToDate ? null : String(latest),
      upToDate,
      message: upToDate
        ? `Bundled templates match GSA Refresh ${bundled} (last verified ${manifest.downloadedAt}).`
        : `Newer GSA refresh detected: Refresh ${latest}. Bundled = Refresh ${bundled}. Update recommended.`,
    };
  },
);
