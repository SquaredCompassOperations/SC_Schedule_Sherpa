import { describe, expect, it } from "vitest";
import {
  completeAutomationRun,
  failAutomationRun,
  saveMarketValidationResults,
  savePricingWorkbookOutput,
  saveSbaCertificationResults,
  saveScaLcatMatches,
  requireAutomationAdminAccess,
  startAutomationRun,
} from "./automation-runs";

type TableName =
  | "automation_runs"
  | "sba_certification_results"
  | "market_validation_results"
  | "sca_lcat_matches"
  | "pricing_workbook_outputs";

function createMockAutomationClient() {
  const inserts: Record<TableName, unknown[]> = {
    automation_runs: [],
    sba_certification_results: [],
    market_validation_results: [],
    sca_lcat_matches: [],
    pricing_workbook_outputs: [],
  };
  const updates: Record<TableName, Array<{ patch: unknown; column: string; value: string }>> = {
    automation_runs: [],
    sba_certification_results: [],
    market_validation_results: [],
    sca_lcat_matches: [],
    pricing_workbook_outputs: [],
  };
  const deletes: Array<{ table: TableName; column: string; value: string }> = [];
  return {
    inserts,
    updates,
    deletes,
    from: (table: TableName) => ({
      insert: (payload: unknown) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        inserts[table].push(...rows);
        return {
          select: () => ({
            single: async () => ({
              data: { id: "run-1", ...(rows[0] as object) },
              error: null,
            }),
          }),
        };
      },
      update: (patch: unknown) => ({
        eq: async (column: string, value: string) => {
          updates[table].push({ patch, column, value });
          return { error: null };
        },
      }),
      delete: () => ({
        eq: async (column: string, value: string) => {
          deletes.push({ table, column, value });
          return { error: null };
        },
      }),
    }),
  };
}

describe("automation run persistence", () => {
  it("allows automation writes only when the caller is an admin with offer access", async () => {
    const rpcCalls: Array<{ name: string; args: unknown }> = [];
    const callerClient = {
      rpc: async (name: string, args: unknown) => {
        rpcCalls.push({ name, args });
        if (name === "is_admin") return { data: true, error: null };
        if (name === "can_access_offer") return { data: true, error: null };
        return { data: null, error: new Error("unexpected rpc") };
      },
    };

    await expect(
      requireAutomationAdminAccess(callerClient as never, "offer-1"),
    ).resolves.toBeUndefined();

    expect(rpcCalls).toEqual([
      { name: "is_admin", args: {} },
      { name: "can_access_offer", args: { _offer_id: "offer-1" } },
    ]);
  });

  it("rejects automation writes when the caller is not an admin", async () => {
    const callerClient = {
      rpc: async (name: string) => ({
        data: name === "is_admin" ? false : true,
        error: null,
      }),
    };

    await expect(requireAutomationAdminAccess(callerClient as never, "offer-1")).rejects.toThrow(
      "Forbidden: admin access required",
    );
  });

  it("rejects automation writes when the admin cannot access the offer", async () => {
    const callerClient = {
      rpc: async (name: string) => ({
        data: name === "is_admin",
        error: null,
      }),
    };

    await expect(requireAutomationAdminAccess(callerClient as never, "offer-1")).rejects.toThrow(
      "Forbidden: offer access required",
    );
  });

  it("starts an offer-scoped automation run with normalized inputs", async () => {
    const client = createMockAutomationClient();

    const run = await startAutomationRun(
      {
        offerId: "offer-1",
        module: "market_validation",
        input: { sin: "561320", lcats: ["Program Manager"] },
        sourceUrls: ["https://www.gsaelibrary.gsa.gov/", " "],
      },
      client as never,
    );

    expect(run.id).toBe("run-1");
    expect(client.inserts.automation_runs[0]).toMatchObject({
      offer_id: "offer-1",
      module: "market_validation",
      status: "running",
      input: { sin: "561320", lcats: ["Program Manager"] },
      source_urls: ["https://www.gsaelibrary.gsa.gov/"],
      client_visible: false,
    });
  });

  it("marks a run complete with metrics and source URLs", async () => {
    const client = createMockAutomationClient();

    await completeAutomationRun(
      {
        runId: "run-1",
        metrics: { rows: 5, sourcesScanned: 3 },
        sourceUrls: ["https://example.com/source.pdf"],
        needsReview: true,
      },
      client as never,
    );

    expect(client.updates.automation_runs[0]).toEqual({
      column: "id",
      value: "run-1",
      patch: {
        status: "needs_review",
        metrics: { rows: 5, sourcesScanned: 3 },
        source_urls: ["https://example.com/source.pdf"],
        completed_at: expect.any(String),
      },
    });
  });

  it("marks a run failed with a readable error", async () => {
    const client = createMockAutomationClient();

    await failAutomationRun(
      { runId: "run-1", error: new Error("Firecrawl unavailable") },
      client as never,
    );

    expect(client.updates.automation_runs[0]).toEqual({
      column: "id",
      value: "run-1",
      patch: {
        status: "failed",
        error_message: "Firecrawl unavailable",
        completed_at: expect.any(String),
      },
    });
  });

  it("replaces SBA certification rows for a run", async () => {
    const client = createMockAutomationClient();

    await saveSbaCertificationResults(
      {
        runId: "run-1",
        offerId: "offer-1",
        uei: "ABC123456789",
        cageCode: "1A2B3",
        sourceUrl: "https://search.certifications.sba.gov/ABC123456789/1A2B3",
        evidenceType: "sba_profile",
        certs: [{ program: "WOSB", status: "Active", expiration: "2027-12-31" }],
      },
      client as never,
    );

    expect(client.deletes).toEqual([
      { table: "sba_certification_results", column: "run_id", value: "run-1" },
    ]);
    expect(client.inserts.sba_certification_results).toEqual([
      {
        run_id: "run-1",
        offer_id: "offer-1",
        uei: "ABC123456789",
        cage_code: "1A2B3",
        certification_program: "WOSB",
        certification_status: "Active",
        expiration_date: "2027-12-31",
        source_url: "https://search.certifications.sba.gov/ABC123456789/1A2B3",
        evidence_type: "sba_profile",
        confidence: 100,
        needs_review: false,
      },
    ]);
  });

  it("replaces market validation rows for a run", async () => {
    const client = createMockAutomationClient();

    await saveMarketValidationResults(
      {
        runId: "run-1",
        offerId: "offer-1",
        rows: [
          {
            sin: "561320",
            clientLcat: "Program Manager",
            laborCategory: "Project Manager",
            unitOfIssue: "Hour",
            netPrice: "$125.00",
            contractor: "Acme Federal",
            contractNumber: "47QRAA17D0007",
            sourceUrl: "https://www.gsaadvantage.gov/ref_text/example.pdf",
            needsReview: true,
          },
        ],
      },
      client as never,
    );

    expect(client.inserts.market_validation_results[0]).toMatchObject({
      run_id: "run-1",
      offer_id: "offer-1",
      sin: "561320",
      client_lcat: "Program Manager",
      labor_category: "Project Manager",
      unit_of_issue: "Hour",
      gsa_net_price: "$125.00",
      contractor: "Acme Federal",
      contract_number: "47QRAA17D0007",
      source_url: "https://www.gsaadvantage.gov/ref_text/example.pdf",
      needs_review: true,
    });
  });

  it("replaces SCA match rows for a run", async () => {
    const client = createMockAutomationClient();

    await saveScaLcatMatches(
      {
        runId: "run-1",
        offerId: "offer-1",
        matches: [
          {
            clientLcat: "Administrative Assistant",
            clientDescription: "Provides clerical office support.",
            matchStatus: "matched",
            scaCode: "01020",
            scaTitle: "Administrative Assistant",
            scaFamily: "Administrative Support And Clerical Occupations",
            confidence: 92,
            rationale: "Title and duties align.",
            sourceUrl: "https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/SCADirectVers5.pdf",
            wageDeterminationTable: "Table 1",
          },
        ],
      },
      client as never,
    );

    expect(client.inserts.sca_lcat_matches[0]).toMatchObject({
      run_id: "run-1",
      offer_id: "offer-1",
      client_lcat: "Administrative Assistant",
      match_status: "matched",
      sca_code: "01020",
      sca_title: "Administrative Assistant",
      confidence: 92,
      wage_determination_table: "Table 1",
    });
  });

  it("saves pricing workbook output metadata", async () => {
    const client = createMockAutomationClient();

    await savePricingWorkbookOutput(
      {
        runId: "run-1",
        offerId: "offer-1",
        templateKind: "fcp-services-plus",
        templateRefresh: "32",
        filename: "offer_fcp-services-plus_filled.xlsx",
        rowCount: 12,
        sourceTemplateUrl:
          "https://www.gsa.gov/system/files/6.12.2026%20FCP_Services_Plus_File_Refresh_32_FINAL.xlsx",
        outputSummary: { commercialRows: 8, scaRows: 4 },
      },
      client as never,
    );

    expect(client.inserts.pricing_workbook_outputs[0]).toMatchObject({
      run_id: "run-1",
      offer_id: "offer-1",
      template_kind: "fcp-services-plus",
      template_refresh: "32",
      filename: "offer_fcp-services-plus_filled.xlsx",
      row_count: 12,
      source_template_url:
        "https://www.gsa.gov/system/files/6.12.2026%20FCP_Services_Plus_File_Refresh_32_FINAL.xlsx",
      output_summary: { commercialRows: 8, scaRows: 4 },
    });
  });
});
