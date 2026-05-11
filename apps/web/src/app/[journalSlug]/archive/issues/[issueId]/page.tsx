import Link from "next/link";
import JournalNav from "../../../../../components/JournalNav";
import { getJournal, listIssueArticles, listIssues, listVolumes } from "../../../../../lib/api";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ journalSlug: string; issueId: string }>;
}) {
  const { journalSlug, issueId } = await params;
  const journal = await getJournal(journalSlug);
  const [volumes, issues] = await Promise.all([listVolumes(journalSlug), listIssues(journalSlug)]);
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
