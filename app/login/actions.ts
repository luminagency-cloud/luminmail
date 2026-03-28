"use server";

import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/server/app-url";
import { logAppEvent } from "@/lib/server/error-log";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/inbox");

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await logAppEvent({
      scope: "auth.sign_in",
      message: error.message,
      level: "warn",
      details: { email, code: error.code, status: error.status }
    });
    redirect(`/?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  }

  redirect(next || "/inbox");
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/inbox");
  const appUrl = await getAppUrl();

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl}/login`
    }
  });

  if (error) {
    await logAppEvent({
      scope: "auth.sign_up",
      message: error.message,
      level: "warn",
      details: { email, code: error.code, status: error.status }
    });
    redirect(`/?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  }

  if (data.session) {
    redirect(next || "/inbox");
  }

  redirect(
    `/?message=${encodeURIComponent("Check your inbox for a confirmation email from Supabase, then sign in.")}&next=${encodeURIComponent(next)}`
  );
}

export async function signOutAction() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { error } = await supabase.auth.signOut();
  if (error) {
    await logAppEvent({
      scope: "auth.sign_out",
      message: error.message,
      level: "warn",
      authUserId: user?.id ?? null
    });
  }
  redirect("/");
}
