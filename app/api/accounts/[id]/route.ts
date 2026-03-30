import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/auth";
import { AccountStoreError, deleteAccount, getAccount, updateAccount } from "@/lib/server/account-store";
import { logAppEvent } from "@/lib/server/error-log";
import { testMailConnection } from "@/lib/server/mail-connection";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const { appUser } = await requireAppUser();

  const { id } = await context.params;
  const account = await getAccount(appUser.id, id);

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ account });
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  const payload = (await request.json()) as {
    name?: string;
    email?: string;
    imapHost?: string;
    imapPort?: number;
    smtpHost?: string;
    smtpPort?: number;
    signature?: string;
    syncIntervalMinutes?: number;
    password?: string;
  };

  if (
    !payload.name?.trim() &&
    !payload.email?.trim() &&
    !payload.imapHost?.trim() &&
    payload.imapPort === undefined &&
    !payload.smtpHost?.trim() &&
    payload.smtpPort === undefined &&
    payload.signature === undefined &&
    payload.syncIntervalMinutes === undefined &&
    payload.password === undefined
  ) {
    return NextResponse.json(
      { error: "Provide at least one account field to update" },
      { status: 400 }
    );
  }

  try {
    const { appUser } = await requireAppUser();
    const existing = await getAccount(appUser.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Account not found or is managed by env" }, { status: 404 });
    }

    const connectionChanged =
      (payload.email?.trim() && payload.email.trim() !== existing.email) ||
      (payload.imapHost?.trim() && payload.imapHost.trim() !== existing.imapHost) ||
      (payload.imapPort !== undefined && Number(payload.imapPort) !== existing.imapPort) ||
      (payload.smtpHost?.trim() && payload.smtpHost.trim() !== existing.smtpHost) ||
      (payload.smtpPort !== undefined && Number(payload.smtpPort) !== existing.smtpPort);

    if (connectionChanged && payload.password?.trim()) {
      const connectionResult = await testMailConnection({
        email: payload.email?.trim() || existing.email,
        password: payload.password,
        imapHost: payload.imapHost?.trim() || existing.imapHost,
        imapPort: Number(payload.imapPort) || existing.imapPort,
        smtpHost: payload.smtpHost?.trim() || existing.smtpHost,
        smtpPort: Number(payload.smtpPort) || existing.smtpPort
      });

      if (!connectionResult.imap.ok || !connectionResult.smtp.ok) {
        await logAppEvent({
          scope: "accounts.update.validation_failed",
          level: "warn",
          message: "Mailbox connection validation failed during account update.",
          appUserId: appUser.id,
          details: {
            accountId: id,
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
    }

    const account = await updateAccount(appUser.id, id, payload);
    if (!account) {
      return NextResponse.json({ error: "Account not found or is managed by env" }, { status: 404 });
    }

    return NextResponse.json({ account });
  } catch (error) {
    console.error(`PATCH /api/accounts/${id} failed`, error);
    await logAppEvent({
      scope: "accounts.update",
      message: error instanceof Error ? error.message : "Unable to update account",
      authUserId: null,
      appUserId: null,
      details: { accountId: id, payload, error }
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update account" },
      { status: error instanceof AccountStoreError ? error.status : 500 }
    );
  }
}

export async function DELETE(_: Request, context: Context) {
  const { id } = await context.params;

  try {
    const { appUser } = await requireAppUser();
    const deleted = await deleteAccount(appUser.id, id);

    if (!deleted) {
      return NextResponse.json({ error: "Account not found or is managed by env" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`DELETE /api/accounts/${id} failed`, error);
    await logAppEvent({
      scope: "accounts.delete",
      message: error instanceof Error ? error.message : "Unable to delete account",
      details: { accountId: id, error }
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete account" },
      { status: error instanceof AccountStoreError ? error.status : 500 }
    );
  }
}
