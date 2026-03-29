import { NextResponse } from "next/server";
import { syncAllAccounts } from "@/lib/server/message-store";
import { logAppEvent } from "@/lib/server/error-log";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = process.env.MAIL_SYNC_CRON_TOKEN;

  if (!token || authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await syncAllAccounts();
    await logAppEvent({
      scope: "messages.sync_all",
      level: "info",
      message: "Background mailbox sync completed."
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logAppEvent({
      scope: "messages.sync_all",
      level: "error",
      message: error instanceof Error ? error.message : "Background mailbox sync failed.",
      details: { error }
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Background mailbox sync failed." },
      { status: 500 }
    );
  }
}
