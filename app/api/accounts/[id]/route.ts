import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getAccount, updateAccount } from "@/lib/server/account-store";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const account = await getAccount(user.id, id);

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ account });
}

export async function PATCH(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    const account = await updateAccount(user.id, id, payload);
    if (!account) {
      return NextResponse.json({ error: "Account not found or is managed by env" }, { status: 404 });
    }

    return NextResponse.json({ account });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update account" },
      { status: 500 }
    );
  }
}
