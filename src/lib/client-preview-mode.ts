import type { AppRole } from "@/lib/rbac";

export type AdminViewMode = "admin" | "client-preview";

export function canUseClientPreview(role: AppRole | null | undefined) {
  return role === "admin";
}

export function getAdminViewModeForPath(pathname: string): AdminViewMode {
  if (pathname === "/client" || pathname.startsWith("/client/")) return "client-preview";
  return "admin";
}

export function getAdminViewModeTarget(mode: AdminViewMode): "/" | "/client" {
  return mode === "admin" ? "/" : "/client";
}
