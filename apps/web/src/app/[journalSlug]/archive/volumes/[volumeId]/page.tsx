import Link from "next/link";
import type { Metadata } from "next";
import JournalNav from "../../../../../components/JournalNav";
import Breadcrumbs from "../../../../../components/Breadcrumbs";
import { getJournal, listIssueArticles, listIssues, listVolumes } from "../../../../../lib/api";
import { buildCanonical } from "../../../../../lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ journalSlug: string; volumeId: string }>;
}): Promise<Metadata> {
  const { journalSlug, volumeId } = await params;
  const [journal, volumes] = await Promise.all([getJournal(journalSlug), listVolumes(journalSlug)]);
  const volume = volumes.find((item) => item.id === volumeId);
  if (!volume) {
    return {
      title: `Volume Not Found | ${journal.title}`,
      description: `Requested volume could not be found in ${journal.title}.`,
      robots: { index: false, follow: false },
    };
  }

  const canonicalPath = `/${journalSlug}/archive/volumes/${volume.id}`;
  const description = `Browse Volume ${volume.number} (${volume.year}) in ${journal.title}, including issue and article access.`;
  return {
    title: `${journal.title} Volume ${volume.number} (${volume.year})`,
    description,
    alternates: { canonical: buildCanonical(canonicalPath) },
    openGraph: {
      type: "website",
      url: buildCanonical(canonicalPath),
      title: `${journal.title} Volume ${volume.number}`,
      description,
      siteName: journal.title,
    },
    twitter: {
      card: "summary_large_image",
      title: `${journal.title} Volume ${volume.number}`,
      description,
    },
  };
}

export default async function VolumeDetailPage({
  params,
}: {
  params: Promise<{ journalSlug: string; volumeId: string }>;
}) {
  const { journalSlug, volumeId } = await params;
  const journal = await getJournal(journalSlug);
  const [volumes, issues] = await Promise.all([listVolumes(journalSlug), listIssues(journalSlug)]);
  const volume = volumes.find((item) => item.id === volumeId);

  if (!volume) {
    return (
      <main className="main-stack">
        <section className="card">
          <h1>Volume not found</h1>
          <p className="muted">This volume does not exist for the selected journal.</p>
          <a href={`/${journalSlug}/archive`} className="button button-ghost compact" style={{ width: "fit-content", marginTop: 10 }}>
            Back to archive
          </a>
        </section>
      </main>
    );
  }

  const volumeIssues = issues.filter((item) => item.volumeId === volume.id);
  const issueArticlePairs = await Promise.all(
    volumeIssues.map(async (issue) => ({
      issue,
      articles: await listIssueArticles(journalSlug, issue.id),
    }))
  );

  return (
    <main className="main-stack">
      <JournalNav journalSlug={journalSlug} journalTitle={journal.title} />
      <Breadcrumbs
        items={[
          { label: "Journals", href: "/journals" },
          { label: journal.title, href: `/${journalSlug}` },
          { label: "Archive", href: `/${journalSlug}/archive` },
          { label: `Volume ${volume.number}` },
        ]}
      />
      <section className="hero">
        <p className="eyebrow" style={{ color: "rgba(234, 244, 255, 0.84)" }}>
          Volume
        </p>
        <h1>
          {journal.title} — Volume {volume.number} ({volume.year})
        </h1>
        <p>Explore issues and articles published under this volume.</p>
      </section>



      <a href={`/${journalSlug}/archive`} className="button button-ghost compact" style={{ width: "fit-content" }}>
        Back to archive
      </a>

      <section className="card">
        <h2 style={{ marginBottom: 8 }}>Issues in this volume</h2>
        {issueArticlePairs.length === 0 ? (
          <p className="muted">No issues are available under this volume yet.</p>
        ) : (
          <div className="list" style={{ display: "flex", flexDirection: "column" }}>
            {issueArticlePairs.map(({ issue, articles }) => (
              <Link key={issue.id} href={`/${journalSlug}/archive/issues/${issue.id}`} className="clickable-list-item">
                <span className="clickable-title" style={{ fontSize: "1.1rem" }}>
                  Issue {issue.number}
                  {issue.title ? ` — ${issue.title}` : ""} <span aria-hidden="true">&rarr;</span>
                </span>
                <span className="muted" style={{ fontSize: "0.9rem", marginTop: "4px" }}>
                  {issue.publicationDate
                    ? `Published ${new Date(issue.publicationDate).toLocaleDateString()}`
                    : "Publication date TBA"} • {articles.length} article(s)
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
