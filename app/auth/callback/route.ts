import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function sanitizeNextPath(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/inbox";
  }

  return next;
}

function redirectWithMessage(request: Request, params: { error?: string; message?: string; next?: string }) {
  const url = new URL("/", request.url);
  if (params.error) {
    url.searchParams.set("error", params.error);
  }
  if (params.message) {
    url.searchParams.set("message", params.message);
  }
  if (params.next) {
    url.searchParams.set("next", params.next);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = sanitizeNextPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    return redirectWithMessage(request, {
      error: errorDescription || error,
      next
    });
  }

  try {
    const supabase = await getSupabaseServerClient();

    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        return redirectWithMessage(request, {
          error: exchangeError.message,
          next
        });
      }

      return NextResponse.redirect(new URL(next, request.url));
    }

    if (tokenHash && type) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "signup" | "magiclink" | "recovery" | "invite" | "email_change" | "email"
      });

      if (verifyError) {
        return redirectWithMessage(request, {
          error: verifyError.message,
          next
        });
      }

      return NextResponse.redirect(new URL(next, request.url));
    }
  } catch (callbackError) {
    return redirectWithMessage(request, {
      error: callbackError instanceof Error ? callbackError.message : "Authentication callback failed.",
      next
    });
  }

  return redirectWithMessage(request, {
    error: "The confirmation link is invalid or expired. Request a new one.",
    next
  });
}
