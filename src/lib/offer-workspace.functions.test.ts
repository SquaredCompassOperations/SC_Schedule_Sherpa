import { describe, expect, it } from "vitest";
import {
  createOfferWorkspace,
  getOfferWorkspace,
  listOrganizations,
  listOfferWorkspaces,
  logOfferActivity,
} from "./offer-workspace.functions";

function listClient(data: unknown, error: Error | null = null) {
  return {
    from: (table: string) => {
      expect(table).toBe("offers");
      return {
        select: (selection: string) => {
          expect(selection).toContain("organizations");
          return {
            order: async (column: string, options: { ascending: boolean }) => {
              expect(column).toBe("updated_at");
              expect(options).toEqual({ ascending: false });
              return { data, error };
            },
          };
        },
      };
    },
  };
}

function getClient(data: unknown, error: Error | null = null) {
  return {
    from: (table: string) => {
      expect(table).toBe("offers");
      return {
        select: () => ({
          eq: (column: string, value: string) => {
            expect(column).toBe("id");
            expect(value).toBe("offer-1");
            return {
              maybeSingle: async () => ({ data, error }),
            };
          },
        }),
      };
    },
  };
}

describe("listOfferWorkspaces", () => {
  it("maps Supabase rows into cards", async () => {
    const cards = await listOfferWorkspaces(
      listClient([
        {
          id: "offer-1",
          organization_id: "org-1",
          name: "Acme GSA MAS Offer",
          offer_type: "gsa_mas",
          solicitation_number: "47QSMD20R0001",
          agency: "GSA",
          owner_user_id: null,
          current_stage: "intake",
          status: "active",
          readiness_percent: 25,
          documents_in_review: 0,
          open_client_items: 1,
          authorized_negotiator_email: null,
          authorized_negotiator_status: "missing",
          submission_status: "not_started",
          selected_sins: [],
          target_submission_date: null,
          archived_at: null,
          created_at: "2026-07-10T00:00:00Z",
          updated_at: "2026-07-10T00:00:00Z",
          organizations: {
            id: "org-1",
            legal_name: "Acme LLC",
            dba: null,
            website: null,
            primary_contact_name: null,
            primary_contact_email: null,
            status: "active",
            created_at: "2026-07-10T00:00:00Z",
            updated_at: "2026-07-10T00:00:00Z",
          },
        },
      ]) as never,
    );

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      id: "offer-1",
      organizationName: "Acme LLC",
      nextAction: "Resolve 1 client item(s)",
    });
  });

  it("throws a readable error when listing fails", async () => {
    await expect(
      listOfferWorkspaces(listClient(null, new Error("RLS denied")) as never),
    ).rejects.toThrow("Could not load offer workspaces: RLS denied");
  });
});

describe("getOfferWorkspace", () => {
  it("returns null when the workspace is missing", async () => {
    await expect(getOfferWorkspace("offer-1", getClient(null) as never)).resolves.toBe(null);
  });
});

describe("createOfferWorkspace", () => {
  it("calls the atomic creation RPC with normalized values", async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const client = {
      rpc: async (name: string, args: unknown) => {
        calls.push({ name, args });
        return { data: [{ organization_id: "org-1", offer_id: "offer-1" }], error: null };
      },
    };

    await expect(
      createOfferWorkspace(
        {
          organizationName: " Acme LLC ",
          offerName: " Acme GSA MAS Offer ",
          clientEmail: " CLIENT@ACME.EXAMPLE ",
          solicitationNumber: " 47QSMD20R0001 ",
        },
        client as never,
      ),
    ).resolves.toEqual({ offerId: "offer-1", organizationId: "org-1" });

    expect(calls).toEqual([
      {
        name: "create_offer_workspace",
        args: {
          p_organization_id: null,
          p_organization_name: "Acme LLC",
          p_offer_name: "Acme GSA MAS Offer",
          p_client_email: "client@acme.example",
          p_solicitation_number: "47QSMD20R0001",
        },
      },
    ]);
  });

  it("reuses the selected organization without requiring a name", async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const client = {
      rpc: async (name: string, args: unknown) => {
        calls.push({ name, args });
        return { data: [{ organization_id: "org-1", offer_id: "offer-1" }], error: null };
      },
    };

    await createOfferWorkspace(
      { organizationId: "org-1", organizationName: "", offerName: "Second offer" },
      client as never,
    );

    expect(calls[0]?.args).toMatchObject({
      p_organization_id: "org-1",
      p_organization_name: null,
    });
  });

  it("surfaces atomic creation failures without attempting client-side writes", async () => {
    const client = {
      rpc: async () => ({ data: null, error: new Error("permission denied") }),
      from: () => {
        throw new Error("client-side writes must not occur");
      },
    };

    await expect(
      createOfferWorkspace({ organizationName: "Acme LLC", offerName: "Acme offer" }, client as never),
    ).rejects.toThrow("Could not create offer workspace: permission denied");
  });
});

describe("listOrganizations", () => {
  it("returns organization options ordered by legal name", async () => {
    const organizations = await listOrganizations({
      from: (table: string) => {
        expect(table).toBe("organizations");
        return {
          select: (selection: string) => {
            expect(selection).toBe("id, legal_name");
            return {
              order: async (column: string, options: { ascending: boolean }) => {
                expect(column).toBe("legal_name");
                expect(options).toEqual({ ascending: true });
                return { data: [{ id: "org-1", legal_name: "Acme LLC" }], error: null };
              },
            };
          },
        };
      },
    } as never);

    expect(organizations).toEqual([{ id: "org-1", legalName: "Acme LLC" }]);
  });
});

describe("logOfferActivity", () => {
  it("inserts a client-visible activity row", async () => {
    const inserts: unknown[] = [];
    const client = {
      from: (table: string) => ({
        insert: async (payload: unknown) => {
          expect(table).toBe("offer_activity");
          inserts.push(payload);
          return { error: null };
        },
      }),
    };

    await logOfferActivity(
      {
        offerId: "offer-1",
        module: "Workspace",
        action: "created workspace",
        visibility: "client",
      },
      client as never,
    );

    expect(inserts).toEqual([
      {
        offer_id: "offer-1",
        actor_user_id: null,
        module: "Workspace",
        action: "created workspace",
        target: null,
        visibility: "client",
      },
    ]);
  });
});
