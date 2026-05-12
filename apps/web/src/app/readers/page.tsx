import type { Metadata } from "next";
import { createPageMetadata } from "../../lib/seo";
import FaqSection from "../../components/FaqSection";

export const metadata: Metadata = createPageMetadata({
  title: "For Readers | STM Journals",
  description: "Reader access information, open access policy notes, and research discovery guidance across STM Journals.",
  path: "/readers",
  keywords: ["readers", "open access", "journal archive", "research access"],
});

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
      <section className="container" style={{ paddingBottom: "40px" }}>
        <FaqSection
          title="Reader FAQs"
          items={[
            {
              question: "Where can I browse all journals?",
              answer:
                "Use the Journals Directory to find active journals and navigate to each journal archive and policy hub.",
            },
            {
              question: "Are all articles open access?",
              answer:
                "The platform supports both open and restricted access, depending on journal and publication policy.",
            },
            {
              question: "How do I access past issues?",
              answer:
                "Open a journal page, go to Archive, then browse by volume and issue to access article listings.",
            },
            {
              question: "Can I cite article metadata directly?",
              answer:
                "Article pages expose citation-oriented metadata and canonical URLs for reliable referencing.",
            },
          ]}
        />
      </section>
    </main>
  );
}
