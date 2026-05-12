import type { Metadata } from "next";
import Link from "next/link";
import { createPageMetadata } from "../../lib/seo";
import FaqSection from "../../components/FaqSection";

export const metadata: Metadata = createPageMetadata({
  title: "For Authors | STM Journals",
  description: "Author submission guidelines, manuscript preparation rules, and editorial workflow details for STM Journals.",
  path: "/authors",
  keywords: ["authors", "manuscript submission", "journal guidelines", "peer review"],
});

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
            Our streamlined editorial workspace makes submission simple. Authors can track their manuscript{"'"}s status in real-time and communicate directly with the editorial team.
          </p>
          
          <h2 style={{ marginTop: "40px", marginBottom: "20px" }}>Manuscript Preparation</h2>
          <ul style={{ listStyleType: "disc", paddingLeft: "20px", lineHeight: 1.6 }}>
            <li style={{ marginBottom: "8px" }}>Ensure your manuscript meets the scope of the target journal.</li>
            <li style={{ marginBottom: "8px" }}>Follow the formatting guidelines detailed in the specific journal{"'"}s policy library.</li>
            <li style={{ marginBottom: "8px" }}>Include all necessary conflict of interest and funding declarations.</li>
          </ul>

          <div style={{ marginTop: "40px", textAlign: "center" }}>
            <Link href="/login" className="button button-primary">Submit a Manuscript</Link>
          </div>
        </div>
      </section>
      <section className="container" style={{ paddingBottom: "40px" }}>
        <FaqSection
          title="Author FAQs"
          items={[
            {
              question: "How do I submit a manuscript?",
              answer:
                "Create an account, sign in, then use the dashboard submission workflow to upload your manuscript and metadata.",
            },
            {
              question: "What review model is used?",
              answer:
                "Most STM Journals workflows run double-blind review. Journal-specific rules are available in each journal policy page.",
            },
            {
              question: "Where can I check policy requirements?",
              answer:
                "Open the target journal page and visit its Policies section for current formatting, ethics, and declaration requirements.",
            },
            {
              question: "Can I track submission status?",
              answer:
                "Yes. After submission, status updates are visible in your author dashboard and timeline views.",
            },
          ]}
        />
      </section>
    </main>
  );
}
