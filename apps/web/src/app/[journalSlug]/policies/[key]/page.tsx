import type { Metadata } from "next";
import { getPolicyLatest, getJournal } from "../../../../lib/api";
import JournalNav from "../../../../components/JournalNav";
import Breadcrumbs from "../../../../components/Breadcrumbs";
import { buildCanonical } from "../../../../lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ journalSlug: string; key: string }>;
}): Promise<Metadata> {
  const { journalSlug, key } = await params;
  try {
    const [policy, journal] = await Promise.all([getPolicyLatest(journalSlug, key), getJournal(journalSlug)]);
    const canonicalPath = `/${journalSlug}/policies/${key}`;
    const description = `${policy.title} policy for ${journal.title}, including versioning and effective date details.`;
    return {
      title: `${policy.title} | ${journal.title} Policy`,
      description,
      alternates: { canonical: buildCanonical(canonicalPath) },
      openGraph: {
        type: "article",
        url: buildCanonical(canonicalPath),
        title: policy.title,
        description,
        siteName: journal.title,
      },
      twitter: {
        card: "summary_large_image",
        title: policy.title,
        description,
      },
    };
  } catch {
    return {
      title: "Policy Not Found",
      description: "The requested policy page could not be found.",
      robots: { index: false, follow: false },
    };
  }
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ journalSlug: string; key: string }>;
}) {
  const { journalSlug, key } = await params;
  const [policy, journal] = await Promise.all([
    getPolicyLatest(journalSlug, key),
    getJournal(journalSlug)
  ]);
  const effectiveDate =
    typeof policy.effectiveFrom === "string" ? new Date(policy.effectiveFrom) : policy.effectiveFrom;

  return (
    <main className="main-stack">
      <JournalNav journalSlug={journalSlug} journalTitle={journal.title} />
      <Breadcrumbs
        items={[
          { label: "Journals", href: "/journals" },
          { label: journal.title, href: `/${journalSlug}` },
          { label: "Policies", href: `/${journalSlug}/policies` },
          { label: policy.title },
        ]}
      />
      <a href={`/${journalSlug}/policies`} className="button button-ghost compact" style={{ width: "fit-content" }}>
        Back to policies
      </a>
      <section className="card">
        <p className="eyebrow">Policy Document</p>
        <h1 style={{ marginTop: 8 }}>{policy.title}</h1>
        <div className="meta-row">
          <span className="chip" style={{ background: "rgba(15, 23, 42, 0.08)", color: "#1f2937" }}>
            Key: {key}
          </span>
          <span className="chip" style={{ background: "rgba(15, 23, 42, 0.08)", color: "#1f2937" }}>
            Version {policy.versionNumber}
          </span>
          <span className="chip" style={{ background: "rgba(15, 23, 42, 0.08)", color: "#1f2937" }}>
            Effective: {effectiveDate.toLocaleDateString()}
          </span>
        </div>
      </section>
      <article className="card" dangerouslySetInnerHTML={{ __html: policy.contentHtml }} />
      <section className="card">
        <h2 style={{ marginBottom: 10 }}>Related Pages</h2>
        <div className="meta-row">
          <a href={`/${journalSlug}`} className="button button-ghost compact">Journal overview</a>
          <a href={`/${journalSlug}/archive`} className="button button-ghost compact">Archive</a>
          <a href={`/${journalSlug}/focus-scope`} className="button button-ghost compact">Focus & Scope</a>
        </div>
      </section>
    </main>
  );
}
