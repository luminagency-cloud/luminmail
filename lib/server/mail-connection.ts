import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import type { AccountTestResult } from "@/lib/types/account-test";

type MailConnectionInput = {
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
};

function formatMailError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unknown connection error";
  }

  const message = error.message.toLowerCase();

  if (message.includes("invalid login") || message.includes("authentication") || message.includes("auth")) {
    return "Authentication failed. Check the email address and password.";
  }

  if (message.includes("timed out") || message.includes("timeout")) {
    return "Connection timed out. Check the host, port, and network reachability.";
  }

  if (message.includes("enotfound") || message.includes("getaddrinfo")) {
    return "Host not found. Check the server hostname.";
  }

  if (message.includes("certificate") || message.includes("tls")) {
    return "TLS or certificate negotiation failed.";
  }

  return error.message;
}

export async function testMailConnection(input: MailConnectionInput): Promise<AccountTestResult> {
  const imap = await testImapConnection(input);
  const smtp = await testSmtpConnection(input);

  return { imap, smtp };
}

async function testImapConnection(input: MailConnectionInput) {
  const client = new ImapFlow({
    host: input.imapHost,
    port: input.imapPort,
    secure: input.imapPort === 993,
    auth: {
      user: input.email,
      pass: input.password
    },
    logger: false
  });

  try {
    await client.connect();
    return { ok: true, message: "IMAP connection succeeded." };
  } catch (error) {
    return { ok: false, message: formatMailError(error) };
  } finally {
    try {
      await client.logout();
    } catch {}
  }
}

async function testSmtpConnection(input: MailConnectionInput) {
  const transporter = nodemailer.createTransport({
    host: input.smtpHost,
    port: input.smtpPort,
    secure: input.smtpPort === 465,
    auth: {
      user: input.email,
      pass: input.password
    }
  });

  try {
    await transporter.verify();
    return { ok: true, message: "SMTP connection succeeded." };
  } catch (error) {
    return { ok: false, message: formatMailError(error) };
  }
}
