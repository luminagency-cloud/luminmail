import Link from "next/link";
import { getCurrentUser } from "@/lib/server/auth";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="container stack-lg">
      <h1>LuminMail</h1>
      <p>Minimal web email client prototype with Supabase auth, account switching, and a DB-backed account model.</p>
      <p>
        <Link href={user ? "/inbox" : "/login"}>{user ? "Open inbox →" : "Sign in →"}</Link>
      </p>
      <p>
        <Link href="/accounts">Manage accounts →</Link>
      </p>
    </main>
  );
}
