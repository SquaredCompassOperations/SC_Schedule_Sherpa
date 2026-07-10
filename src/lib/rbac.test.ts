import { describe, expect, it } from "vitest";
import { isAdminRole, normalizeAppRole, roleForEmail } from "./rbac";

describe("roleForEmail", () => {
  it("grants admin to squaredcompass.com emails", () => {
    expect(roleForEmail("rodney@squaredcompass.com")).toBe("admin");
  });

  it("treats mixed-case squaredcompass.com emails as admin", () => {
    expect(roleForEmail("Operations@SquaredCompass.com")).toBe("admin");
  });

  it("does not grant admin to lookalike domains", () => {
    expect(roleForEmail("person@squaredcompass.com.example")).toBe("client");
    expect(roleForEmail("person@example-squaredcompass.com")).toBe("client");
  });

  it("defaults external, empty, and missing emails to client", () => {
    expect(roleForEmail("client@example.com")).toBe("client");
    expect(roleForEmail("")).toBe("client");
    expect(roleForEmail(null)).toBe("client");
    expect(roleForEmail(undefined)).toBe("client");
  });
});

describe("normalizeAppRole", () => {
  it("preserves admin and client", () => {
    expect(normalizeAppRole("admin")).toBe("admin");
    expect(normalizeAppRole("client")).toBe("client");
  });

  it("treats legacy, unknown, and missing roles as client", () => {
    expect(normalizeAppRole("team")).toBe("client");
    expect(normalizeAppRole("owner")).toBe("client");
    expect(normalizeAppRole(null)).toBe("client");
  });
});

describe("isAdminRole", () => {
  it("only accepts admin", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("client")).toBe(false);
    expect(isAdminRole("team")).toBe(false);
  });
});
