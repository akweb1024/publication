import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Subscribers | STM Journals",
  description: "Subscription information and institutional access details.",
};

export default function SubscribersPage() {
  return (
    <main className="main-stack">
      <section className="hero">
        <span className="eyebrow" style={{ color: "var(--accent-secondary)" }}>Guidelines</span>
        <h1>For Subscribers</h1>
        <p>Manage your institutional or personal subscriptions.</p>
      </section>
      
      <section className="container" style={{ padding: "40px 0" }}>
        <div className="card" style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
          <h2 style={{ marginBottom: "20px" }}>Institutional Access</h2>
          <p style={{ marginBottom: "16px", lineHeight: 1.6 }}>
            We offer comprehensive institutional licensing options covering our entire portfolio of scientific, technical, and medical journals. Access is managed seamlessly via IP recognition or Shibboleth/OpenAthens.
          </p>
          
          <h2 style={{ marginTop: "40px", marginBottom: "20px" }}>Personal Subscriptions</h2>
          <p style={{ marginBottom: "16px", lineHeight: 1.6 }}>
            Researchers and professionals can subscribe to individual titles. Members of affiliated societies often receive discounted rates.
          </p>
        </div>
      </section>
    </main>
  );
}
