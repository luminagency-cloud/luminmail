"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MailAccount } from "@/lib/types/account";
import type { MailMessage } from "@/lib/types/mail";

type MessagesResponse = { messages: MailMessage[] };
type AccountsResponse = { accounts: MailAccount[] };

export default function InboxPage() {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState("");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [reply, setReply] = useState("");

  useEffect(() => {
    async function loadAccounts() {
      const res = await fetch("/api/accounts");
      if (!res.ok) return;

      const payload = (await res.json()) as AccountsResponse;
      setAccounts(payload.accounts);
      setActiveAccountId((current) => current || payload.accounts[0]?.id || "");
    }

    void loadAccounts();
  }, []);

  useEffect(() => {
    async function loadMessages() {
      if (!activeAccountId) {
        setMessages([]);
        setSelectedId("");
        return;
      }

      const res = await fetch(`/api/messages?accountId=${encodeURIComponent(activeAccountId)}`);
      if (!res.ok) return;

      const payload = (await res.json()) as MessagesResponse;
      setMessages(payload.messages);
      setSelectedId((current) => {
        if (current && payload.messages.some((message) => message.id === current)) return current;
        return payload.messages[0]?.id ?? "";
      });
    }

    void loadMessages();
  }, [activeAccountId]);

  const selected = messages.find((message) => message.id === selectedId);
  const activeAccount = accounts.find((account) => account.id === activeAccountId);

  async function markRead() {
    if (!selected) return;
    const res = await fetch(`/api/messages/${selected.id}`, { method: "PATCH" });
    if (!res.ok) return;
    const payload = (await res.json()) as { message: MailMessage };
    setMessages((current) => current.map((m) => (m.id === payload.message.id ? payload.message : m)));
  }

  async function deleteSelected() {
    if (!selected) return;
    const res = await fetch(`/api/messages/${selected.id}`, { method: "DELETE" });
    if (!res.ok) return;

    setMessages((current) => {
      const next = current.filter((m) => m.id !== selected.id);
      setSelectedId(next[0]?.id ?? "");
      return next;
    });
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    const res = await fetch(`/api/messages/${selected.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bodyText: reply })
    });
    if (!res.ok) return;

    const payload = (await res.json()) as { message: MailMessage };
    setMessages((current) => [payload.message, ...current]);
    setSelectedId(payload.message.id);
    setReply("");
  }

  return (
    <main className="container stack-lg">
      <section className="topbar">
        <div>
          <p className="eyebrow">Current account</p>
          <h1>{activeAccount ? activeAccount.name : "Inbox"}</h1>
          <p className="muted">{activeAccount?.email ?? "Select an account to view its mailbox."}</p>
        </div>

        <div className="topbarActions">
          <label className="fieldLabel" htmlFor="account-switcher">
            Switch account
          </label>
          <select
            id="account-switcher"
            onChange={(event) => setActiveAccountId(event.target.value)}
            value={activeAccountId}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.email})
              </option>
            ))}
          </select>
          <Link className="buttonLink secondaryButton" href="/accounts">
            Manage accounts
          </Link>
        </div>
      </section>

      <section className="grid">
        <div className="panel">
          <h2>Messages</h2>
          {messages.length === 0 ? <p className="muted">No messages in this account yet.</p> : null}
          {messages.map((message) => (
            <button className="messageCard" key={message.id} onClick={() => setSelectedId(message.id)} type="button">
              <span className="messageCardHeader">
                <strong>{message.subject}</strong>
                {message.unread ? <span className="statusDot" aria-label="Unread" /> : null}
              </span>
              <span>{message.from}</span>
              <span className="muted">{message.preview}</span>
            </button>
          ))}
        </div>

        <div className="panel">
          {selected ? (
            <>
              <h2>{selected.subject}</h2>
              <p className="muted">
                {selected.from} to {selected.to}
              </p>
              <p>{selected.bodyText}</p>
              <div className="actions">
                <button onClick={markRead} type="button">
                  Mark Read
                </button>
                <button className="secondaryButton" onClick={deleteSelected} type="button">
                  Delete
                </button>
              </div>
              <div className="stack-sm">
                <label className="fieldLabel" htmlFor="reply-box">
                  Reply
                </label>
                <textarea id="reply-box" onChange={(e) => setReply(e.target.value)} rows={5} value={reply} />
                <div>
                  <button onClick={sendReply} type="button">
                    Send Reply
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="muted">Choose a message to read it here.</p>
          )}
        </div>
      </section>
    </main>
  );
}
