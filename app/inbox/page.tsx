"use client";

import { useState } from "react";
import type { MailMessage } from "@/lib/types/mail";

const initialMessages: MailMessage[] = [
  {
    id: "msg_001",
    threadId: "thread_abc",
    from: "Taylor <taylor@example.com>",
    to: "You <you@luminmail.dev>",
    subject: "Re: Launch checklist",
    preview: "Pushed final copy updates. Can you review before noon?",
    bodyText: "Hey — can you review the final draft before noon?",
    receivedAt: "2026-03-28T09:22:00Z",
    unread: true
  }
];

export default function InboxPage() {
  const [messages, setMessages] = useState(initialMessages);
  const [selectedId, setSelectedId] = useState(initialMessages[0]?.id ?? "");
  const [reply, setReply] = useState("");
  const selected = messages.find((message) => message.id === selectedId);

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
    setMessages((current) => current.filter((m) => m.id !== selected.id));
    setSelectedId("");
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
    <main className="container">
      <h1>Inbox</h1>
      {messages.map((message) => (
        <div className="card" key={message.id}>
          <strong>{message.subject}</strong>
          <p>{message.from}</p>
          <p>{message.preview}</p>
          <button onClick={() => setSelectedId(message.id)} type="button">
            Open
          </button>
        </div>
      ))}

      {selected ? (
        <div className="card">
          <h2>{selected.subject}</h2>
          <p>{selected.bodyText}</p>
          <button onClick={markRead} type="button">
            Mark Read
          </button>
          <button onClick={deleteSelected} type="button">
            Delete
          </button>
          <p>Reply:</p>
          <textarea onChange={(e) => setReply(e.target.value)} rows={4} value={reply} />
          <p>
            <button onClick={sendReply} type="button">
              Send Reply
            </button>
          </p>
        </div>
      ) : null}
    </main>
  );
}