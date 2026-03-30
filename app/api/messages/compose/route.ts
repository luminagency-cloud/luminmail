import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/auth";
import { composeMessage } from "@/lib/server/message-store";

export async function POST(request: Request) {
  const { appUser } = await requireAppUser();
  const payload = (await request.json()) as {
    accountId?: string;
    to?: string;
    subject?: string;
    bodyText?: string;
  };

  if (!payload.accountId?.trim()) {
    return NextResponse.json({ error: "Account is required" }, { status: 400 });
  }

  if (!payload.to?.trim()) {
    return NextResponse.json({ error: "Recipient is required" }, { status: 400 });
  }

  if (!payload.bodyText?.trim()) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  const message = await composeMessage({
    userId: appUser.id,
    accountId: payload.accountId,
    to: payload.to,
    subject: payload.subject ?? "",
    bodyText: payload.bodyText
  });

  if (!message) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ message }, { status: 201 });
}
