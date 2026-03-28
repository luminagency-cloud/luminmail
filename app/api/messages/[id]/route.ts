import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { deleteMessage, markMessageRead } from "@/lib/server/mail-store";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(_: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const message = markMessageRead(id);
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  return NextResponse.json({ message });
}

export async function DELETE(_: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const deleted = deleteMessage(id);
  if (!deleted) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
