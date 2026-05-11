import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Authors | STM Journals",
  description: "Guidelines and resources for authors submitting to STM Journals.",
};

export default function AuthorsPage() {
  return (
    <main className="main-stack">
      <section className="hero">
        <span className="eyebrow" style={{ color: "var(--accent-secondary)" }}>Guidelines</span>
        <h1>For Authors</h1>
        <p>Everything you need to know about preparing and submitting your manuscript.</p>
      </section>
      
      <section className="container" style={{ padding: "40px 0" }}>
        <div className="card" style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
          <h2 style={{ marginBottom: "20px" }}>Submission Process</h2>
          <p style={{ marginBottom: "16px", lineHeight: 1.6 }}>
            Our streamlined editorial workspace makes submission simple. Authors can track their manuscript's status in real-time and communicate directly with the editorial team.
          </p>
          
          <h2 style={{ marginTop: "40px", marginBottom: "20px" }}>Manuscript Preparation</h2>
          <ul style={{ listStyleType: "disc", paddingLeft: "20px", lineHeight: 1.6 }}>
            <li style={{ marginBottom: "8px" }}>Ensure your manuscript meets the scope of the target journal.</li>
            <li style={{ marginBottom: "8px" }}>Follow the formatting guidelines detailed in the specific journal's policy library.</li>
            <li style={{ marginBottom: "8px" }}>Include all necessary conflict of interest and funding declarations.</li>
          </ul>

          <div style={{ marginTop: "40px", textAlign: "center" }}>
            <a href="/login" className="button button-primary">Submit a Manuscript</a>
          </div>
        </div>
      </section>
    </main>
  );
}
