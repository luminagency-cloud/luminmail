export type MailMessageSummary = {
  id: string;
  from: string;
  subject: string;
  preview: string;
  receivedAt: string;
  unread: boolean;
  threadId: string;
};

export type MailMessage = MailMessageSummary & {
  to: string;
  bodyText: string;
};