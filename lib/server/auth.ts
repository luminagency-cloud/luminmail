import { randomBytes, scrypt as scryptCallback, createHash, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import nodemailer from "nodemailer";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dbQuery } from "@/lib/db/server";
import { getAppUrl } from "@/lib/server/app-url";
import type { AppUser } from "@/lib/types/app-user";

const scrypt = promisify(scryptCallback);

const SESSION_COOKIE_NAME = "luminmail_session";
const SESSION_TTL_DAYS = 30;
const PASSWORD_RESET_TTL_MINUTES = 60;
const MIN_PASSWORD_LENGTH = 8;

type AppUserRow = {
  id: string;
  auth_user_id: string | null;
  email: string;
  display_name: string | null;
  password_hash: string | null;
};

type SessionRow = {
  user_id: string;
  auth_user_id: string | null;
  email: string;
  display_name: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function mapUser(row: AppUserRow): AppUser {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    displayName: row.display_name
  };
}

function toAuthUser(user: AppUser): AuthUser {
  return {
    id: user.authUserId ?? user.id,
    email: user.email,
    displayName: user.displayName
  };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sessionExpiresAt() {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function passwordResetExpiresAt() {
  return new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
}

function getCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires
  };
}

async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getCookieOptions(expiresAt));
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...getCookieOptions(new Date(0)),
    maxAge: 0
  });
}

export function sanitizeNextPath(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/inbox";
  }

  return next;
}

export function normalizeAuthMessage(message: string | undefined) {
  if (!message) return null;

  const lower = message.toLowerCase();
  if (lower.includes("invalid email or password")) return "Invalid email or password.";
  if (lower.includes("password reset token")) return "That reset link is invalid or expired. Request a fresh password reset email.";
  if (lower.includes("already exists")) return "That email address already has an account.";
  if (lower.includes("at least")) return message;
  return message;
}

export function validatePasswordRules(password: string, confirmPassword?: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`;
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    return "The password and confirmation do not match.";
  }

  return null;
}

async function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString("base64");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString("base64")}`;
}

async function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) {
    return false;
  }

  const [algorithm, salt, expected] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) {
    return false;
  }

  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expectedBuffer = Buffer.from(expected, "base64");

  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

async function getUserByEmail(email: string) {
  const result = await dbQuery<AppUserRow>(
    `
      select id, auth_user_id, email, display_name, password_hash
      from public.users
      where lower(email) = $1::text
      limit 1
    `,
    [normalizeEmail(email)]
  );

  return result.rows[0] ?? null;
}

async function getUserByPasswordResetToken(token: string) {
  const result = await dbQuery<AppUserRow>(
    `
      select u.id, u.auth_user_id, u.email, u.display_name, u.password_hash
      from public.password_reset_tokens prt
      join public.users u on u.id = prt.user_id
      where prt.token_hash = $1::text
        and prt.used_at is null
        and prt.expires_at > timezone('utc', now())
      limit 1
    `,
    [hashToken(token)]
  );

  return result.rows[0] ?? null;
}

async function createSession(userId: string) {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = sessionExpiresAt();

  await dbQuery(
    `
      insert into public.user_sessions (user_id, token_hash, expires_at)
      values ($1::uuid, $2::text, $3::timestamptz)
    `,
    [userId, hashToken(rawToken), expiresAt.toISOString()]
  );

  await setSessionCookie(rawToken, expiresAt);
}

export async function signOutCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await dbQuery(
      `
        delete from public.user_sessions
        where token_hash = $1::text
      `,
      [hashToken(token)]
    );
  }

  await clearSessionCookie();
}

export async function getCurrentAppUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const result = await dbQuery<SessionRow>(
    `
      select u.id as user_id, u.auth_user_id, u.email, u.display_name
      from public.user_sessions us
      join public.users u on u.id = us.user_id
      where us.token_hash = $1::text
        and us.expires_at > timezone('utc', now())
        and us.revoked_at is null
      limit 1
    `,
    [hashToken(token)]
  );

  const row = result.rows[0];
  if (!row) {
    await clearSessionCookie();
    return null;
  }

  await dbQuery(
    `
      update public.user_sessions
      set last_seen_at = timezone('utc', now())
      where token_hash = $1::text
    `,
    [hashToken(token)]
  );

  return {
    id: row.user_id,
    authUserId: row.auth_user_id,
    email: row.email,
    displayName: row.display_name
  };
}

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  const appUser = await getCurrentAppUser();
  return appUser ? toAuthUser(appUser) : null;
}

export async function getCurrentUser() {
  return getCurrentAuthUser();
}

export async function requireUser() {
  const user = await getCurrentAuthUser();
  if (!user) {
    redirect("/");
  }

  return user;
}

export async function requireAppUser(): Promise<{ authUser: AuthUser; appUser: AppUser }> {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    redirect("/");
  }

  return { authUser: toAuthUser(appUser), appUser };
}

export async function registerUser(input: { email: string; password: string; displayName?: string | null }) {
  const email = normalizeEmail(input.email);
  const passwordError = validatePasswordRules(input.password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const passwordHash = await createPasswordHash(input.password);
  const displayName = input.displayName?.trim() || email.split("@")[0] || null;

  try {
    const result = await dbQuery<AppUserRow>(
      `
        insert into public.users (email, display_name, password_hash)
        values ($1::text, $2::text, $3::text)
        returning id, auth_user_id, email, display_name, password_hash
      `,
      [email, displayName, passwordHash]
    );

    const user = mapUser(result.rows[0]);
    await createSession(user.id);
    return user;
  } catch (error) {
    const pgError = error as { code?: string; message?: string };
    if (pgError.code === "23505") {
      throw new Error("An account with that email already exists.");
    }

    throw new Error(pgError.message ?? "Unable to create account.");
  }
}

export async function signInWithPassword(email: string, password: string) {
  const user = await getUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new Error("Invalid email or password.");
  }

  await createSession(user.id);
  return mapUser(user);
}

function hasAppSmtpConfig() {
  return Boolean(process.env.APP_SMTP_HOST && process.env.APP_SMTP_FROM);
}

async function sendPasswordResetEmail(email: string, resetUrl: string) {
  if (!hasAppSmtpConfig()) {
    console.info(`[auth:info] password reset for ${email}: ${resetUrl}`);
    return { delivery: "logged" as const };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.APP_SMTP_HOST,
    port: Number(process.env.APP_SMTP_PORT ?? 587),
    secure: Number(process.env.APP_SMTP_PORT ?? 587) === 465,
    auth:
      process.env.APP_SMTP_USER && process.env.APP_SMTP_PASSWORD
        ? {
            user: process.env.APP_SMTP_USER,
            pass: process.env.APP_SMTP_PASSWORD
          }
        : undefined
  });

  await transporter.sendMail({
    from: process.env.APP_SMTP_FROM,
    to: email,
    subject: "Reset your LuminMail password",
    text: `Use this link to reset your password: ${resetUrl}\n\nThis link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.`,
    html: `<p>Use this link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.</p>`
  });

  return { delivery: "email" as const };
}

export async function requestPasswordReset(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const user = await getUserByEmail(normalizedEmail);

  if (!user) {
    return { delivery: "ignored" as const };
  }

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = passwordResetExpiresAt();

  await dbQuery(
    `
      delete from public.password_reset_tokens
      where user_id = $1::uuid
         or expires_at <= timezone('utc', now())
    `,
    [user.id]
  );

  await dbQuery(
    `
      insert into public.password_reset_tokens (user_id, token_hash, expires_at)
      values ($1::uuid, $2::text, $3::timestamptz)
    `,
    [user.id, hashToken(rawToken), expiresAt.toISOString()]
  );

  const appUrl = await getAppUrl();
  const resetUrl = new URL("/reset-password", appUrl);
  resetUrl.searchParams.set("token", rawToken);

  return sendPasswordResetEmail(user.email, resetUrl.toString());
}

export async function verifyPasswordResetToken(token: string) {
  if (!token?.trim()) {
    return null;
  }

  const user = await getUserByPasswordResetToken(token.trim());
  return user ? mapUser(user) : null;
}

export async function resetPasswordWithToken(token: string, password: string) {
  const passwordError = validatePasswordRules(password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const user = await getUserByPasswordResetToken(token.trim());
  if (!user) {
    throw new Error("Password reset token is invalid or expired.");
  }

  const passwordHash = await createPasswordHash(password);

  await dbQuery(
    `
      update public.users
      set password_hash = $2::text,
          updated_at = timezone('utc', now())
      where id = $1::uuid
    `,
    [user.id, passwordHash]
  );

  await dbQuery(
    `
      update public.password_reset_tokens
      set used_at = timezone('utc', now())
      where user_id = $1::uuid
    `,
    [user.id]
  );

  await dbQuery(
    `
      delete from public.user_sessions
      where user_id = $1::uuid
    `,
    [user.id]
  );

  await clearSessionCookie();
  return mapUser(user);
}
