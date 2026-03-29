import type { User } from "@supabase/supabase-js";
import type { AppUser } from "@/lib/types/app-user";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { hasSupabaseServiceEnv } from "@/lib/supabase/env";
import { dbQuery, hasDatabaseUrl } from "@/lib/db/server";

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
  if (hasDatabaseUrl()) {
    const result = await dbQuery<AppUserRow>(
      `
        insert into public.users (auth_user_id, email, display_name)
        values ($1::uuid, $2::text, $3::text)
        on conflict (auth_user_id) do update
          set email = excluded.email,
              display_name = coalesce(excluded.display_name, public.users.display_name),
              updated_at = timezone('utc', now())
        returning id, auth_user_id, email, display_name
      `,
      [authUser.id, authUser.email ?? "", inferDisplayName(authUser)]
    );

    return mapRow(result.rows[0]);
  }

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
