import Link from "next/link";

export default function NotFound() {
  return (
    <main className="main-stack">
      <section className="card" style={{ marginTop: 40 }}>
        <p className="eyebrow">404</p>
        <h1 style={{ marginBottom: 10 }}>Page not found</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          The journal or page you requested is not available. It may have been removed or the link may be invalid.
        </p>
        <div className="meta-row">
          <Link href="/journals" className="button button-primary compact">Browse journals</Link>
          <Link href="/" className="button button-ghost compact">Go home</Link>
        </div>
      </section>
    </main>
  );
}
