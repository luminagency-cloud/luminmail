import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/auth";
import { AccountStoreError, getAccount, updateAccount } from "@/lib/server/account-store";
import { logAppEvent } from "@/lib/server/error-log";

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
    password?: string;
  };

  if (
    !payload.name?.trim() &&
    !payload.email?.trim() &&
    !payload.imapHost?.trim() &&
    payload.imapPort === undefined &&
    !payload.smtpHost?.trim() &&
    payload.smtpPort === undefined &&
    payload.password === undefined
  ) {
    return NextResponse.json(
      { error: "Provide at least one account field to update" },
      { status: 400 }
    );
  }

  try {
    const { appUser } = await requireAppUser();
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
