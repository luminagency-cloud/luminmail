import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/auth";
import { replyToMessage } from "@/lib/server/message-store";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const { appUser } = await requireAppUser();

  const { id } = await context.params;
  const payload = (await request.json()) as { bodyText?: string };

  if (!payload.bodyText?.trim()) {
    return NextResponse.json({ error: "Reply body is required" }, { status: 400 });
  }

  const message = await replyToMessage(appUser.id, id, payload.bodyText);
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  return NextResponse.json({ message }, { status: 201 });
}
