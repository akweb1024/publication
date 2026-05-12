import type { Metadata } from "next";
import { createPageMetadata } from "../../lib/seo";
import FaqSection from "../../components/FaqSection";

export const metadata: Metadata = createPageMetadata({
  title: "For Subscribers | STM Journals",
  description: "Institutional and personal subscription information, licensing options, and access methods for STM Journals.",
  path: "/subscribers",
  keywords: ["subscribers", "institutional access", "journal subscription", "licensing"],
});

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
      <section className="container" style={{ paddingBottom: "40px" }}>
        <FaqSection
          title="Subscriber FAQs"
          items={[
            {
              question: "Do you offer institutional subscriptions?",
              answer:
                "Yes. Institutional access models are available and can be configured with common access control options.",
            },
            {
              question: "Can individuals subscribe to specific journals?",
              answer:
                "Yes. Personal subscriptions can be configured per title based on portfolio and policy setup.",
            },
            {
              question: "How is subscriber access enforced?",
              answer:
                "Access controls are handled through role-based platform permissions and publication access settings.",
            },
            {
              question: "Where are licensing and terms documented?",
              answer:
                "Licensing and access policy details are available in policy pages and subscriber-facing information sections.",
            },
          ]}
        />
      </section>
    </main>
  );
}
