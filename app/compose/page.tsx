"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MailAccount } from "@/lib/types/account";

type AccountsResponse = { accounts: MailAccount[] };

export default function ComposePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedAccountId = searchParams.get("accountId") ?? "";
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAccounts() {
      const res = await fetch("/api/accounts", { cache: "no-store" });
      if (!res.ok) return;

      const payload = (await res.json()) as AccountsResponse;
      setAccounts(payload.accounts);
      setAccountId((current) => current || requestedAccountId || payload.accounts[0]?.id || "");
    }

    void loadAccounts();
  }, [requestedAccountId]);

  async function submitCompose() {
    setSending(true);
    setError(null);

    const res = await fetch("/api/messages/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, to, subject, bodyText })
    });

    setSending(false);

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({ error: "Unable to send email." }))) as { error?: string };
      setError(payload.error ?? "Unable to send email.");
      return;
    }

    router.push(`/inbox?accountId=${encodeURIComponent(accountId)}`);
  }

  return (
    <main className="container stack-lg">
      <section className="topbar">
        <div>
          <p className="eyebrow">Compose</p>
          <h1>New email</h1>
          <p className="muted">Create a new message from one of your connected mailboxes.</p>
        </div>
        <div className="topbarActions">
          <Link className="buttonLink secondaryButton" href={accountId ? `/inbox?accountId=${encodeURIComponent(accountId)}` : "/inbox"}>
            Back to inbox
          </Link>
        </div>
      </section>

      <section className="panel stack-md">
        {error ? <p className="errorBanner">{error}</p> : null}
        <div className="stack-sm">
          <label className="fieldLabel" htmlFor="compose-account">
            From account
          </label>
          <select id="compose-account" onChange={(event) => setAccountId(event.target.value)} value={accountId}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.email})
              </option>
            ))}
          </select>
        </div>
        <div className="stack-sm">
          <label className="fieldLabel" htmlFor="compose-to">
            To
          </label>
          <input
            id="compose-to"
            onChange={(event) => setTo(event.target.value)}
            placeholder="name@example.com, other@example.com"
            type="email"
            value={to}
          />
        </div>
        <div className="stack-sm">
          <label className="fieldLabel" htmlFor="compose-subject">
            Subject
          </label>
          <input
            id="compose-subject"
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Subject"
            value={subject}
          />
        </div>
        <div className="stack-sm">
          <label className="fieldLabel" htmlFor="compose-body">
            Message
          </label>
          <textarea
            id="compose-body"
            onChange={(event) => setBodyText(event.target.value)}
            placeholder="Write your email."
            rows={14}
            value={bodyText}
          />
        </div>
        <div className="actions">
          <button disabled={sending || !accountId} onClick={() => void submitCompose()} type="button">
            {sending ? "Sending..." : "Send email"}
          </button>
        </div>
      </section>
    </main>
  );
}
