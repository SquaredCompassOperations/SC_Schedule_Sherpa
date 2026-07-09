export const ADMIN_EMAIL_DOMAIN = "@squaredcompass.com";

export type AppRole = "admin" | "client";

export function isAdminEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase().endsWith(ADMIN_EMAIL_DOMAIN);
}

export function roleForEmail(email: string | null | undefined): AppRole {
  return isAdminEmail(email) ? "admin" : "client";
}

export function normalizeAppRole(role: unknown): AppRole {
  return role === "admin" ? "admin" : "client";
}

export function isAdminRole(role: unknown): role is "admin" {
  return role === "admin";
}
