import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/auth";
import { logAppEvent } from "@/lib/server/error-log";
import { testMailConnection } from "@/lib/server/mail-connection";

export async function POST(request: Request) {
  try {
    const { appUser } = await requireAppUser();
    const payload = (await request.json()) as {
      email?: string;
      password?: string;
      imapHost?: string;
      imapPort?: number;
      smtpHost?: string;
      smtpPort?: number;
    };

    if (
      !payload.email?.trim() ||
      !payload.password?.trim() ||
      !payload.imapHost?.trim() ||
      !payload.smtpHost?.trim()
    ) {
      return NextResponse.json(
        { error: "Email, password, IMAP host, and SMTP host are required for testing." },
        { status: 400 }
      );
    }

    const result = await testMailConnection({
      email: payload.email.trim(),
      password: payload.password,
      imapHost: payload.imapHost.trim(),
      imapPort: Number(payload.imapPort) || 993,
      smtpHost: payload.smtpHost.trim(),
      smtpPort: Number(payload.smtpPort) || 587
    });

    await logAppEvent({
      scope: "accounts.test_connection",
      level: result.imap.ok && result.smtp.ok ? "info" : "warn",
      message: result.imap.ok && result.smtp.ok ? "Mailbox connection test passed." : "Mailbox connection test failed.",
      authUserId: appUser.authUserId,
      appUserId: appUser.id,
      details: result
    });

    return NextResponse.json({ result });
  } catch (error) {
    await logAppEvent({
      scope: "accounts.test_connection",
      level: "error",
      message: error instanceof Error ? error.message : "Connection test failed unexpectedly.",
      details: { error }
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection test failed unexpectedly." },
      { status: 500 }
    );
  }
}
