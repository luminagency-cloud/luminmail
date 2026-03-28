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

function writeRuntimeLog(input: ErrorLogInput, serializedDetails: Record<string, unknown> | null) {
  const payload = {
    scope: input.scope,
    level: input.level ?? "error",
    message: input.message,
    authUserId: input.authUserId ?? null,
    appUserId: input.appUserId ?? null,
    details: serializedDetails
  };

  const line = `[app:${payload.level}] ${payload.scope}: ${payload.message}`;
  if (payload.level === "info") {
    console.info(line, payload);
    return;
  }

  if (payload.level === "warn") {
    console.warn(line, payload);
    return;
  }

  console.error(line, payload);
}

export async function logAppEvent(input: ErrorLogInput) {
  const serializedDetails = serializeDetails(input.details);
  writeRuntimeLog(input, serializedDetails);

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
      details: serializedDetails
    });
  } catch (error) {
    console.error("[app:error] logging.persist_failed", {
      scope: input.scope,
      message: input.message,
      persistError: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    });
  }
}
