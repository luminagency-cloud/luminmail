"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getAppUrl } from "@/lib/server/app-url";
import { logAppEvent } from "@/lib/server/error-log";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function sanitizeNextPath(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/inbox";
  }

  return next;
}

function getAuthRedirectUrl(appUrl: string, next: string) {
  const url = new URL("/auth/callback", appUrl);
  url.searchParams.set("next", next || "/inbox");
  return url.toString();
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNextPath(String(formData.get("next") ?? "/inbox"));

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      redirect(`/?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
    }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    await logAppEvent({
      scope: "auth.sign_in.unhandled",
      message: error instanceof Error ? error.message : "Unhandled sign-in failure",
      level: "error",
      details: { email, error }
    });
    redirect(`/?error=${encodeURIComponent("Sign-in failed unexpectedly. Check runtime logs.")}&next=${encodeURIComponent(next)}`);
  }

  redirect(next || "/inbox");
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNextPath(String(formData.get("next") ?? "/inbox"));
  try {
    const appUrl = await getAppUrl();
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl(appUrl, next)
      }
    });

    if (error) {
      redirect(`/?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
    }

    if (data.session) {
      redirect(next || "/inbox");
    }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    await logAppEvent({
      scope: "auth.sign_up.unhandled",
      message: error instanceof Error ? error.message : "Unhandled sign-up failure",
      level: "error",
      details: { email, error }
    });
    redirect(`/?error=${encodeURIComponent("Sign-up failed unexpectedly. Check runtime logs.")}&next=${encodeURIComponent(next)}`);
  }

  redirect(
    `/?message=${encodeURIComponent("Check your inbox for a confirmation email from Supabase. The link will bring you back here and sign you in.")}&next=${encodeURIComponent(next)}`
  );
}

export async function resendConfirmationAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const next = sanitizeNextPath(String(formData.get("next") ?? "/inbox"));

  if (!email) {
    redirect(`/?error=${encodeURIComponent("Enter your email address to resend the confirmation link.")}&next=${encodeURIComponent(next)}`);
  }

  try {
    const appUrl = await getAppUrl();
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl(appUrl, next)
      }
    });

    if (error) {
      redirect(`/?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
    }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    await logAppEvent({
      scope: "auth.resend_confirmation.unhandled",
      message: error instanceof Error ? error.message : "Unhandled resend confirmation failure",
      level: "error",
      details: { email, error }
    });
    redirect(`/?error=${encodeURIComponent("Resend failed unexpectedly. Check runtime logs.")}&next=${encodeURIComponent(next)}`);
  }

  redirect(
    `/?message=${encodeURIComponent("Confirmation email re-sent. Use the newest email and open it promptly.")}&next=${encodeURIComponent(next)}`
  );
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect(`/?error=${encodeURIComponent("Enter your email address to reset your password.")}`);
  }

  try {
    const appUrl = await getAppUrl();
    const supabase = await getSupabaseServerClient();
    const url = new URL("/auth/callback", appUrl);
    url.searchParams.set("next", "/reset-password");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: url.toString()
    });

    if (error) {
      redirect(`/?error=${encodeURIComponent(error.message)}`);
    }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    await logAppEvent({
      scope: "auth.request_password_reset.unhandled",
      message: error instanceof Error ? error.message : "Unhandled password reset request failure",
      level: "error",
      details: { email, error }
    });
    redirect(`/?error=${encodeURIComponent("Password reset failed unexpectedly. Check runtime logs.")}`);
  }

  redirect(`/?message=${encodeURIComponent("Password reset email sent. Open the newest message and use that link.")}`);
}

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    redirect(`/reset-password?error=${encodeURIComponent("Use at least 8 characters for the new password.")}`);
  }

  if (password !== confirmPassword) {
    redirect(`/reset-password?error=${encodeURIComponent("The new password and confirmation do not match.")}`);
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
    }

    await supabase.auth.signOut();
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    await logAppEvent({
      scope: "auth.update_password.unhandled",
      message: error instanceof Error ? error.message : "Unhandled password update failure",
      level: "error",
      details: { error }
    });
    redirect(`/reset-password?error=${encodeURIComponent("Password update failed unexpectedly. Check runtime logs.")}`);
  }

  redirect(`/?message=${encodeURIComponent("Password updated. Sign in with your new password.")}`);
}

export async function signOutAction() {
  try {
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
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    await logAppEvent({
      scope: "auth.sign_out.unhandled",
      message: error instanceof Error ? error.message : "Unhandled sign-out failure",
      level: "error",
      details: { error }
    });
  }
  redirect("/");
}
