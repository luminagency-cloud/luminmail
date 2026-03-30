import type { MailMessage } from "@/lib/types/mail";

let messages: MailMessage[] = [
  {
    id: "msg_001",
    accountId: "acct_work",
    threadId: "thread_abc",
    from: "Taylor <taylor@example.com>",
    fromEmail: "taylor@example.com",
    to: "You <you@luminmail.dev>",
    subject: "Re: Launch checklist",
    preview: "Pushed final copy updates. Can you review before noon?",
    bodyText: "Hey — can you review the final draft before noon?",
    receivedAt: "2026-03-28T09:22:00Z",
    unread: true,
    folderRole: "inbox",
    folderId: "folder_inbox"
  },
  {
    id: "msg_002",
    accountId: "acct_personal",
    threadId: "thread_xyz",
    from: "Casey <casey@example.com>",
    fromEmail: "casey@example.com",
    to: "Me <me@luminmail.dev>",
    subject: "Dinner tomorrow?",
    preview: "Want to grab dinner after work around 7?",
    bodyText: "Want to grab dinner after work around 7? I can book a table.",
    receivedAt: "2026-03-27T19:10:00Z",
    unread: false,
    folderRole: "inbox",
    folderId: "folder_inbox"
  }
];

export function listMessages(accountId?: string): MailMessage[] {
  const filtered = accountId ? messages.filter((message) => message.accountId === accountId) : messages;
  return [...filtered].sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
}

export function markMessageRead(id: string): MailMessage | undefined {
  const message = messages.find((entry) => entry.id === id);
  if (!message) return undefined;
  message.unread = false;
  return message;
}

export function deleteMessage(id: string): boolean {
  const before = messages.length;
  messages = messages.filter((message) => message.id !== id);
  return before !== messages.length;
}

export function replyToMessage(id: string, bodyText: string): MailMessage | undefined {
  const source = messages.find((message) => message.id === id);
  if (!source || !bodyText.trim()) return undefined;

  const reply: MailMessage = {
    id: `msg_${Date.now()}`,
    accountId: source.accountId,
    threadId: source.threadId,
    from: "You <you@luminmail.dev>",
    fromEmail: "you@luminmail.dev",
    to: source.from,
    subject: source.subject.startsWith("Re:") ? source.subject : `Re: ${source.subject}`,
    preview: bodyText.slice(0, 80),
    bodyText,
    receivedAt: new Date().toISOString(),
    unread: false,
    folderRole: "",
    folderId: ""
  };

  messages = [reply, ...messages];
  return reply;
}
