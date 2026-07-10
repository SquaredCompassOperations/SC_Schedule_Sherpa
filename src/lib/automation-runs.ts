import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

export type AutomationModule = Database["public"]["Enums"]["automation_module"];
export type AutomationRunStatus = Database["public"]["Enums"]["automation_run_status"];
export type AutomationClient = {
  from: (table: string) => {
    insert: (payload: unknown) => {
      select?: (columns?: string) => {
        single: () => Promise<{ data: unknown; error: { message?: string } | null }>;
      };
    };
    update: (patch: unknown) => {
      eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
    };
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
    };
  };
};
export type CallerAutomationClient = SupabaseClient<Database>;

type StartedAutomationRun = {
  id: string;
  offer_id: string;
  module: AutomationModule;
  status: AutomationRunStatus;
};

type MarketValidationRow = {
  sin: string;
  clientLcat?: string;
  laborCategory: string;
  unitOfIssue: string;
  netPrice: string;
  contractor: string;
  contractNumber: string;
  sourceUrl: string;
  needsReview?: boolean;
};

type ScaLcatMatch = {
  clientLcat: string;
  clientDescription?: string;
  matchStatus: "matched" | "no_equivalent" | "needs_review";
  scaCode?: string | null;
  scaTitle?: string | null;
  scaFamily?: string | null;
  confidence?: number | null;
  rationale?: string | null;
  sourceUrl?: string | null;
  wageDeterminationTable?: string | null;
};

type SupabaseError = { message?: string } | null;

function clientOrDefault(client?: AutomationClient): AutomationClient {
  return client ?? (supabaseAdmin as unknown as AutomationClient);
}

function cleanSourceUrls(urls?: string[]) {
  return Array.from(new Set((urls ?? []).map((url) => url.trim()).filter(Boolean)));
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? {})) as Json;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Automation run failed";
}

function assertNoError(error: SupabaseError, action: string) {
  if (error) throw new Error(`${action}: ${error.message ?? "Supabase request failed"}`);
}

export async function requireAutomationAdminAccess(
  callerSupabase: CallerAutomationClient,
  offerId: string,
) {
  const admin = await callerSupabase.rpc("is_admin", {});
  assertNoError(admin.error, "Could not verify admin access");
  if (!admin.data) throw new Error("Forbidden: admin access required");

  const access = await callerSupabase.rpc("can_access_offer", { _offer_id: offerId });
  assertNoError(access.error, "Could not verify offer access");
  if (!access.data) throw new Error("Forbidden: offer access required");
}

async function replaceRunRows(
  client: AutomationClient,
  table: string,
  runId: string,
  rows: unknown[],
) {
  const deleteResult = await client.from(table).delete().eq("run_id", runId);
  assertNoError(deleteResult.error, `Could not clear ${table}`);
  if (rows.length === 0) return;
  const insertResult = (await client.from(table).insert(rows)) as { error?: SupabaseError };
  assertNoError(insertResult.error ?? null, `Could not insert ${table}`);
}

export async function startAutomationRun(
  input: {
    offerId: string;
    module: AutomationModule;
    input?: unknown;
    sourceUrls?: string[];
    clientVisible?: boolean;
  },
  client?: AutomationClient,
): Promise<StartedAutomationRun> {
  const db = clientOrDefault(client);
  const builder = db.from("automation_runs").insert({
    offer_id: input.offerId,
    module: input.module,
    status: "running",
    input: toJson(input.input),
    metrics: {},
    source_urls: cleanSourceUrls(input.sourceUrls),
    client_visible: input.clientVisible ?? false,
  });

  if (!builder.select) {
    throw new Error("Could not start automation run: insert did not return a selectable builder");
  }

  const { data, error } = await builder.select("*").single();
  assertNoError(error, "Could not start automation run");
  if (!data || typeof data !== "object" || !("id" in data)) {
    throw new Error("Could not start automation run: Supabase returned no run id");
  }
  return data as StartedAutomationRun;
}

export async function completeAutomationRun(
  input: {
    runId: string;
    metrics?: unknown;
    sourceUrls?: string[];
    needsReview?: boolean;
  },
  client?: AutomationClient,
) {
  const db = clientOrDefault(client);
  const patch = {
    status: input.needsReview ? "needs_review" : "completed",
    metrics: toJson(input.metrics),
    source_urls: cleanSourceUrls(input.sourceUrls),
    completed_at: new Date().toISOString(),
  };
  const { error } = await db.from("automation_runs").update(patch).eq("id", input.runId);
  assertNoError(error, "Could not complete automation run");
}

export async function failAutomationRun(
  input: {
    runId: string;
    error: unknown;
  },
  client?: AutomationClient,
) {
  const db = clientOrDefault(client);
  const { error } = await db
    .from("automation_runs")
    .update({
      status: "failed",
      error_message: errorMessage(input.error),
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.runId);
  assertNoError(error, "Could not fail automation run");
}

export async function saveSbaCertificationResults(
  input: {
    runId: string;
    offerId: string;
    uei: string;
    cageCode?: string | null;
    sourceUrl: string;
    evidenceType: "sba_profile" | "screenshot";
    certs: Array<{ program: string; status: string; expiration?: string | null }>;
  },
  client?: AutomationClient,
) {
  const db = clientOrDefault(client);
  const rows = input.certs.map((cert) => ({
    run_id: input.runId,
    offer_id: input.offerId,
    uei: input.uei,
    cage_code: input.cageCode ?? null,
    certification_program: cert.program,
    certification_status: cert.status,
    expiration_date: cert.expiration ?? null,
    source_url: input.sourceUrl,
    evidence_type: input.evidenceType,
    confidence: input.evidenceType === "sba_profile" ? 100 : 75,
    needs_review: input.evidenceType === "screenshot",
  }));
  await replaceRunRows(db, "sba_certification_results", input.runId, rows);
}

export async function saveMarketValidationResults(
  input: {
    runId: string;
    offerId: string;
    rows: MarketValidationRow[];
  },
  client?: AutomationClient,
) {
  const db = clientOrDefault(client);
  const rows = input.rows.map((row) => ({
    run_id: input.runId,
    offer_id: input.offerId,
    sin: row.sin,
    client_lcat: row.clientLcat ?? null,
    labor_category: row.laborCategory,
    unit_of_issue: row.unitOfIssue,
    gsa_net_price: row.netPrice,
    contractor: row.contractor,
    contract_number: row.contractNumber,
    source_url: row.sourceUrl,
    needs_review: row.needsReview ?? false,
  }));
  await replaceRunRows(db, "market_validation_results", input.runId, rows);
}

export async function saveScaLcatMatches(
  input: {
    runId: string;
    offerId: string;
    matches: ScaLcatMatch[];
  },
  client?: AutomationClient,
) {
  const db = clientOrDefault(client);
  const rows = input.matches.map((match) => ({
    run_id: input.runId,
    offer_id: input.offerId,
    client_lcat: match.clientLcat,
    client_description: match.clientDescription ?? null,
    match_status: match.matchStatus,
    sca_code: match.scaCode ?? null,
    sca_title: match.scaTitle ?? null,
    sca_family: match.scaFamily ?? null,
    confidence: match.confidence ?? null,
    rationale: match.rationale ?? null,
    source_url: match.sourceUrl ?? null,
    wage_determination_table: match.wageDeterminationTable ?? null,
    needs_review: match.matchStatus !== "matched" || (match.confidence ?? 0) < 80,
  }));
  await replaceRunRows(db, "sca_lcat_matches", input.runId, rows);
}

export async function savePricingWorkbookOutput(
  input: {
    runId: string;
    offerId: string;
    templateKind: "fcp-product" | "fcp-services-plus";
    templateRefresh: string;
    filename: string;
    rowCount: number;
    sourceTemplateUrl?: string | null;
    outputSummary?: unknown;
    needsReview?: boolean;
  },
  client?: AutomationClient,
) {
  const db = clientOrDefault(client);
  await replaceRunRows(db, "pricing_workbook_outputs", input.runId, [
    {
      run_id: input.runId,
      offer_id: input.offerId,
      template_kind: input.templateKind,
      template_refresh: input.templateRefresh,
      filename: input.filename,
      row_count: input.rowCount,
      source_template_url: input.sourceTemplateUrl ?? null,
      output_summary: toJson(input.outputSummary),
      needs_review: input.needsReview ?? false,
    },
  ]);
}
