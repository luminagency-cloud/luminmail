import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/auth";
import { deleteMessage, markMessageRead } from "@/lib/server/message-store";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(_: Request, context: Context) {
  const { appUser } = await requireAppUser();

  const { id } = await context.params;
  const message = await markMessageRead(appUser.id, id);
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  return NextResponse.json({ message });
}

export async function DELETE(_: Request, context: Context) {
  const { appUser } = await requireAppUser();

  const { id } = await context.params;
  const deleted = await deleteMessage(appUser.id, id);
  if (!deleted) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
