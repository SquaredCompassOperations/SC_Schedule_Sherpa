import { createServerFn } from "@tanstack/react-start";
import manifest from "../../public/templates/manifest.json";

type InteractAlert = {
  keyword: string;
  excerpt: string;
};

type TemplateLink = {
  label: string;
  url: string;
};

type VersionStatus = {
  bundledRefresh: string;
  latestDetected: string | null;
  upToDate: boolean;
  message: string;
  source: string;
  detectedLinks: TemplateLink[];
  interactChecked: boolean;
  interactAlerts: InteractAlert[];
  interactMessage: string;
};

const REQUIRED_TEMPLATES_URL =
  "https://www.gsa.gov/sell-to-government/step-1-learn-about-government-contracting/how-to-access-contract-opportunities/help-with-mas-contracts-to-sell-to-government/roadmap-to-get-a-mas-contract/required-templates-for-a-mas-offer";
const INTERACT_URL = "https://buy.gsa.gov/interact/community/6/activity-feed";
const INTERACT_KEYWORDS = ["New Offer Checklist", "Pricing Terms", "Pricing File", "Refresh"];

// Note: HTML is normalized (%20 → space) before regex matching to prevent
// "Refresh%2032" being misread as "Refresh 2032". Refresh numbers are 1-2 digits.
const TRACKED_TEMPLATES: Array<{ label: string; pattern: RegExp }> = [
  { label: "Pricing Terms", pattern: /Pricing[^"'<>]*Refresh[\s_-]+(\d{1,2})\b[^"'<>]*\.xlsx/gi },
  { label: "FCP Product File", pattern: /FCP[^"'<>]*Product[^"'<>]*Refresh[\s_-]+(\d{1,2})\b[^"'<>]*\.xlsx/gi },
  { label: "FCP Services Plus File", pattern: /FCP[^"'<>]*Services[^"'<>]*Plus[^"'<>]*Refresh[\s_-]+(\d{1,2})\b[^"'<>]*\.xlsx/gi },
  { label: "New Offer Checklist", pattern: /New[\s_-]+Offer[\s_-]+Checklist[^"'<>]*Refresh[\s_-]+(\d{1,2})\b[^"'<>]*\.xlsx/gi },
];

async function scrapeRequiredTemplates(): Promise<{
  html: string;
  source: string;
} | null> {
  // Try direct fetch first (page is public).
  try {
    const res = await fetch(REQUIRED_TEMPLATES_URL, {
      headers: { "User-Agent": "Mozilla/5.0 ScheduleBuilder/1.0" },
    });
    if (res.ok) {
      const html = await res.text();
      if (html.length > 1000) return { html, source: "gsa.gov (direct)" };
    }
  } catch {
    // fall through to Firecrawl
  }
  // Firecrawl fallback for environments that block outbound HTML.
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: REQUIRED_TEMPLATES_URL,
        formats: ["html", "markdown"],
        onlyMainContent: true,
      }),
    });
    if (!res.ok) return null;
    const j: { data?: { html?: string; markdown?: string } } = await res.json();
    const html = j.data?.html ?? j.data?.markdown ?? "";
    if (html.length > 500) return { html, source: "gsa.gov (Firecrawl)" };
  } catch {
    return null;
  }
  return null;
}

function findLatestRefresh(html: string): {
  latest: number;
  links: TemplateLink[];
} {
  let latest = 0;
  const links: TemplateLink[] = [];
  for (const t of TRACKED_TEMPLATES) {
    let m: RegExpExecArray | null;
    let best = 0;
    let bestUrl = "";
    const re = new RegExp(t.pattern.source, "gi");
    while ((m = re.exec(html)) !== null) {
      const n = parseInt(m[1], 10);
      if (!Number.isFinite(n)) continue;
      if (n > best) {
        best = n;
        // Reconstruct URL: find the nearest preceding https:// up to the match
        const before = html.slice(0, m.index);
        const urlStart = before.lastIndexOf("https://");
        if (urlStart >= 0) {
          const tail = html.slice(urlStart);
          const urlEnd = tail.search(/["'<>\s)]/);
          bestUrl = urlEnd > 0 ? tail.slice(0, urlEnd) : "";
        }
      }
    }
    if (best > 0) {
      latest = Math.max(latest, best);
      links.push({ label: `${t.label} (Refresh ${best})`, url: bestUrl });
    }
  }
  // Final sweep: any "Refresh NN" mention as a safety net
  const generic = /Refresh[%\s_-]*(\d{2,3})/gi;
  let g: RegExpExecArray | null;
  while ((g = generic.exec(html)) !== null) {
    const n = parseInt(g[1], 10);
    if (Number.isFinite(n) && n > latest) latest = n;
  }
  return { latest, links };
}

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

// Scrapes the official GSA "Required templates for a MAS offer" page and
// extracts the highest "Refresh NN" number referenced in the template filenames.
// This is more robust than HEAD-probing guessed filenames because GSA appends
// suffixes like _0, _TDR_EDIT_060126, etc. Also checks the Interact activity feed.
export const checkGsaTemplateVersion = createServerFn({ method: "GET" }).handler(
  async (): Promise<VersionStatus> => {
    const bundled = parseInt(manifest.refresh, 10);
    const scrape = await scrapeRequiredTemplates();
    const interact = await checkInteractFeed();

    if (!scrape) {
      return {
        bundledRefresh: manifest.refresh,
        latestDetected: null,
        upToDate: true,
        message: `Unable to reach GSA template index — bundled Refresh ${bundled} (verified ${manifest.downloadedAt}) assumed current.`,
        source: "offline",
        detectedLinks: [],
        interactChecked: interact.checked,
        interactAlerts: interact.alerts,
        interactMessage: interact.message,
      };
    }

    const { latest, links } = findLatestRefresh(scrape.html);
    const detected = latest > 0 ? latest : bundled;
    const upToDate = detected <= bundled;
    return {
      bundledRefresh: manifest.refresh,
      latestDetected: upToDate ? null : String(detected),
      upToDate,
      message: upToDate
        ? `Bundled templates match GSA Refresh ${bundled} (verified against ${scrape.source} on ${new Date().toISOString().slice(0, 10)}).`
        : `Newer GSA refresh detected: Refresh ${detected}. Bundled = Refresh ${bundled}. Update the bundled templates in /public/templates and bump manifest.refresh.`,
      source: scrape.source,
      detectedLinks: links,
      interactChecked: interact.checked,
      interactAlerts: interact.alerts,
      interactMessage: interact.message,
    };
  },
);
