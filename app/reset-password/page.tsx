import Link from "next/link";
import { updatePasswordAction } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/server/auth";

function normalizeResetMessage(message: string | undefined) {
  if (!message) return null;

  const lower = message.toLowerCase();
  if (lower.includes("auth session missing")) return "That reset link is no longer valid. Request a fresh password reset email.";
  if (lower.includes("expired")) return "That reset link expired. Request a new password reset email.";
  if (lower.includes("same password")) return "Choose a different password from your current one.";
  return message;
}

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const error = normalizeResetMessage(params.error);
  const user = await getCurrentUser();

  return (
    <main className="container authShell">
      <section className="authCard stack-lg compactCard">
        <div className="stack-sm">
          <p className="eyebrow">Reset password</p>
          <h1>Choose a new password</h1>
          <p className="muted">Open this page from the newest reset email, then set the password you want to use going forward.</p>
        </div>

        {error ? <p className="errorBanner">{error}</p> : null}
        {params.message ? <p className="successBanner">{params.message}</p> : null}

        {user ? (
          <form action={updatePasswordAction} className="authPanel stack-md compactPanel">
            <div className="stack-sm">
              <label className="fieldLabel" htmlFor="new-password">
                New password
              </label>
              <input id="new-password" minLength={8} name="password" required type="password" />
            </div>
            <div className="stack-sm">
              <label className="fieldLabel" htmlFor="confirm-password">
                Confirm new password
              </label>
              <input id="confirm-password" minLength={8} name="confirmPassword" required type="password" />
            </div>
            <div className="actions">
              <button type="submit">Update password</button>
              <Link className="buttonLink secondaryButton" href="/">
                Back to sign in
              </Link>
            </div>
          </form>
        ) : (
          <section className="authPanel stack-md compactPanel">
            <p className="muted">There is no active recovery session right now. Request a new password reset email and use the newest link.</p>
            <div className="actions">
              <Link className="buttonLink secondaryButton" href="/">
                Back to sign in
              </Link>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
