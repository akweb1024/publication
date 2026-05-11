import Link from "next/link";
import type { Metadata } from "next";
import { cache } from "react";
import JournalNav from "../../../components/JournalNav";
import { getJournal, listIssueArticles, listIssues, listVolumes } from "../../../lib/api";

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const getVolumes = cache(async (journalSlug: string) => listVolumes(journalSlug));
const getIssues = cache(async (journalSlug: string) => listIssues(journalSlug));

export async function generateMetadata({ params }: { params: Promise<{ journalSlug: string }> }): Promise<Metadata> {
  const { journalSlug } = await params;
  const journal = await getJournal(journalSlug);
  const canonicalUrl = `${SITE_BASE}/${journalSlug}/archive`;
  const description = `Browse ${journal.title} archives by volume, issue, publication date, and article links.`;
  return {
    title: `${journal.title} Archive | Volumes & Issues`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "website",
      url: canonicalUrl,
      title: `${journal.title} Archive`,
      description,
      siteName: journal.title,
    },
    twitter: {
      card: "summary",
      title: `${journal.title} Archive`,
      description,
    },
  };
}

export default async function ArchivePage({ params }: { params: Promise<{ journalSlug: string }> }) {
  const { journalSlug } = await params;
  const journal = await getJournal(journalSlug);
  const [volumes, issues] = await Promise.all([getVolumes(journalSlug), getIssues(journalSlug)]);
  const publishedIssues = issues.filter((issue) => issue.status === "PUBLISHED");

  const issueArticlePairs = await Promise.all(
    publishedIssues.map(async (issue) => ({
      issue,
      articles: await listIssueArticles(journalSlug, issue.id),
    }))
  );
  const canonicalUrl = `${SITE_BASE}/${journalSlug}/archive`;
  const articlesByIssueId = new Map(issueArticlePairs.map((pair) => [pair.issue.id, pair.articles]));
  const yearsAsc = [...new Set(volumes.map((volume) => volume.year))].sort((left, right) => left - right);
  const volumeNumberByYear = new Map(yearsAsc.map((year, index) => [year, index + 1]));
  const yearsDesc = [...yearsAsc].sort((left, right) => right - left);
  const yearByVolumeId = new Map(volumes.map((volume) => [volume.id, volume.year]));
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${journal.title} Archive`,
    description: `Published volumes and issues for ${journal.title}.`,
    url: canonicalUrl,
    isPartOf: {
      "@type": "Periodical",
      name: journal.title,
      url: `${SITE_BASE}/${journalSlug}`,
    },
    hasPart: publishedIssues.map((issue) => ({
      "@type": "PublicationIssue",
      issueNumber: issue.number,
      name: issue.title || undefined,
      datePublished: issue.publicationDate || undefined,
      url: `${canonicalUrl}#issue-${issue.id}`,
    })),
  };

  return (
    <main className="main-stack">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <JournalNav journalSlug={journalSlug} journalTitle={journal.title} />
      <section className="hero">
        <p className="eyebrow" style={{ color: "rgba(234, 244, 255, 0.84)" }}>
          Archive
        </p>
        <h1>{journal.title} — Volumes & Issues</h1>
        <p>Browse published issues and article metadata by year, volume, and issue.</p>
      </section>

      <section className="archive-two-col">
        <aside className="card archive-filters">
          <h2 style={{ marginBottom: 10 }}>Search Archive</h2>
          <form action={`/${journalSlug}/archive`} method="GET">
            <div className="field">
              <label htmlFor="archive-search">Keyword</label>
              <input id="archive-search" name="q" className="input" placeholder="Search by title, DOI, issue..." />
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="archive-year">Year</label>
              <select id="archive-year" name="year" className="select">
                <option value="">All years</option>
                {[...new Set(volumes.map((volume) => volume.year))]
                  .sort((left, right) => right - left)
                  .map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
              </select>
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="archive-volume">Volume</label>
              <select id="archive-volume" name="volume" className="select">
                <option value="">All volumes</option>
                {yearsDesc.map((year) => (
                  <option key={year} value={volumeNumberByYear.get(year)}>
                    Volume {volumeNumberByYear.get(year)} ({year})
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="button button-primary" style={{ width: "100%", marginTop: "20px" }}>
              Search
            </button>
          </form>
          <p className="muted" style={{ marginTop: 16 }}>
            Tip: use quick links on the right to drill down by volume and issue.
          </p>
        </aside>

        <div className="archive-main">
          {yearsDesc.length === 0 ? (
            <section className="card">
              <p className="muted">No volumes available yet.</p>
            </section>
          ) : (
            <div className="archive-grid">
              {yearsDesc.map((year) => {
                const volumeIssues = issues
                  .filter((issue) => yearByVolumeId.get(issue.volumeId) === year && issue.status === "PUBLISHED")
                  .sort((left, right) => right.number - left.number);
                const volumeArticleCount = volumeIssues.reduce(
                  (total, issue) => total + (articlesByIssueId.get(issue.id)?.length ?? 0),
                  0
                );
                return (
                  <div key={year} className="card archive-volume-tabular">
                    <div className="archive-volume-header">
                      <strong>Volume {volumeNumberByYear.get(year)} ({year})</strong>
                      <span> : {volumeArticleCount} Articles</span>
                    </div>
                    
                    {volumeIssues.length === 0 ? (
                      <div className="archive-issues-empty">No published issues in this volume yet.</div>
                    ) : (
                      <div className="archive-issues-grid">
                        {volumeIssues.map((issue) => (
                          <Link 
                            key={issue.id} 
                            href={`/${journalSlug}/archive/issues/${issue.id}`} 
                            className="archive-issue-cell"
                          >
                            <span className="archive-issue-title">
                              Issue {issue.number} <span aria-hidden="true">&rarr;</span>
                            </span>
                            <span className="archive-issue-meta">
                              {articlesByIssueId.get(issue.id)?.length ?? 0} Articles
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
