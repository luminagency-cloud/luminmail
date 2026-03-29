import Link from "next/link";
import { redirect } from "next/navigation";
import { resendConfirmationAction, signInAction, signUpAction } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/server/auth";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";

function normalizeAuthMessage(message: string | undefined) {
  if (!message) return null;

  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) return "Invalid email or password.";
  if (lower.includes("email not confirmed")) return "Check your inbox and confirm your account before signing in.";
  if (lower.includes("expired")) return "That link expired. Request a fresh confirmation email and use the newest message.";
  if (lower.includes("otp")) return "That confirmation link is invalid or expired. Request a new one.";
  return message;
}

function sanitizeNextPath(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/inbox";
  }

  return next;
}

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  if (!hasSupabasePublicEnv()) {
    return (
      <main className="container stack-lg">
        <section className="panel">
          <h1>Supabase env missing</h1>
          <p>Add the Supabase project URL and keys to `.env.local` before using auth.</p>
        </section>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (user) {
    redirect("/inbox");
  }

  const params = await searchParams;
  const next = sanitizeNextPath(params.next);
  const errorMessage = normalizeAuthMessage(params.error);

  return (
    <main className="container authShell">
      <section className="authCard stack-lg">
        <div className="heroIntro stack-md">
          <div className="stack-sm">
            <p className="eyebrow">LuminMail</p>
            <h1>Simple email for people who hate webmail</h1>
            <p className="heroText">
              A cleaner personal email manager for people who are tired of clunky browser inboxes and bloated webmail
              UIs.
            </p>
          </div>
          <div className="heroMeta">
            <p className="muted">
              Sign in if you already have an account, or create one below. New signups should look for a confirmation
              email from Supabase for now.
            </p>
            <p className="muted">
              If no confirmation email arrives, check your Supabase email confirmation settings and SMTP configuration.
            </p>
          </div>
        </div>

        {errorMessage ? <p className="errorBanner">{errorMessage}</p> : null}
        {params.message ? <p className="successBanner">{params.message}</p> : null}

        <form action={resendConfirmationAction} className="authPanel stack-sm">
          <input name="next" type="hidden" value={next} />
          <p className="eyebrow">Confirmation help</p>
          <p className="muted">If the signup email expired or never arrived, resend it here.</p>
          <div className="inlineForm">
            <input name="email" placeholder="you@example.com" type="email" />
            <button className="secondaryButton" type="submit">
              Resend confirmation
            </button>
          </div>
        </form>

        <div className="authGrid">
          <form action={signInAction} className="authPanel stack-md">
            <input name="next" type="hidden" value={next} />
            <div className="stack-sm">
              <p className="eyebrow">Existing account</p>
              <h2>Sign in</h2>
              <p className="muted">Use your email and password to get back to your inboxes.</p>
            </div>
            <div className="stack-sm">
              <label className="fieldLabel" htmlFor="sign-in-email">
                Email
              </label>
              <input id="sign-in-email" name="email" required type="email" />
            </div>
            <div className="stack-sm">
              <label className="fieldLabel" htmlFor="sign-in-password">
                Password
              </label>
              <input id="sign-in-password" name="password" required type="password" />
            </div>
            <button type="submit">Sign in</button>
          </form>

          <form action={signUpAction} className="authPanel stack-md">
            <input name="next" type="hidden" value={next} />
            <div className="stack-sm">
              <p className="eyebrow">New account</p>
              <h2>Sign up</h2>
              <p className="muted">Create your account, then watch for a confirmation email from Supabase.</p>
            </div>
            <div className="stack-sm">
              <label className="fieldLabel" htmlFor="sign-up-email">
                Email
              </label>
              <input id="sign-up-email" name="email" required type="email" />
            </div>
            <div className="stack-sm">
              <label className="fieldLabel" htmlFor="sign-up-password">
                Password
              </label>
              <input id="sign-up-password" minLength={8} name="password" required type="password" />
            </div>
            <button className="secondaryButton" type="submit">
              Sign up
            </button>
          </form>
        </div>

        <p className="muted">
          Account records are stored in Supabase right now. Message sync and sending are still being wired up behind
          this shell.
        </p>
        <p>
          <Link href="/api/health">Health check</Link>
        </p>
      </section>
    </main>
  );
}
