import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/auth";
import { AccountStoreError, createAccount, listAccounts } from "@/lib/server/account-store";

export async function GET() {
  try {
    const { appUser } = await requireAppUser();
    return NextResponse.json({ accounts: await listAccounts(appUser.id) });
  } catch (error) {
    console.error("GET /api/accounts failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load accounts" },
      { status: error instanceof AccountStoreError ? error.status : 500 }
    );
  }
}

export async function POST(request: Request) {
  const { appUser } = await requireAppUser();

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
    !payload.name?.trim() ||
    !payload.email?.trim() ||
    !payload.imapHost?.trim() ||
    !payload.smtpHost?.trim()
  ) {
    return NextResponse.json(
      { error: "Account name, email, IMAP host, and SMTP host are required" },
      { status: 400 }
    );
  }

  try {
    const account = await createAccount(appUser.id, {
      name: payload.name,
      email: payload.email,
      imapHost: payload.imapHost,
      imapPort: Number(payload.imapPort) || 993,
      smtpHost: payload.smtpHost,
      smtpPort: Number(payload.smtpPort) || 587,
      password: payload.password
    });

    if (!account) {
      return NextResponse.json({ error: "Unable to create account" }, { status: 400 });
    }

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error("POST /api/accounts failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create account" },
      { status: error instanceof AccountStoreError ? error.status : 500 }
    );
  }
}
