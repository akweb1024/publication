import type { Metadata } from "next";
import JournalsDirectory from "../components/JournalsDirectory";
import { createPageMetadata } from "../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Publication Platform | Editorial Workspace",
  description: "Scientific, Technical and Medical publishing platform for journal discovery, submission, review, and policy access.",
  path: "/",
  keywords: ["STM journals", "publication platform", "journal discovery", "editorial workflow"],
});

export default async function HomePage() {
  return (
    <main className="main-stack">
      <section className="hero">
        <span className="eyebrow" style={{ color: "#fb923c" }}>STM JOURNALS</span>
        <h1>Scientific, Technical & Medical Publishing.</h1>
        <p>
          The premier platform for managing high-impact journals, submissions, and editorial workflows. Built for precision and scale.
        </p>
        <div className="meta-row">
          <span className="chip">Issue-based publishing</span>
          <span className="chip">Double-blind review</span>
          <span className="chip">Policy versioning</span>
        </div>
      </section>

      <JournalsDirectory />
    </main>
  );
}
