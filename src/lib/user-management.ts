import { normalizeAppRole, roleForEmail, type AppRole } from "./rbac";

export type AuthUserSummary = {
  id: string;
  email?: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
};

export type ProfileSummary = {
  id: string;
  full_name: string | null;
  company: string | null;
};

export type RoleSummary = {
  user_id: string;
  role: AppRole | string | null;
};

export type ManagedUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  company: string | null;
  role: AppRole;
  createdAt: string | null;
  lastSignInAt: string | null;
};

export function parseManagedRole(role: unknown): AppRole {
  if (role === "admin" || role === "client") return role;
  throw new Error("Invalid role");
}

export function resolveManagedRole(
  email: string | null | undefined,
  requestedRole: unknown,
): AppRole {
  const derivedRole = roleForEmail(email);

  if (parseManagedRole(requestedRole) !== derivedRole) {
    throw new Error("Requested role does not match user email");
  }

  return derivedRole;
}

export function mergeUsersWithProfiles(
  authUsers: AuthUserSummary[],
  profiles: ProfileSummary[],
  roles: RoleSummary[],
): ManagedUser[] {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const rolesByUserId = new Map(roles.map((role) => [role.user_id, role]));

  return authUsers.map((user) => {
    const profile = profilesById.get(user.id);
    const role = rolesByUserId.get(user.id);

    return {
      id: user.id,
      email: user.email ?? null,
      fullName: profile?.full_name ?? null,
      company: profile?.company ?? null,
      role: normalizeAppRole(role?.role),
      createdAt: user.created_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
    };
  });
}
