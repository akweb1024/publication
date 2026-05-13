import type { Metadata } from "next";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "About | STM Journals",
  description: "Learn more about STM Journals, our mission, editorial principles, and publishing standards.",
  path: "/about",
  keywords: ["STM journals", "about", "publishing mission", "editorial standards"],
});

export default function AboutPage() {
  return (
    <main className="main-stack">
      <section className="compact-hero">
        <p className="section-label">About STM Journals</p>
        <h2>Scientific, Technical, and Medical Publishing Platform</h2>
        <p>Building a trusted and accessible scholarly publishing ecosystem for global research communities.</p>
      </section>

      <section className="stats-grid">
        <article className="content-card">
          <p className="metadata-text">Journals</p>
          <h3>25+</h3>
        </article>
        <article className="content-card">
          <p className="metadata-text">Subject Areas</p>
          <h3>12</h3>
        </article>
        <article className="content-card">
          <p className="metadata-text">Published Articles</p>
          <h3>1,200+</h3>
        </article>
        <article className="content-card">
          <p className="metadata-text">Editorial Experts</p>
          <h3>300+</h3>
        </article>
      </section>

      <section className="two-col">
        <article className="content-card mission-card">
          <h3>Mission</h3>
          <p>
            At STM Journals, our mission is to accelerate scientific discovery and medical advancement by providing a
            high-quality, peer-reviewed publishing platform with transparent editorial governance.
          </p>
          <p>
            We uphold rigorous review standards, support open dissemination of research, and ensure scholarly integrity
            at every publication stage.
          </p>
        </article>
        <article className="content-card">
          <h3>What We Do</h3>
          <ul className="readable-list">
            <li>Publish high-impact research across scientific, technical, and medical domains.</li>
            <li>Provide a modern editorial workflow for authors, reviewers, and editors.</li>
            <li>Align operations with global publishing ethics and misconduct safeguards.</li>
            <li>Enable open-access dissemination for stronger societal and academic impact.</li>
          </ul>
        </article>
      </section>

      <section className="three-col">
        <article className="content-card">
          <h3>Publishing Ethics</h3>
          <p>Policy-driven editorial workflows for authorship, conflicts of interest, and misconduct handling.</p>
        </article>
        <article className="content-card">
          <h3>Open Access & Peer Review</h3>
          <p>Transparent publication pathways with peer review rigor and sustainable global access.</p>
        </article>
        <article className="content-card">
          <h3>Our Subject Areas</h3>
          <p>Interdisciplinary journals spanning sustainability, clinical sciences, engineering, and applied research.</p>
        </article>
      </section>

      <section className="content-card">
        <h3>Contact & Support</h3>
        <p className="muted">For institutional partnerships, submission support, and journal onboarding, contact our editorial support team.</p>
        <div className="cta-actions">
          <a href="/journals" className="button button-primary compact">Browse Journals</a>
          <a href="/policies" className="button button-ghost compact">Policies & Ethics</a>
        </div>
      </section>
    </main>
  );
}
