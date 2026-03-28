import { NextResponse } from "next/server";
import { replyToMessage } from "@/lib/server/mail-store";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const payload = (await request.json()) as { bodyText?: string };

  if (!payload.bodyText?.trim()) {
    return NextResponse.json({ error: "Reply body is required" }, { status: 400 });
  }

  const message = replyToMessage(id, payload.bodyText);
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  return NextResponse.json({ message }, { status: 201 });
}