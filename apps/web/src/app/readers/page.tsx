import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Readers | STM Journals",
  description: "Information and resources for readers of STM Journals.",
};

export default function ReadersPage() {
  return (
    <main className="main-stack">
      <section className="hero">
        <span className="eyebrow" style={{ color: "var(--accent-secondary)" }}>Guidelines</span>
        <h1>For Readers</h1>
        <p>Access the latest scientific, technical, and medical research.</p>
      </section>
      
      <section className="container" style={{ padding: "40px 0" }}>
        <div className="card" style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
          <h2 style={{ marginBottom: "20px" }}>Accessing Content</h2>
          <p style={{ marginBottom: "16px", lineHeight: 1.6 }}>
            STM Journals publishes a mix of Open Access and subscription-based content. Open Access articles are freely available to read, download, and share immediately upon publication.
          </p>
          
          <h2 style={{ marginTop: "40px", marginBottom: "20px" }}>Alerts & Notifications</h2>
          <p style={{ marginBottom: "16px", lineHeight: 1.6 }}>
            Stay up-to-date with the latest research in your field by signing up for electronic tables of contents (eTOCs) and custom keyword alerts.
          </p>
        </div>
      </section>
    </main>
  );
}
