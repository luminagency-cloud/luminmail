import { NextResponse } from "next/server";
import { syncAllAccounts } from "@/lib/server/message-store";
import { logAppEvent } from "@/lib/server/error-log";

function getCronToken() {
  return process.env.CRON_SECRET ?? process.env.MAIL_SYNC_CRON_TOKEN;
}

async function handleSync(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = getCronToken();

  if (!token || authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncAllAccounts();
    await logAppEvent({
      scope: "messages.sync_all",
      level: "info",
      message: "Background mailbox sync completed.",
      details: summary
    });
    return NextResponse.json({ ok: true, ...summary });
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

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}
