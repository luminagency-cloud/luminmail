import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { hasSupabaseServiceEnv } from "@/lib/supabase/env";

type LogLevel = "info" | "warn" | "error";

type ErrorLogInput = {
  scope: string;
  message: string;
  level?: LogLevel;
  authUserId?: string | null;
  appUserId?: string | null;
  details?: Record<string, unknown>;
};

function serializeDetails(details?: Record<string, unknown>) {
  if (!details) return null;

  return JSON.parse(
    JSON.stringify(details, (_, value) => {
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack
        };
      }

      return value;
    })
  );
}

export async function logAppEvent(input: ErrorLogInput) {
  if (!hasSupabaseServiceEnv()) {
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from("app_error_logs").insert({
      scope: input.scope,
      level: input.level ?? "error",
      message: input.message,
      auth_user_id: input.authUserId ?? null,
      app_user_id: input.appUserId ?? null,
      details: serializeDetails(input.details)
    });
  } catch (error) {
    console.error("Unable to persist app log", error);
  }
}
