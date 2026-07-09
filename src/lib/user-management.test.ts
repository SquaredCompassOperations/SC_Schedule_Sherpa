import { describe, expect, it } from "vitest";
import {
  mergeUsersWithProfiles,
  parseManagedRole,
  resolveManagedRole,
} from "./user-management";

describe("parseManagedRole", () => {
  it("accepts admin and client", () => {
    expect(parseManagedRole("admin")).toBe("admin");
    expect(parseManagedRole("client")).toBe("client");
  });

  it("rejects legacy and unknown roles", () => {
    expect(() => parseManagedRole("team")).toThrow("Invalid role");
    expect(() => parseManagedRole("owner")).toThrow("Invalid role");
  });
});

describe("resolveManagedRole", () => {
  it("derives admin for squaredcompass.com users", () => {
    expect(resolveManagedRole("ops@squaredcompass.com", "admin")).toBe("admin");
  });

  it("derives client for external users", () => {
    expect(resolveManagedRole("client@example.com", "client")).toBe("client");
  });

  it("rejects requested roles that conflict with the target email", () => {
    expect(() => resolveManagedRole("ops@squaredcompass.com", "client")).toThrow(
      "Requested role does not match user email",
    );
    expect(() => resolveManagedRole("client@example.com", "admin")).toThrow(
      "Requested role does not match user email",
    );
  });
});

describe("mergeUsersWithProfiles", () => {
  it("combines auth users, profiles, and roles into stable admin records", () => {
    const users = mergeUsersWithProfiles(
      [
        {
          id: "admin-id",
          email: "ops@squaredcompass.com",
          created_at: "2026-07-09T01:00:00Z",
          last_sign_in_at: "2026-07-09T02:00:00Z",
        },
        {
          id: "client-id",
          email: "client@example.com",
          created_at: "2026-07-09T03:00:00Z",
          last_sign_in_at: null,
        },
      ],
      [
        { id: "admin-id", full_name: "Ops User", company: "Squared Compass" },
        { id: "client-id", full_name: "Client User", company: "Example LLC" },
      ],
      [
        { user_id: "admin-id", role: "admin" },
        { user_id: "client-id", role: "client" },
      ],
    );

    expect(users).toEqual([
      {
        id: "admin-id",
        email: "ops@squaredcompass.com",
        fullName: "Ops User",
        company: "Squared Compass",
        role: "admin",
        createdAt: "2026-07-09T01:00:00Z",
        lastSignInAt: "2026-07-09T02:00:00Z",
      },
      {
        id: "client-id",
        email: "client@example.com",
        fullName: "Client User",
        company: "Example LLC",
        role: "client",
        createdAt: "2026-07-09T03:00:00Z",
        lastSignInAt: null,
      },
    ]);
  });
});
