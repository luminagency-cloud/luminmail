import { redirect } from "next/navigation";
import { requestPasswordResetAction, signInAction, signUpAction } from "@/app/login/actions";
import { getCurrentUser, normalizeAuthMessage, sanitizeNextPath } from "@/lib/server/auth";

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
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
              Sign in with your LuminMail email and password, or create a new account below. New accounts are active
              immediately after signup.
            </p>
          </div>
        </div>

        {errorMessage ? <p className="errorBanner">{errorMessage}</p> : null}
        {params.message ? <p className="successBanner">{params.message}</p> : null}

        <form action={requestPasswordResetAction} className="authPanel stack-sm">
          <p className="eyebrow">Password reset</p>
          <p className="muted">Forgot your password? We can send a reset link to your inbox.</p>
          <div className="inlineForm">
            <input name="email" placeholder="you@example.com" type="email" />
            <button className="secondaryButton" type="submit">
              Send reset email
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
              <p className="muted">Create your account with an email and password. You will be signed in immediately.</p>
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

        <p className="muted">Accounts, sessions, and mailbox data now live directly in Postgres.</p>
      </section>
    </main>
  );
}
