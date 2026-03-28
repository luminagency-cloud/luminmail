import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      <h1>LuminMail</h1>
      <p>Minimal web email client prototype (read, delete, reply).</p>
      <p>
        <Link href="/inbox">Open inbox →</Link>
      </p>
    </main>
  );
}