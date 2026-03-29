import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/auth";
import { AccountStoreError, createAccount, listAccounts } from "@/lib/server/account-store";
import { logAppEvent } from "@/lib/server/error-log";
import { testMailConnection } from "@/lib/server/mail-connection";

export async function GET() {
  try {
    const { appUser } = await requireAppUser();
    return NextResponse.json({ accounts: await listAccounts(appUser.id) });
  } catch (error) {
    console.error("GET /api/accounts failed", error);
    await logAppEvent({
      scope: "accounts.list",
      message: error instanceof Error ? error.message : "Unable to load accounts",
      details: { error }
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load accounts" },
      { status: error instanceof AccountStoreError ? error.status : 500 }
    );
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    name?: string;
    email?: string;
    imapHost?: string;
    imapPort?: number;
    smtpHost?: string;
    smtpPort?: number;
    signature?: string;
    password?: string;
  };

  if (
    !payload.name?.trim() ||
    !payload.email?.trim() ||
    !payload.imapHost?.trim() ||
    !payload.smtpHost?.trim() ||
    !payload.password?.trim()
  ) {
    return NextResponse.json(
      { error: "Account name, email, password, IMAP host, and SMTP host are required" },
      { status: 400 }
    );
  }

  try {
    const { appUser } = await requireAppUser();
    const connectionResult = await testMailConnection({
      email: payload.email.trim(),
      password: payload.password,
      imapHost: payload.imapHost.trim(),
      imapPort: Number(payload.imapPort) || 993,
      smtpHost: payload.smtpHost.trim(),
      smtpPort: Number(payload.smtpPort) || 587
    });

    if (!connectionResult.imap.ok || !connectionResult.smtp.ok) {
      await logAppEvent({
        scope: "accounts.create.validation_failed",
        level: "warn",
        message: "Mailbox connection validation failed during account creation.",
        appUserId: appUser.id,
        details: {
          email: payload.email,
          imap: connectionResult.imap,
          smtp: connectionResult.smtp
        }
      });

      return NextResponse.json(
        {
          error: "Connection test failed. Fix the mailbox settings before saving.",
          result: connectionResult
        },
        { status: 400 }
      );
    }

    const account = await createAccount(appUser.id, {
      name: payload.name,
      email: payload.email,
        imapHost: payload.imapHost,
        imapPort: Number(payload.imapPort) || 993,
        smtpHost: payload.smtpHost,
        smtpPort: Number(payload.smtpPort) || 587,
        signature: payload.signature ?? "",
        password: payload.password
      });

    if (!account) {
      return NextResponse.json({ error: "Unable to create account" }, { status: 400 });
    }

    await logAppEvent({
      scope: "accounts.create",
      level: "info",
      message: "Mailbox account created.",
      appUserId: appUser.id,
      details: { email: payload.email, accountId: account.id }
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error("POST /api/accounts failed", error);
    await logAppEvent({
      scope: "accounts.create",
      message: error instanceof Error ? error.message : "Unable to create account",
      authUserId: null,
      appUserId: null,
      details: { payload, error }
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create account" },
      { status: error instanceof AccountStoreError ? error.status : 500 }
    );
  }
}
