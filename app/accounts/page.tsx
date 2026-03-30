"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { MailAccount } from "@/lib/types/account";
import type { AccountTestResult } from "@/lib/types/account-test";

type AccountsResponse = { accounts: MailAccount[] };

type AccountDraft = {
  name: string;
  email: string;
  imapHost: string;
  imapPort: string;
  smtpHost: string;
  smtpPort: string;
  signature: string;
  syncIntervalMinutes: string;
  password: string;
};

const emptyDraft: AccountDraft = {
  name: "",
  email: "",
  imapHost: "",
  imapPort: "993",
  smtpHost: "",
  smtpPort: "587",
  signature: "",
  syncIntervalMinutes: "15",
  password: ""
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [draft, setDraft] = useState<AccountDraft>(emptyDraft);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [createTestResult, setCreateTestResult] = useState<AccountTestResult | null>(null);
  const [accountTestResults, setAccountTestResults] = useState<Record<string, AccountTestResult | undefined>>({});

  async function loadAccounts() {
    const res = await fetch("/api/accounts");
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({ error: "Unable to load accounts" }))) as { error?: string };
      setPageError(payload.error ?? "Unable to load accounts.");
      return;
    }

    const payload = (await res.json()) as AccountsResponse;
    setAccounts(payload.accounts);
    setPageError(null);
  }

  useEffect(() => {
    void loadAccounts();
  }, []);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPageError(null);
    setPageMessage(null);
    setCreateTestResult(null);
    setCreating(true);

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
        signature: draft.signature,
        syncIntervalMinutes: Number(draft.syncIntervalMinutes) || 15,
        password: draft.password
      })
    });
    setCreating(false);

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({ error: "Unable to create account" }))) as {
        error?: string;
        result?: AccountTestResult;
      };
      if (payload.result) {
        setCreateTestResult(payload.result);
      }
      setPageError(payload.error ?? "Unable to create account.");
      return;
    }

    setDraft(emptyDraft);
    setCreateTestResult(null);
    setPageMessage("Account saved.");
    await loadAccounts();
  }

  async function saveAccount(account: AccountDraft & { id: string }) {
    setPageError(null);
    setPageMessage(null);
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
        signature: account.signature,
        syncIntervalMinutes: Number(account.syncIntervalMinutes) || 15,
        password: account.password
      })
    });
    setSavingId(null);
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({ error: "Unable to update account" }))) as {
        error?: string;
        result?: AccountTestResult;
      };
      if (payload.result) {
        setAccountTestResults((current) => ({ ...current, [account.id]: payload.result }));
      }
      setPageError(payload.error ?? "Unable to update account.");
      return;
    }
    setAccountTestResults((current) => ({ ...current, [account.id]: undefined }));
    setPageMessage("Account updated.");
    await loadAccounts();
  }

  async function deleteExistingAccount(id: string) {
    setPageError(null);
    setPageMessage(null);

    const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({ error: "Unable to delete account" }))) as { error?: string };
      setPageError(payload.error ?? "Unable to delete account.");
      return;
    }

    setPageMessage("Account deleted.");
    await loadAccounts();
  }

  return (
    <main className="container stack-lg">
      <section className="topbar">
        <div>
          <p className="eyebrow">Account settings</p>
          <h1>Mail accounts</h1>
          <p className="muted">Create, validate, edit, or delete connected mailboxes.</p>
        </div>
        <div className="topbarActions">
          <Link className="buttonLink secondaryButton" href="/inbox">
            Back to inbox
          </Link>
        </div>
      </section>

      <section className="panel">
        <h2>Add account</h2>
        {pageError ? <p className="errorBanner">{pageError}</p> : null}
        {pageMessage ? <p className="successBanner">{pageMessage}</p> : null}
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
            <label className="fieldLabel" htmlFor="new-account-signature">
              Signature
            </label>
            <textarea
              id="new-account-signature"
              onChange={(event) => setDraft((current) => ({ ...current, signature: event.target.value }))}
              placeholder="Optional signature for outgoing replies"
              rows={4}
              value={draft.signature}
            />
          </div>
          <div className="stack-sm">
            <label className="fieldLabel" htmlFor="new-account-sync-interval">
              Check frequency
            </label>
            <select
              id="new-account-sync-interval"
              onChange={(event) => setDraft((current) => ({ ...current, syncIntervalMinutes: event.target.value }))}
              value={draft.syncIntervalMinutes}
            >
              <option value="5">Every 5 minutes</option>
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every hour</option>
            </select>
            <p className="muted">Polling only runs while this inbox is open in the app.</p>
          </div>
          <div className="stack-sm formGridFull">
            <label className="fieldLabel" htmlFor="new-account-password">
              Password
            </label>
            <input
              id="new-account-password"
              onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))}
              placeholder="Password used for connection testing"
              type="password"
              value={draft.password}
            />
          </div>
          <div className="actions">
            <button type="submit">{creating ? "Validating..." : "Create account"}</button>
          </div>
        </form>
        {createTestResult ? <ConnectionResult result={createTestResult} /> : null}
      </section>

      <section className="panel stack-md">
        <h2>Existing accounts</h2>
        {accounts.map((account, index) => (
          <AccountEditor
            account={account}
            key={account.id}
            onDelete={deleteExistingAccount}
            onSave={saveAccount}
            result={accountTestResults[account.id] ?? null}
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
  onDelete,
  onSave,
  result,
  saving,
  title
}: {
  account: MailAccount;
  onDelete: (id: string) => Promise<void>;
  onSave: (account: AccountDraft & { id: string }) => Promise<void>;
  result: AccountTestResult | null;
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
    signature: account.signature,
    syncIntervalMinutes: String(account.syncIntervalMinutes),
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
      signature: account.signature,
      syncIntervalMinutes: String(account.syncIntervalMinutes),
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
          <label className="fieldLabel" htmlFor={`${account.id}-signature`}>
            Signature
          </label>
          <textarea
            disabled={account.source === "env"}
            id={`${account.id}-signature`}
            onChange={(event) => setDraft((current) => ({ ...current, signature: event.target.value }))}
            placeholder="Optional signature for outgoing replies"
            rows={4}
            value={draft.signature}
          />
        </div>
        <div className="stack-sm">
          <label className="fieldLabel" htmlFor={`${account.id}-sync-interval`}>
            Check frequency
          </label>
          <select
            disabled={account.source === "env"}
            id={`${account.id}-sync-interval`}
            onChange={(event) => setDraft((current) => ({ ...current, syncIntervalMinutes: event.target.value }))}
            value={draft.syncIntervalMinutes}
          >
            <option value="5">Every 5 minutes</option>
            <option value="15">Every 15 minutes</option>
            <option value="30">Every 30 minutes</option>
            <option value="60">Every hour</option>
          </select>
          <p className="muted">Only checked while the inbox page is open for this account.</p>
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
      <div className="actions">
        <button disabled={account.source === "env"} onClick={() => void onSave({ ...draft, id: account.id })} type="button">
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button className="dangerButton" disabled={account.source === "env"} onClick={() => void onDelete(account.id)} type="button">
          Delete account
        </button>
      </div>
      {result ? <ConnectionResult result={result} /> : null}
    </div>
  );
}

function ConnectionResult({ result }: { result: AccountTestResult }) {
  return (
    <div className="connectionResult stack-sm">
      <p className="eyebrow">Connection test</p>
      <p className={result.imap.ok ? "successText" : "errorText"}>IMAP: {result.imap.message}</p>
      <p className={result.smtp.ok ? "successText" : "errorText"}>SMTP: {result.smtp.message}</p>
    </div>
  );
}
