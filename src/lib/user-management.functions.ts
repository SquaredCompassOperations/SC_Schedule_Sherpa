import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { mergeUsersWithProfiles, parseManagedRole, type ManagedUser } from "./user-management";

const UpdateProfileSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().max(200).nullable(),
  company: z.string().max(200).nullable(),
});

const SetRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.union([z.literal("admin"), z.literal("client")]),
});

async function requireAdmin(callerSupabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await callerSupabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) throw new Error("Could not verify admin access");
  if (!data) throw new Error("Forbidden: admin access required");
}

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await requireAdmin(context.supabase, context.userId);

    const [
      { data: authData, error: authError },
      { data: profiles, error: profileError },
      { data: roles, error: roleError },
    ] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("id, full_name, company"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    if (authError) throw new Error("Could not load users");
    if (profileError) throw new Error("Could not load profiles");
    if (roleError) throw new Error("Could not load roles");

    return mergeUsersWithProfiles(authData.users, profiles ?? [], roles ?? []);
  });

export const updateManagedUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateProfileSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName,
        company: data.company,
      })
      .eq("id", data.userId);

    if (error) throw new Error("Could not update user profile");
    return { ok: true };
  });

export const setManagedUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetRoleSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const role = parseManagedRole(data.role);

    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role }, { onConflict: "user_id" });

    if (error) throw new Error("Could not update user role");
    return { ok: true };
  });
