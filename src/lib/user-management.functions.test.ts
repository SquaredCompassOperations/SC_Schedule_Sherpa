import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { setManagedUserRoleForAdmin } from "./user-management.functions";

type RoleRow = { role: "admin" | "client" } | null;

function callerSupabaseWithRole(role: RoleRow) {
  return {
    from: (table: string) => {
      expect(table).toBe("user_roles");

      const filters: Array<[string, string]> = [];

      const query = {
        select: () => query,
        eq: (column: string, value: string) => {
          filters.push([column, value]);
          return query;
        },
        maybeSingle: async () => ({
          data:
            role?.role === "admin" &&
            filters.some(([column, value]) => column === "role" && value === "admin")
              ? role
              : null,
          error: null,
        }),
      };

      return query;
    },
  } as unknown as SupabaseClient<Database>;
}

describe("setManagedUserRoleForAdmin", () => {
  it("rejects a non-admin caller before any service-role operation", async () => {
    let targetUserLookups = 0;
    let roleWrites = 0;

    await expect(
      setManagedUserRoleForAdmin({
        callerSupabase: callerSupabaseWithRole({ role: "client" }),
        callerUserId: "caller-id",
        targetUserId: "target-id",
        requestedRole: "client",
        serviceRoleOperations: {
          getUserById: async () => {
            targetUserLookups += 1;
            return { data: { user: { email: "client@example.com" } }, error: null };
          },
          upsertRole: async () => {
            roleWrites += 1;
            return { error: null };
          },
        },
      }),
    ).rejects.toThrow("Forbidden: admin access required");

    expect(targetUserLookups).toBe(0);
    expect(roleWrites).toBe(0);
  });

  it("writes the role derived from the target Auth email after authorizing the caller", async () => {
    const writes: Array<{ userId: string; role: "admin" | "client" }> = [];

    await expect(
      setManagedUserRoleForAdmin({
        callerSupabase: callerSupabaseWithRole({ role: "admin" }),
        callerUserId: "admin-id",
        targetUserId: "target-id",
        requestedRole: "admin",
        serviceRoleOperations: {
          getUserById: async () => ({
            data: { user: { email: "operations@SquaredCompass.com" } },
            error: null,
          }),
          upsertRole: async (userId, role) => {
            writes.push({ userId, role });
            return { error: null };
          },
        },
      }),
    ).resolves.toEqual({ ok: true });

    expect(writes).toEqual([{ userId: "target-id", role: "admin" }]);
  });

  it("does not write a role when the requested role conflicts with the target email", async () => {
    let roleWrites = 0;

    await expect(
      setManagedUserRoleForAdmin({
        callerSupabase: callerSupabaseWithRole({ role: "admin" }),
        callerUserId: "admin-id",
        targetUserId: "target-id",
        requestedRole: "admin",
        serviceRoleOperations: {
          getUserById: async () => ({
            data: { user: { email: "client@example.com" } },
            error: null,
          }),
          upsertRole: async () => {
            roleWrites += 1;
            return { error: null };
          },
        },
      }),
    ).rejects.toThrow("Requested role does not match user email");

    expect(roleWrites).toBe(0);
  });
});
