export type MailMessageSummary = {
  id: string;
  accountId: string;
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  receivedAt: string;
  unread: boolean;
  threadId: string;
  folderRole: string;
  folderId: string;
};

export type MailMessage = MailMessageSummary & {
  to: string;
  bodyText: string;
};
