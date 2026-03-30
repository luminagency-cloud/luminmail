import { Suspense } from "react";
import { ComposeClient } from "@/app/compose/compose-client";

export default function ComposePage() {
  return (
    <Suspense
      fallback={
        <main className="container stack-lg">
          <section className="panel">
            <p className="muted">Loading compose…</p>
          </section>
        </main>
      }
    >
      <ComposeClient />
    </Suspense>
  );
}
