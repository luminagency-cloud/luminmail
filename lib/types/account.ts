export type MailAccount = {
  id: string;
  name: string;
  email: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  signature: string;
  passwordStored: boolean;
  source: "manual" | "env";
};
