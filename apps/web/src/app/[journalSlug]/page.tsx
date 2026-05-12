import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getJournal, listPolicies } from "../../lib/api";
import JournalNav from "../../components/JournalNav";
import Breadcrumbs from "../../components/Breadcrumbs";

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const getPolicies = cache(async (journalSlug: string) => listPolicies(journalSlug));

export async function generateMetadata({ params }: { params: Promise<{ journalSlug: string }> }): Promise<Metadata> {
  const { journalSlug } = await params;
  let journal: Awaited<ReturnType<typeof getJournal>>;
  try {
    journal = await getJournal(journalSlug);
  } catch {
    return {
      title: "Journal Not Found",
      description: "The requested journal could not be found.",
      robots: { index: false, follow: false },
    };
  }
  const description = journal.description?.trim() || `Explore ${journal.title}: profile, policies, archive, and editorial context.`;
  const canonicalUrl = `${SITE_BASE}/${journalSlug}`;
  return {
    title: `${journal.title} | Journal`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "website",
      url: canonicalUrl,
      title: journal.title,
      description,
      siteName: journal.title,
    },
    twitter: {
      card: "summary",
      title: journal.title,
      description,
    },
  };
}

export default async function JournalPage({ params }: { params: Promise<{ journalSlug: string }> }) {
  const { journalSlug } = await params;
  let journal: Awaited<ReturnType<typeof getJournal>>;
  try {
    journal = await getJournal(journalSlug);
  } catch {
    notFound();
  }
  const policies = await getPolicies(journalSlug);
  const canonicalUrl = `${SITE_BASE}/${journalSlug}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Periodical",
    name: journal.title,
    description: journal.description ?? undefined,
    url: canonicalUrl,
    issn: [journal.issnPrint, journal.issnOnline].filter(Boolean),
    inLanguage: "en",
    publisher: {
      "@type": "Organization",
      name: "STM Journals",
      url: SITE_BASE,
    },
    potentialAction: {
      "@type": "ViewAction",
      target: `${canonicalUrl}/archive`,
      name: "Browse journal archive",
    },
    publishingPrinciples: `${canonicalUrl}/policies`,
    sameAs: [`${canonicalUrl}/archive`, `${canonicalUrl}/editorial-board`, `${canonicalUrl}/focus-scope`],
  };
  return (
    <main className="main-stack">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <JournalNav journalSlug={journalSlug} journalTitle={journal.title} />
      <Breadcrumbs
        items={[
          { label: "Journals", href: "/journals" },
          { label: journal.title },
        ]}
      />
      <section className="hero">
        <span className="eyebrow" style={{ color: "#fb923c" }}>STM Journal Profile</span>
        <h1>{journal.title}</h1>
        <p style={{ fontSize: "1.2rem", maxWidth: "800px" }}>
          {journal.description ?? "Journal scope description will appear here once configured."}
        </p>
        <div className="meta-row">
          <span className="chip">Review: {journal.reviewModel ?? "DOUBLE_BLIND"}</span>
          <span className="chip">Region: {journal.timezone}</span>
          <span className="chip">ID: {journal.slug}</span>
        </div>
      </section>

      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "20px" }}>
        <Link href="/" className="button button-ghost compact">
          &larr; Back to all journals
        </Link>
      </div>

      <div className="card">
        <span className="eyebrow">Governance</span>
        <h2 style={{ fontSize: "2rem", marginBottom: "12px" }}>Policy Library</h2>
        <p style={{ color: "var(--ink-600)", marginBottom: "32px", fontSize: "1.05rem" }}>
          Explore our version-aware editorial policies, guidelines, and governance frameworks.
        </p>
        <div style={{ display: "grid", gap: "16px" }}>
          {policies.map((p) => (
            <Link key={p.key} href={`/${journalSlug}/policies/${p.key}`} className="card clickable-card" style={{ padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexDirection: "row" }}>
              <div>
                <span className="eyebrow" style={{ fontSize: "0.65rem", marginBottom: "4px" }}>{p.key}</span>
                <h4 className="clickable-title" style={{ fontSize: "1.2rem", margin: 0 }}>{p.title}</h4>
              </div>
              <span className="clickable-title" style={{ fontSize: "1.5rem", marginLeft: "16px" }} aria-hidden="true">&rarr;</span>
            </Link>
          ))}
          {policies.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px", border: "2px dashed var(--line)", borderRadius: "16px" }}>
              <p className="muted">No policies have been published for this journal yet.</p>
            </div>
          )}
        </div>
      </div>

      <section className="card">
        <h2 style={{ marginBottom: 10 }}>Related Pages</h2>
        <div className="meta-row">
          <Link href={`/${journalSlug}/archive`} className="button button-ghost compact">Archive</Link>
          <Link href={`/${journalSlug}/focus-scope`} className="button button-ghost compact">Focus & Scope</Link>
          <Link href={`/${journalSlug}/editorial-board`} className="button button-ghost compact">Editorial Board</Link>
        </div>
      </section>
    </main>
  );
}
