import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { signInAction, signUpAction } from "@/app/login/actions";

export default async function LoginPage({
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
  const next = params.next ?? "/inbox";

  return (
    <main className="container authShell">
      <section className="authCard stack-lg">
        <div className="stack-sm">
          <p className="eyebrow">LuminMail auth</p>
          <h1>Sign in</h1>
          <p className="muted">Use Supabase Auth to access mailbox settings and the protected inbox shell.</p>
        </div>

        {params.error ? <p className="errorBanner">{params.error}</p> : null}
        {params.message ? <p className="successBanner">{params.message}</p> : null}

        <form action={signInAction} className="stack-md">
          <input name="next" type="hidden" value={next} />
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

        <form action={signUpAction} className="stack-md">
          <input name="next" type="hidden" value={next} />
          <div className="stack-sm">
            <label className="fieldLabel" htmlFor="sign-up-email">
              New account email
            </label>
            <input id="sign-up-email" name="email" required type="email" />
          </div>
          <div className="stack-sm">
            <label className="fieldLabel" htmlFor="sign-up-password">
              New account password
            </label>
            <input id="sign-up-password" minLength={8} name="password" required type="password" />
          </div>
          <button className="secondaryButton" type="submit">
            Create account
          </button>
        </form>

        <p className="muted">
          After sign-in, account records are stored in Supabase. Mail sync and SMTP delivery are still mock-backed for now.
        </p>
        <p>
          <Link href="/">Back home</Link>
        </p>
      </section>
    </main>
  );
}
