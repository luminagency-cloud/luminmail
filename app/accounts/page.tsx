"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { MailAccount } from "@/lib/types/account";

type AccountsResponse = { accounts: MailAccount[] };

type AccountDraft = {
  name: string;
  email: string;
  imapHost: string;
  imapPort: string;
  smtpHost: string;
  smtpPort: string;
  password: string;
};

const emptyDraft: AccountDraft = {
  name: "",
  email: "",
  imapHost: "",
  imapPort: "993",
  smtpHost: "",
  smtpPort: "587",
  password: ""
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [draft, setDraft] = useState<AccountDraft>(emptyDraft);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadAccounts() {
    const res = await fetch("/api/accounts");
    if (!res.ok) return;

    const payload = (await res.json()) as AccountsResponse;
    setAccounts(payload.accounts);
  }

  useEffect(() => {
    void loadAccounts();
  }, []);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        email: draft.email,
        imapHost: draft.imapHost,
        imapPort: Number(draft.imapPort),
        smtpHost: draft.smtpHost,
        smtpPort: Number(draft.smtpPort),
        password: draft.password
      })
    });

    if (!res.ok) return;

    setDraft(emptyDraft);
    await loadAccounts();
  }

  async function saveAccount(account: AccountDraft & { id: string }) {
    setSavingId(account.id);
    const res = await fetch(`/api/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: account.name,
        email: account.email,
        imapHost: account.imapHost,
        imapPort: Number(account.imapPort),
        smtpHost: account.smtpHost,
        smtpPort: Number(account.smtpPort),
        password: account.password
      })
    });
    setSavingId(null);
    if (!res.ok) return;
    await loadAccounts();
  }

  return (
    <main className="container stack-lg">
      <section className="topbar">
        <div>
          <p className="eyebrow">Account settings</p>
          <h1>Mail accounts</h1>
          <p className="muted">Every account has a display name and an email address, both editable.</p>
        </div>
        <div className="topbarActions">
          <Link className="buttonLink secondaryButton" href="/inbox">
            Back to inbox
          </Link>
        </div>
      </section>

      <section className="panel">
        <h2>Add account</h2>
        <form className="formGrid" onSubmit={createAccount}>
          <div className="stack-sm">
            <label className="fieldLabel" htmlFor="new-account-name">
              Account name
            </label>
            <input
              id="new-account-name"
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Work"
              value={draft.name}
            />
          </div>
          <div className="stack-sm">
            <label className="fieldLabel" htmlFor="new-account-email">
              Email address
            </label>
            <input
              id="new-account-email"
              onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
              placeholder="myname@myworkplace.com"
              type="email"
              value={draft.email}
            />
          </div>
          <div className="stack-sm">
            <label className="fieldLabel" htmlFor="new-account-imap-host">
              IMAP host
            </label>
            <input
              id="new-account-imap-host"
              onChange={(event) => setDraft((current) => ({ ...current, imapHost: event.target.value }))}
              placeholder="imap.example.com"
              value={draft.imapHost}
            />
          </div>
          <div className="stack-sm">
            <label className="fieldLabel" htmlFor="new-account-imap-port">
              IMAP port
            </label>
            <input
              id="new-account-imap-port"
              onChange={(event) => setDraft((current) => ({ ...current, imapPort: event.target.value }))}
              inputMode="numeric"
              value={draft.imapPort}
            />
          </div>
          <div className="stack-sm">
            <label className="fieldLabel" htmlFor="new-account-smtp-host">
              SMTP host
            </label>
            <input
              id="new-account-smtp-host"
              onChange={(event) => setDraft((current) => ({ ...current, smtpHost: event.target.value }))}
              placeholder="smtp.example.com"
              value={draft.smtpHost}
            />
          </div>
          <div className="stack-sm">
            <label className="fieldLabel" htmlFor="new-account-smtp-port">
              SMTP port
            </label>
            <input
              id="new-account-smtp-port"
              onChange={(event) => setDraft((current) => ({ ...current, smtpPort: event.target.value }))}
              inputMode="numeric"
              value={draft.smtpPort}
            />
          </div>
          <div className="stack-sm formGridFull">
            <label className="fieldLabel" htmlFor="new-account-password">
              Password
            </label>
            <input
              id="new-account-password"
              onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))}
              placeholder="Stored locally for now"
              type="password"
              value={draft.password}
            />
          </div>
          <div>
            <button type="submit">Create account</button>
          </div>
        </form>
      </section>

      <section className="panel stack-md">
        <h2>Existing accounts</h2>
        {accounts.map((account, index) => (
          <AccountEditor
            account={account}
            key={account.id}
            onSave={saveAccount}
            saving={savingId === account.id}
            title={`Account ${index + 1}`}
          />
        ))}
      </section>
    </main>
  );
}

function AccountEditor({
  account,
  onSave,
  saving,
  title
}: {
  account: MailAccount;
  onSave: (account: AccountDraft & { id: string }) => Promise<void>;
  saving: boolean;
  title: string;
}) {
  const [draft, setDraft] = useState<AccountDraft>({
    name: account.name,
    email: account.email,
    imapHost: account.imapHost,
    imapPort: String(account.imapPort),
    smtpHost: account.smtpHost,
    smtpPort: String(account.smtpPort),
    password: ""
  });

  useEffect(() => {
    setDraft({
      name: account.name,
      email: account.email,
      imapHost: account.imapHost,
      imapPort: String(account.imapPort),
      smtpHost: account.smtpHost,
      smtpPort: String(account.smtpPort),
      password: ""
    });
  }, [account]);

  return (
    <div className="accountEditor">
      <p className="eyebrow">{title}</p>
      {account.source === "env" ? (
        <p className="muted">This account is loaded from `.env.local` for development and is read-only in the UI.</p>
      ) : null}
      <div className="formGrid">
        <div className="stack-sm">
          <label className="fieldLabel" htmlFor={`${account.id}-name`}>
            Account name
          </label>
          <input
            disabled={account.source === "env"}
            id={`${account.id}-name`}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            value={draft.name}
          />
        </div>
        <div className="stack-sm">
          <label className="fieldLabel" htmlFor={`${account.id}-email`}>
            Email address
          </label>
          <input
            disabled={account.source === "env"}
            id={`${account.id}-email`}
            onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
            type="email"
            value={draft.email}
          />
        </div>
        <div className="stack-sm">
          <label className="fieldLabel" htmlFor={`${account.id}-imap-host`}>
            IMAP host
          </label>
          <input
            disabled={account.source === "env"}
            id={`${account.id}-imap-host`}
            onChange={(event) => setDraft((current) => ({ ...current, imapHost: event.target.value }))}
            value={draft.imapHost}
          />
        </div>
        <div className="stack-sm">
          <label className="fieldLabel" htmlFor={`${account.id}-imap-port`}>
            IMAP port
          </label>
          <input
            disabled={account.source === "env"}
            id={`${account.id}-imap-port`}
            inputMode="numeric"
            onChange={(event) => setDraft((current) => ({ ...current, imapPort: event.target.value }))}
            value={draft.imapPort}
          />
        </div>
        <div className="stack-sm">
          <label className="fieldLabel" htmlFor={`${account.id}-smtp-host`}>
            SMTP host
          </label>
          <input
            disabled={account.source === "env"}
            id={`${account.id}-smtp-host`}
            onChange={(event) => setDraft((current) => ({ ...current, smtpHost: event.target.value }))}
            value={draft.smtpHost}
          />
        </div>
        <div className="stack-sm">
          <label className="fieldLabel" htmlFor={`${account.id}-smtp-port`}>
            SMTP port
          </label>
          <input
            disabled={account.source === "env"}
            id={`${account.id}-smtp-port`}
            inputMode="numeric"
            onChange={(event) => setDraft((current) => ({ ...current, smtpPort: event.target.value }))}
            value={draft.smtpPort}
          />
        </div>
        <div className="stack-sm formGridFull">
          <label className="fieldLabel" htmlFor={`${account.id}-password`}>
            Password
          </label>
          <input
            disabled={account.source === "env"}
            id={`${account.id}-password`}
            onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))}
            placeholder={account.passwordStored ? "Password already stored" : "Enter password to store"}
            type="password"
            value={draft.password}
          />
        </div>
      </div>
      <div>
        <button disabled={account.source === "env"} onClick={() => void onSave({ ...draft, id: account.id })} type="button">
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}
