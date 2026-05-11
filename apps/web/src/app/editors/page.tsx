import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Editors | STM Journals",
  description: "Resources, policies, and platform access for STM Journals Editors.",
};

export default function EditorsPage() {
  return (
    <main className="main-stack">
      <section className="hero">
        <span className="eyebrow" style={{ color: "var(--accent-secondary)" }}>Guidelines</span>
        <h1>For Editors</h1>
        <p>The operational surface for managing editorial workflows.</p>
      </section>
      
      <section className="container" style={{ padding: "40px 0" }}>
        <div className="card" style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
          <h2 style={{ marginBottom: "20px" }}>Editorial Responsibilities</h2>
          <p style={{ marginBottom: "16px", lineHeight: 1.6 }}>
            Editors play a crucial role in maintaining the quality and integrity of our journals. From initial triage to securing expert reviewers and making final decisions, the editorial board is the backbone of STM Journals.
          </p>
          
          <h2 style={{ marginTop: "40px", marginBottom: "20px" }}>Platform Access</h2>
          <p style={{ marginBottom: "16px", lineHeight: 1.6 }}>
            The JournalPub Editorial Workspace provides a unified dashboard to manage submissions, coordinate with reviewers, and handle production tasks. Log in to access your designated queues.
          </p>

          <div style={{ marginTop: "40px", textAlign: "center" }}>
            <a href="/login" className="button button-primary">Access Editorial Workspace</a>
          </div>
        </div>
      </section>
    </main>
  );
}
