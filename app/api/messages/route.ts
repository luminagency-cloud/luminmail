import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { requireAppUser } from "@/lib/server/auth";
import { listMessages } from "@/lib/server/message-store";
import { logAppEvent } from "@/lib/server/error-log";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appUser } = await requireAppUser();
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") ?? undefined;
    return NextResponse.json({ messages: await listMessages(appUser.id, accountId) });
  } catch (error) {
    await logAppEvent({
      scope: "messages.list",
      message: error instanceof Error ? error.message : "Unable to load messages",
      details: { error }
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load messages" },
      { status: 500 }
    );
  }
}
