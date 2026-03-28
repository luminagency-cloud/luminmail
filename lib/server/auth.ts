import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { ensureAppUser } from "@/lib/server/app-user-store";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/types/app-user";

export async function getCurrentAuthUser(): Promise<User | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}

export async function getCurrentUser() {
  return getCurrentAuthUser();
}

export async function requireUser() {
  const user = await getCurrentAuthUser();
  if (!user) {
    redirect("/");
  }

  return user;
}

export async function requireAppUser(): Promise<{ authUser: User; appUser: AppUser }> {
  const authUser = await getCurrentAuthUser();
  if (!authUser) {
    redirect("/");
  }

  const appUser = await ensureAppUser(authUser);
  return { authUser, appUser };
}
