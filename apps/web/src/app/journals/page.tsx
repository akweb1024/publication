import type { Metadata } from "next";
import JournalsDirectory from "../../components/JournalsDirectory";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Journals Directory | STM Journals",
  description: "Browse all active STM journals, archive pages, editorial scope, and policy hubs in one searchable directory.",
  path: "/journals",
  keywords: ["journals directory", "STM journals", "scientific journals", "archive and policies"],
});

export default async function JournalsPage() {
  return (
    <main className="main-stack">
      <section className="hero">
        <span className="eyebrow" style={{ color: "#fb923c" }}>Directory</span>
        <h1>Journals Directory</h1>
        <p>Discover active journals and jump directly to archive, policy, and scope pages.</p>
      </section>
      <JournalsDirectory />
    </main>
  );
}
