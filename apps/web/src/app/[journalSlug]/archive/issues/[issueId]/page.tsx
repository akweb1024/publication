import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JournalNav from "../../../../../components/JournalNav";
import Breadcrumbs from "../../../../../components/Breadcrumbs";
import { getJournal, listIssueArticles, listIssues, listVolumes } from "../../../../../lib/api";
import { buildCanonical } from "../../../../../lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ journalSlug: string; issueId: string }>;
}): Promise<Metadata> {
  const { journalSlug, issueId } = await params;
  let journal: Awaited<ReturnType<typeof getJournal>>;
  let issues: Awaited<ReturnType<typeof listIssues>>;
  let volumes: Awaited<ReturnType<typeof listVolumes>>;
  try {
    [journal, issues, volumes] = await Promise.all([
      getJournal(journalSlug),
      listIssues(journalSlug),
      listVolumes(journalSlug),
    ]);
  } catch {
    return {
      title: "Issue Not Found",
      description: "The requested issue or journal could not be found.",
      robots: { index: false, follow: false },
    };
  }
  const issue = issues.find((item) => item.id === issueId);
  if (!issue) {
    return {
      title: `Issue Not Found | ${journal.title}`,
      description: `Requested issue could not be found in ${journal.title}.`,
      robots: { index: false, follow: false },
    };
  }
  const volume = volumes.find((item) => item.id === issue.volumeId);
  const canonicalPath = `/${journalSlug}/archive/issues/${issue.id}`;
  const description = `${journal.title} Issue ${issue.number}${volume ? ` in Volume ${volume.number} (${volume.year})` : ""}.`;
  return {
    title: `${journal.title} Issue ${issue.number}${issue.title ? ` | ${issue.title}` : ""}`,
    description,
    alternates: { canonical: buildCanonical(canonicalPath) },
    openGraph: {
      type: "website",
      url: buildCanonical(canonicalPath),
      title: `${journal.title} Issue ${issue.number}`,
      description,
      siteName: journal.title,
    },
    twitter: {
      card: "summary_large_image",
      title: `${journal.title} Issue ${issue.number}`,
      description,
    },
  };
}

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ journalSlug: string; issueId: string }>;
}) {
  const { journalSlug, issueId } = await params;
  let journal: Awaited<ReturnType<typeof getJournal>>;
  let volumes: Awaited<ReturnType<typeof listVolumes>>;
  let issues: Awaited<ReturnType<typeof listIssues>>;
  try {
    journal = await getJournal(journalSlug);
    [volumes, issues] = await Promise.all([listVolumes(journalSlug), listIssues(journalSlug)]);
  } catch {
    notFound();
  }
  const issue = issues.find((item) => item.id === issueId);

  if (!issue) {
    return (
      <main className="main-stack">
        <section className="card">
          <h1>Issue not found</h1>
          <p className="muted">This issue does not exist for the selected journal.</p>
          <a href={`/${journalSlug}/archive`} className="button button-ghost compact" style={{ width: "fit-content", marginTop: 10 }}>
            Back to archive
          </a>
        </section>
      </main>
    );
  }

  const volume = volumes.find((item) => item.id === issue.volumeId);
  const articles = await listIssueArticles(journalSlug, issue.id);

  return (
    <main className="main-stack">
      <JournalNav journalSlug={journalSlug} journalTitle={journal.title} />
      <Breadcrumbs
        items={[
          { label: "Journals", href: "/journals" },
          { label: journal.title, href: `/${journalSlug}` },
          { label: "Archive", href: `/${journalSlug}/archive` },
          ...(volume ? [{ label: `Volume ${volume.number}`, href: `/${journalSlug}/archive/volumes/${volume.id}` }] : []),
          { label: `Issue ${issue.number}` },
        ]}
      />
      <section className="hero">
        <p className="eyebrow" style={{ color: "rgba(234, 244, 255, 0.84)" }}>
          Issue
        </p>
        <h1>
          {journal.title} — Issue {issue.number}
          {issue.title ? `: ${issue.title}` : ""}
        </h1>
        <p>
          {volume ? `Volume ${volume.number} (${volume.year})` : "Volume information unavailable"}
          {issue.publicationDate ? ` • Published ${new Date(issue.publicationDate).toLocaleDateString()}` : ""}
        </p>
      </section>



      <div className="meta-row">
        <a href={`/${journalSlug}/archive`} className="button button-ghost compact">
          Back to archive
        </a>
        {volume ? (
          <a href={`/${journalSlug}/archive/volumes/${volume.id}`} className="button button-ghost compact">
            Back to volume
          </a>
        ) : null}
      </div>

      <section className="card">
        <h2 style={{ marginBottom: 8 }}>Articles in this issue</h2>
        {articles.length === 0 ? (
          <p className="muted">No articles indexed for this issue yet.</p>
        ) : (
          <div className="list" style={{ display: "flex", flexDirection: "column" }}>
            {articles.map((article) => (
              <Link key={article.id} href={`/${journalSlug}/articles/${article.id}`} className="clickable-list-item">
                <span className="clickable-title" style={{ fontSize: "1.1rem" }}>
                  {article.title} <span aria-hidden="true">&rarr;</span>
                </span>
                <span className="muted" style={{ fontSize: "0.9rem", marginTop: "4px" }}>
                  {article.doi ? `DOI: ${article.doi}` : "DOI pending"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
