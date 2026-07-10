import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("offer workspace re-review boundaries", () => {
  it("waits for assigned workspaces before routing a fresh client to readiness", () => {
    const route = projectFile("src/routes/client.index.tsx");

    expect(route).toContain("workspaces.isSuccess && (workspaces.data ?? []).length === 0");
  });

  it("blocks workspace creation and explains when existing organizations cannot load", () => {
    const board = projectFile("src/components/workspace-board.tsx");

    expect(board).toContain("organizationError={organizations.isError");
    expect(board).toContain("Could not load existing organizations. Try again before creating a workspace.");
    expect(board).toContain("disabled={busy || Boolean(organizationError)}");
  });

  it("reserves workspace-creation inserts for the security-definer RPC", () => {
    const migration = projectFile("supabase/migrations/20260710090000_offer_workspace_foundation.sql");

    expect(migration).toContain("GRANT SELECT, UPDATE, DELETE ON public.organizations TO authenticated;");
    expect(migration).toContain("GRANT SELECT, UPDATE, DELETE ON public.offers TO authenticated;");
    expect(migration).toContain("GRANT SELECT, UPDATE, DELETE ON public.offer_members TO authenticated;");
    expect(migration).toContain("GRANT SELECT ON public.offer_activity TO authenticated;");
    expect(migration).not.toMatch(
      /GRANT[^;]*INSERT[^;]*ON public\.(organizations|offers|offer_members|offer_activity) TO authenticated;/,
    );
    expect(migration).not.toContain('CREATE POLICY "Admins create organizations"');
    expect(migration).not.toContain('CREATE POLICY "Admins create offers"');
    expect(migration).not.toContain('CREATE POLICY "Admins create offer members"');
    expect(migration).not.toContain('CREATE POLICY "Admins create offer activity"');
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.create_offer_workspace(");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.create_offer_workspace(TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;",
    );
  });
});
