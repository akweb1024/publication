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

export default async function ArchivePage({
  params,
  searchParams,
}: {
  params: Promise<{ journalSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { journalSlug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
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
  const query = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q.trim().toLowerCase() : "";
  const selectedYear = typeof resolvedSearchParams.year === "string" ? Number(resolvedSearchParams.year) : NaN;
  const selectedVolumeNumber = typeof resolvedSearchParams.volume === "string" ? Number(resolvedSearchParams.volume) : NaN;
  const selectedStatus = typeof resolvedSearchParams.status === "string" ? resolvedSearchParams.status : "published";
  const sort = typeof resolvedSearchParams.sort === "string" ? resolvedSearchParams.sort : "latest";
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
      <section className="compact-hero">
        <p className="section-label">Publication Archive</p>
        <h2>Volumes & Issues</h2>
        <p>Browse published issues and article metadata by year, volume, and issue.</p>
      </section>

      <section className="archive-two-col">
        <aside className="content-card archive-filters">
          <h3>Search & Filter</h3>
          <form action={`/${journalSlug}/archive`} method="GET">
            <div className="field">
              <label htmlFor="archive-search">Keyword</label>
              <input id="archive-search" name="q" className="input" placeholder="Search by title, DOI, issue..." />
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="archive-year">Year</label>
              <select id="archive-year" name="year" className="select" defaultValue={Number.isNaN(selectedYear) ? "" : String(selectedYear)}>
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
              <select
                id="archive-volume"
                name="volume"
                className="select"
                defaultValue={Number.isNaN(selectedVolumeNumber) ? "" : String(selectedVolumeNumber)}
              >
                <option value="">All volumes</option>
                {yearsDesc.map((year) => (
                  <option key={year} value={volumeNumberByYear.get(year)}>
                    Volume {volumeNumberByYear.get(year)} ({year})
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="archive-status">Issue status</label>
              <select id="archive-status" name="status" className="select" defaultValue={selectedStatus}>
                <option value="published">Published only</option>
                <option value="all">All statuses</option>
              </select>
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="archive-sort">Sort by</label>
              <select id="archive-sort" name="sort" className="select" defaultValue={sort}>
                <option value="latest">Latest first</option>
                <option value="oldest">Oldest first</option>
                <option value="most-articles">Most articles</option>
              </select>
            </div>
            <button type="submit" className="button button-primary" style={{ width: "100%", marginTop: "16px" }}>
              Search
            </button>
            <a href={`/${journalSlug}/archive`} className="button button-ghost compact" style={{ width: "100%", marginTop: "8px" }}>
              Reset Filters
            </a>
          </form>
        </aside>

        <div className="archive-main">
          {yearsDesc.length === 0 ? (
            <section className="content-card">
              <p className="muted">No volumes available yet.</p>
            </section>
          ) : (
            <div className="archive-grid">
              {yearsDesc
                .map((year) => {
                const volumeIssues = issues
                  .filter((issue) => {
                    const matchesYear = yearByVolumeId.get(issue.volumeId) === year;
                    const volumeNumber = volumeNumberByYear.get(year);
                    const matchesVolume = Number.isNaN(selectedVolumeNumber) || selectedVolumeNumber === volumeNumber;
                    const matchesStatus = selectedStatus === "all" || issue.status === "PUBLISHED";
                    const matchesQuery = !query || [issue.title, `issue ${issue.number}`, issue.publicationDate].filter(Boolean).join(" ").toLowerCase().includes(query);
                    return matchesYear && matchesVolume && matchesStatus && matchesQuery;
                  })
                  .sort((left, right) => {
                    if (sort === "oldest") return left.number - right.number;
                    return right.number - left.number;
                  });
                const volumeArticleCount = volumeIssues.reduce(
                  (total, issue) => total + (articlesByIssueId.get(issue.id)?.length ?? 0),
                  0
                );
                if (!Number.isNaN(selectedYear) && selectedYear !== year) return null;
                if (query && volumeIssues.length === 0) return null;
                return (
                  <article key={year} className="content-card archive-volume-tabular">
                    <div className="archive-volume-header">
                      <div>
                        <p className="metadata-text">Volume {volumeNumberByYear.get(year)}</p>
                        <h3>{year}</h3>
                      </div>
                      <div className="volume-stat-stack">
                        <span>{volumeIssues.length} Issue(s)</span>
                        <span>{volumeArticleCount} Article(s)</span>
                        <span className="metadata-pill">Published</span>
                      </div>
                    </div>
                    {volumeIssues.length === 0 ? (
                      <div className="archive-issues-empty">No published issues in this volume yet.</div>
                    ) : (
                      <div className="archive-issue-list">
                        {volumeIssues.map((issue) => (
                          <Link key={issue.id} href={`/${journalSlug}/archive/issues/${issue.id}`} className="issue-row">
                            <span className="issue-row-title">Issue {issue.number}</span>
                            <span className="issue-row-meta">
                              {issue.publicationDate ? new Date(issue.publicationDate).toLocaleDateString() : "Date TBA"} •{" "}
                              {articlesByIssueId.get(issue.id)?.length ?? 0} Articles
                            </span>
                            <span className="issue-row-action">View Issue</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })
                .filter(Boolean)}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
