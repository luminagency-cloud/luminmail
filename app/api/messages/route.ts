import { NextResponse } from "next/server";
import { listMessages } from "@/lib/server/mail-store";

export async function GET() {
  return NextResponse.json({ messages: listMessages() });
}