import { createServerFn } from "@tanstack/react-start";
import manifest from "../../public/templates/manifest.json";

type InteractAlert = {
  keyword: string;
  excerpt: string;
};

type VersionStatus = {
  bundledRefresh: string;
  latestDetected: string | null;
  upToDate: boolean;
  message: string;
  interactChecked: boolean;
  interactAlerts: InteractAlert[];
  interactMessage: string;
};

const INTERACT_URL = "https://buy.gsa.gov/interact/community/6/activity-feed";
const INTERACT_KEYWORDS = ["New Offer Checklist", "Pricing Terms", "Pricing File"];

async function checkInteractFeed(): Promise<{
  checked: boolean;
  alerts: InteractAlert[];
  message: string;
}> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) {
    return {
      checked: false,
      alerts: [],
      message: "GSA Interact check skipped — Firecrawl not configured.",
    };
  }
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: INTERACT_URL,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    if (!res.ok) {
      return {
        checked: true,
        alerts: [],
        message: `GSA Interact unreachable [${res.status}] — manual check recommended.`,
      };
    }
    const j: { data?: { markdown?: string } } = await res.json();
    const md = (j.data?.markdown ?? "").slice(0, 20000);
    if (!md.trim()) {
      return { checked: true, alerts: [], message: "GSA Interact feed returned no content." };
    }
    const alerts: InteractAlert[] = [];
    const lines = md.split(/\n+/);
    for (const kw of INTERACT_KEYWORDS) {
      const hit = lines.find((l) => l.toLowerCase().includes(kw.toLowerCase()));
      if (hit) alerts.push({ keyword: kw, excerpt: hit.trim().slice(0, 280) });
    }
    return {
      checked: true,
      alerts,
      message: alerts.length
        ? `GSA Interact mentions ${alerts.length} tracked item(s) — review the feed for refresh impact.`
        : "GSA Interact feed scanned — no new posts mention Offer Checklist, Pricing Terms, or Pricing File.",
    };
  } catch (e) {
    return {
      checked: true,
      alerts: [],
      message: `GSA Interact check errored: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// Quick HEAD-check of GSA template URLs. GSA names files like "Refresh 31",
// "Refresh 32", etc. We probe the next 3 increments to see if a newer one exists.
// Also scrapes the GSA Interact activity feed for new refresh announcements.
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
    const interact = await checkInteractFeed();
    return {
      bundledRefresh: manifest.refresh,
      latestDetected: upToDate ? null : String(latest),
      upToDate,
      message: upToDate
        ? `Bundled templates match GSA Refresh ${bundled} (last verified ${manifest.downloadedAt}).`
        : `Newer GSA refresh detected: Refresh ${latest}. Bundled = Refresh ${bundled}. Update recommended.`,
      interactChecked: interact.checked,
      interactAlerts: interact.alerts,
      interactMessage: interact.message,
    };
  },
);
