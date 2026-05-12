import type { Metadata } from "next";
import Link from "next/link";
import { createPageMetadata } from "../../lib/seo";
import FaqSection from "../../components/FaqSection";

export const metadata: Metadata = createPageMetadata({
  title: "For Editors | STM Journals",
  description: "Editorial responsibilities, review workflow, and publication operations guidance for STM Journals editors.",
  path: "/editors",
  keywords: ["editors", "editorial workflow", "review management", "publishing operations"],
});

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
            <Link href="/login" className="button button-primary">Access Editorial Workspace</Link>
          </div>
        </div>
      </section>
      <section className="container" style={{ paddingBottom: "40px" }}>
        <FaqSection
          title="Editor FAQs"
          items={[
            {
              question: "How do editors manage reviewer assignment?",
              answer:
                "Editors use the dashboard queues to triage submissions, assign reviewers, and monitor review progress.",
            },
            {
              question: "Where are policy versions maintained?",
              answer:
                "Journal policy pages are version-aware and should be used as the source of truth for editorial governance.",
            },
            {
              question: "Can editors view audit information?",
              answer:
                "Users with audit permissions can access dashboard audit pages to review decision and workflow actions.",
            },
            {
              question: "How is production handoff handled?",
              answer:
                "Editorial decisions and metadata flow into publishing workflows via the platform dashboard modules.",
            },
          ]}
        />
      </section>
    </main>
  );
}
