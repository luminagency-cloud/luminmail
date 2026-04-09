"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  requestPasswordReset,
  resetPasswordWithToken,
  sanitizeNextPath,
  signInWithPassword,
  signOutCurrentSession,
  registerUser
} from "@/lib/server/auth";
import { logAppEvent } from "@/lib/server/error-log";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNextPath(String(formData.get("next") ?? "/inbox"));

  try {
    await signInWithPassword(email, password);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof Error) {
      redirect(`/?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
    }

    await logAppEvent({
      scope: "auth.sign_in.unhandled",
      message: "Unhandled sign-in failure",
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
    await registerUser({ email, password });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof Error) {
      redirect(`/?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
    }

    await logAppEvent({
      scope: "auth.sign_up.unhandled",
      message: "Unhandled sign-up failure",
      level: "error",
      details: { email, error }
    });
    redirect(`/?error=${encodeURIComponent("Sign-up failed unexpectedly. Check runtime logs.")}&next=${encodeURIComponent(next)}`);
  }

  redirect(next || "/inbox");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect(`/?error=${encodeURIComponent("Enter your email address to reset your password.")}`);
  }

  try {
    const result = await requestPasswordReset(email);
    const message =
      result.delivery === "email"
        ? "Password reset email sent. Open the newest message and use that link."
        : "Password reset requested. If SMTP is not configured, the reset URL was logged on the server.";
    redirect(`/?message=${encodeURIComponent(message)}`);
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
}

export async function updatePasswordAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent("Use at least 8 characters for the new password.")}`);
  }

  if (password !== confirmPassword) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent("The new password and confirmation do not match.")}`);
  }

  try {
    await resetPasswordWithToken(token, password);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    await logAppEvent({
      scope: "auth.update_password.unhandled",
      message: error instanceof Error ? error.message : "Unhandled password update failure",
      level: "error",
      details: { tokenPresent: Boolean(token), error }
    });
    redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(
        error instanceof Error ? error.message : "Password update failed unexpectedly. Check runtime logs."
      )}`
    );
  }

  redirect(`/?message=${encodeURIComponent("Password updated. Sign in with your new password.")}`);
}

export async function signOutAction() {
  try {
    await signOutCurrentSession();
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
