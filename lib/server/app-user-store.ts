import type { User } from "@supabase/supabase-js";
import type { AppUser } from "@/lib/types/app-user";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { hasSupabaseServiceEnv } from "@/lib/supabase/env";

type AppUserRow = {
  id: string;
  auth_user_id: string;
  email: string;
  display_name: string | null;
};

function mapRow(row: AppUserRow): AppUser {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    displayName: row.display_name
  };
}

function inferDisplayName(user: User) {
  const metadata = user.user_metadata ?? {};
  return (
    metadata.full_name ??
    metadata.name ??
    metadata.user_name ??
    (user.email ? user.email.split("@")[0] : null) ??
    null
  );
}

export async function ensureAppUser(authUser: User): Promise<AppUser> {
  if (!hasSupabaseServiceEnv()) {
    throw new Error("Supabase service environment variables are missing.");
  }

  const supabase = getSupabaseAdminClient();
  const payload = {
    auth_user_id: authUser.id,
    email: authUser.email ?? "",
    display_name: inferDisplayName(authUser)
  };

  const { data, error } = await supabase
    .from("users")
    .upsert(payload, { onConflict: "auth_user_id" })
    .select("id, auth_user_id, email, display_name")
    .single();

  if (error) {
    throw new Error(`Unable to resolve app user: ${error.message}`);
  }

  return mapRow(data as AppUserRow);
}
