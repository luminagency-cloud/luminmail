import Link from "next/link";
import { APP_VERSION } from "@/lib/app-version";

export default function AboutPage() {
  return (
    <main className="container">
      <section className="aboutCard stack-md">
        <div className="stack-sm">
          <p className="eyebrow">About</p>
          <h1>LuminMail</h1>
          <p className="muted">
            Minimal webmail prototype with Supabase auth, IMAP-backed sync, SMTP sending, and account-level mailbox
            management.
          </p>
        </div>

        <div className="aboutMeta">
          <div>
            <p className="fieldLabel">Current version</p>
            <p className="aboutVersion">v{APP_VERSION}</p>
          </div>
          <div>
            <p className="fieldLabel">Status</p>
            <p className="muted">Prototype build with background sync and account management in active development.</p>
          </div>
        </div>

        <p className="muted">
          Use this page as a quick deploy check so you can confirm the running build version without opening the full
          stack.
        </p>

        <p>
          <Link href="/api/health">Health check</Link>
        </p>
      </section>
    </main>
  );
}
