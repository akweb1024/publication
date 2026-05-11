import { listJournals } from "../lib/api";
import ErrorAlert from "../components/ErrorAlert";

export default async function HomePage() {
  let journals: Awaited<ReturnType<typeof listJournals>> = [];
  let loadError: string | null = null;
  try {
    journals = await listJournals();
  } catch (error: any) {
    loadError = error?.message ?? "Failed to load journals.";
  }
  return (
    <main className="main-stack">
      <section className="hero">
        <span className="eyebrow" style={{ color: "#fb923c" }}>STM JOURNALS</span>
        <h1>Scientific, Technical & Medical Publishing.</h1>
        <p>
          The premier platform for managing high-impact journals, submissions, and editorial workflows. Built for precision and scale.
        </p>
        <div className="meta-row">
          <span className="chip">Issue-based publishing</span>
          <span className="chip">Double-blind review</span>
          <span className="chip">Policy versioning</span>
        </div>
      </section>

      <div style={{ marginBottom: "32px" }}>
        <span className="eyebrow">Directory</span>
        <h2 style={{ fontSize: "2.5rem", marginBottom: "8px" }}>Active Journals</h2>
        <p style={{ fontSize: "1.1rem", color: "var(--ink-600)" }}>
          Choose a journal to explore editorial policies and publication context.
        </p>
        {loadError ? (
          <div style={{ marginTop: 24 }}>
            <ErrorAlert message={`${loadError} Ensure API is running and \`API_BASE\`/\`NEXT_PUBLIC_API_BASE\` is correct.`} />
          </div>
        ) : null}
      </div>

      <div className="grid">
        {journals.map((j) => (
          <div key={j.id} className="card journal-card">
            <span className="eyebrow">Journal Profile</span>
            <h3>{j.title}</h3>
            {j.description ? (
              <p>{j.description}</p>
            ) : (
              <p className="muted" style={{ fontStyle: "italic" }}>No description available for this journal.</p>
            )}
            
            <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <a className="button button-primary compact" href={`/${j.slug}`}>
                Overview
              </a>
              <a className="button button-ghost compact" href={`/${j.slug}/archive`}>
                Archive
              </a>
              <a className="button button-ghost compact" href={`/${j.slug}/policies`}>
                Policies
              </a>
              <a className="button button-ghost compact" href={`/${j.slug}/focus-scope`}>
                Scope
              </a>
            </div>
          </div>
        ))}
        {!loadError && journals.length === 0 ? (
          <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px" }}>
            <p className="muted">No journals available yet. Start by creating your first journal in the dashboard.</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
