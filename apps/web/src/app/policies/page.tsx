import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Policies & Ethics | STM Journals",
  description: "Global policies, ethics guidelines, and governance for STM Journals.",
};

export default function PoliciesPage() {
  return (
    <main className="main-stack">
      <section className="hero">
        <span className="eyebrow" style={{ color: "var(--accent-secondary)" }}>Governance</span>
        <h1>Policies & Ethics</h1>
        <p>Our commitment to rigorous, ethical publishing standards.</p>
      </section>
      
      <section className="container" style={{ padding: "40px 0" }}>
        <div className="card" style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
          <h2 style={{ marginBottom: "20px" }}>Publishing Ethics</h2>
          <p style={{ marginBottom: "16px", lineHeight: 1.6 }}>
            STM Journals adheres to the highest standards of publishing ethics as outlined by the Committee on Publication Ethics (COPE). We are committed to maintaining the integrity of the scientific record.
          </p>
          
          <h2 style={{ marginTop: "40px", marginBottom: "20px" }}>Peer Review Policy</h2>
          <p style={{ marginBottom: "16px", lineHeight: 1.6 }}>
            All research articles published in STM Journals undergo rigorous peer review, based on initial editor screening and anonymized refereeing by independent expert referees. Our standard is double-blind peer review.
          </p>

          <h2 style={{ marginTop: "40px", marginBottom: "20px" }}>Open Access Policy</h2>
          <p style={{ marginBottom: "16px", lineHeight: 1.6 }}>
            We support the principles of Open Access. Specific journals within the STM portfolio offer Gold Open Access options to ensure research is freely available immediately upon publication.
          </p>
        </div>
      </section>
    </main>
  );
}
