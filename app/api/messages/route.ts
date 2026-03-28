import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { listMessages } from "@/lib/server/mail-store";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  return NextResponse.json({ messages: listMessages(accountId) });
}
