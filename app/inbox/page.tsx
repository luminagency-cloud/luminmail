"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MailAccount } from "@/lib/types/account";
import type { MailMessage } from "@/lib/types/mail";

type MessagesResponse = { messages: MailMessage[] };
type AccountsResponse = { accounts: MailAccount[] };
type IssueReportResponse = {
  ok: boolean;
  reportId: string;
};

export default function InboxPage() {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState("");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [reply, setReply] = useState("");
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueDescription, setIssueDescription] = useState("");
  const [issueScreenshot, setIssueScreenshot] = useState<File | null>(null);
  const [issueFileKey, setIssueFileKey] = useState(0);
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueMessage, setIssueMessage] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const readingPaneRef = useRef<HTMLDivElement | null>(null);
  const replyBoxRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    async function loadAccounts() {
      const res = await fetch("/api/accounts");
      if (!res.ok) return;

      const payload = (await res.json()) as AccountsResponse;
      setAccounts(payload.accounts);
      const requestedAccountId = new URLSearchParams(window.location.search).get("accountId");
      setActiveAccountId((current) => current || requestedAccountId || payload.accounts[0]?.id || "");
    }

    void loadAccounts();
  }, []);

  useEffect(() => {
    async function loadMessages(sync: boolean) {
      if (!activeAccountId) {
        setMessages([]);
        setSelectedId("");
        return;
      }

      setLoadingMessages(true);
      try {
        const res = await fetch(
          `/api/messages?accountId=${encodeURIComponent(activeAccountId)}${sync ? "&sync=1" : ""}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;

        const payload = (await res.json()) as MessagesResponse;
        setMessages(payload.messages);
        setSelectedId((current) => {
          if (current && payload.messages.some((message) => message.id === current)) return current;
          return payload.messages[0]?.id ?? "";
        });
      } finally {
        setLoadingMessages(false);
      }
    }

    void loadMessages(true);
  }, [activeAccountId]);

  useEffect(() => {
    if (!activeAccountId) return;

    const active = accounts.find((account) => account.id === activeAccountId);
    if (!active) return;

    const intervalMs = active.syncIntervalMinutes * 60 * 1000;
    if (!Number.isFinite(intervalMs) || intervalMs < 60_000) return;

    let cancelled = false;

    async function poll() {
      if (cancelled || document.visibilityState !== "visible") return;

      const res = await fetch(`/api/messages?accountId=${encodeURIComponent(activeAccountId)}&sync=1`, {
        cache: "no-store"
      });
      if (!res.ok || cancelled) return;

      const payload = (await res.json()) as MessagesResponse;
      setMessages(payload.messages);
      setSelectedId((current) => {
        if (current && payload.messages.some((message) => message.id === current)) return current;
        return payload.messages[0]?.id ?? "";
      });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void poll();
      }
    }

    const timer = window.setInterval(() => {
      void poll();
    }, intervalMs);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [accounts, activeAccountId]);

  const selected = messages.find((message) => message.id === selectedId);
  const activeAccount = accounts.find((account) => account.id === activeAccountId);
  const threadMessages = useMemo(() => {
    if (!selected) {
      return [] as MailMessage[];
    }

    const threadKey = selected.threadId || selected.id;
    const related = messages.filter((message) => (message.threadId || message.id) === threadKey && message.id !== selected.id);
    related.sort((left, right) => new Date(left.receivedAt).getTime() - new Date(right.receivedAt).getTime());
    return [selected, ...related];
  }, [messages, selected]);

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

  function focusReplyBox() {
    replyBoxRef.current?.focus();
  }

  async function submitIssueReport() {
    if (!issueDescription.trim()) {
      setIssueError("Describe the issue before saving it.");
      return;
    }

    setIssueSubmitting(true);
    setIssueError(null);
    setIssueMessage(null);

    const payload = new FormData();
    payload.append("description", issueDescription);
    payload.append("pageRoute", `${window.location.pathname}${window.location.search}`);
    if (activeAccountId) {
      payload.append("accountId", activeAccountId);
    }
    if (issueScreenshot) {
      payload.append("screenshot", issueScreenshot);
    }

    const response = await fetch("/api/issues", {
      method: "POST",
      body: payload
    });

    setIssueSubmitting(false);

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => ({ error: "Unable to save issue report." }))) as {
        error?: string;
      };
      setIssueError(errorPayload.error ?? "Unable to save issue report.");
      return;
    }

    const result = (await response.json()) as IssueReportResponse;
    setIssueMessage(`Issue saved as ${result.reportId}.`);

    setIssueDescription("");
    setIssueScreenshot(null);
    setIssueFileKey((current) => current + 1);
    setShowIssueForm(false);
  }

  useEffect(() => {
    readingPaneRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [selectedId, activeAccountId]);

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
          <Link className="buttonLink" href={activeAccountId ? `/compose?accountId=${encodeURIComponent(activeAccountId)}` : "/compose"}>
            New email
          </Link>
          <button className="secondaryButton" onClick={() => setShowIssueForm((current) => !current)} type="button">
            {showIssueForm ? "Close issue report" : "Report an issue"}
          </button>
        </div>
      </section>

      {showIssueForm ? (
        <section className="panel stack-md">
          <div className="stack-sm">
            <p className="eyebrow">Tester feedback</p>
            <h2>Report an issue</h2>
            <p className="muted">Send a note and optional screenshot. The report is saved in the database for review.</p>
          </div>
          {issueError ? <p className="errorBanner">{issueError}</p> : null}
          {issueMessage ? <p className="successBanner">{issueMessage}</p> : null}
          <div className="stack-sm">
            <label className="fieldLabel" htmlFor="issue-description">
              What went wrong?
            </label>
            <textarea
              id="issue-description"
              onChange={(event) => setIssueDescription(event.target.value)}
              placeholder="Describe what you were doing, what happened, and what you expected instead."
              rows={6}
              value={issueDescription}
            />
          </div>
          <div className="stack-sm">
            <label className="fieldLabel" htmlFor="issue-screenshot">
              Screenshot
            </label>
            <input
              id="issue-screenshot"
              key={issueFileKey}
              accept="image/*"
              onChange={(event) => setIssueScreenshot(event.target.files?.[0] ?? null)}
              type="file"
            />
            <p className="muted">Optional. Images up to 5MB are accepted.</p>
          </div>
          <div className="actions">
            <button disabled={issueSubmitting} onClick={() => void submitIssueReport()} type="button">
              {issueSubmitting ? "Saving..." : "Save issue report"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid inboxGrid">
        <div className="panel messageListPanel">
          <div className="messagePanelHeader">
            <h2>Messages</h2>
            <p className="muted">
              {loadingMessages ? "Refreshing..." : `${messages.length} loaded`} {activeAccount ? `• every ${activeAccount.syncIntervalMinutes} min` : ""}
            </p>
          </div>
          <div className="messageListScroll">
            {messages.length === 0 ? <p className="muted">No messages in this account yet.</p> : null}
            {messages.map((message) => (
              <button
                className={`messageCard${message.id === selectedId ? " activeMessageCard" : ""}`}
                key={message.id}
                onClick={() => setSelectedId(message.id)}
                type="button"
              >
                <span className="messageCardHeader">
                  <strong>{message.subject}</strong>
                  {message.unread ? <span className="statusDot" aria-label="Unread" /> : null}
                </span>
                <span>{message.from}</span>
                <span className="muted">{message.preview}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel readingPanePanel">
          {selected ? (
            <>
              <div className="readingPaneHeader">
                <div className="stack-sm">
                  <h2>{selected.subject}</h2>
                  <p className="muted">
                    {selected.from} to {selected.to}
                  </p>
                  {threadMessages.length > 1 ? <p className="muted">Thread with {threadMessages.length} messages</p> : null}
                </div>
                <div className="iconActionStack">
                  <button className="iconActionButton" onClick={focusReplyBox} type="button">
                    <span aria-hidden="true">↩</span>
                    <span>Reply</span>
                  </button>
                  <button className="iconActionButton dangerIconButton" onClick={deleteSelected} type="button">
                    <span aria-hidden="true">🗑</span>
                    <span>Delete</span>
                  </button>
                  {selected.unread ? (
                    <button className="iconActionButton secondaryButton" onClick={markRead} type="button">
                      <span>Mark read</span>
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="replyComposer stack-sm">
                <label className="fieldLabel" htmlFor="reply-box">
                  Reply
                </label>
                <textarea id="reply-box" onChange={(e) => setReply(e.target.value)} ref={replyBoxRef} rows={5} value={reply} />
                <div>
                  <button onClick={sendReply} type="button">
                    Send Reply
                  </button>
                </div>
              </div>

              <div className="readingPaneScroll" ref={readingPaneRef}>
                {threadMessages.map((message, index) => (
                  <article className={`threadMessageCard${index === 0 ? " currentThreadMessage" : ""}`} key={message.id}>
                    <div className="threadMessageHeader">
                      <div className="stack-sm">
                        <strong>{message.from}</strong>
                        <p className="muted">
                          {new Date(message.receivedAt).toLocaleString()} {message.id === selected.id ? "• current message" : ""}
                        </p>
                      </div>
                    </div>
                    <p className="threadMessageBody">{message.bodyText}</p>
                  </article>
                ))}
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
