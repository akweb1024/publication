import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import JournalNav from "../../../../components/JournalNav";
import Breadcrumbs from "../../../../components/Breadcrumbs";
import { getJournal } from "../../../../lib/api";

const API_BASE = process.env.API_BASE ?? process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:4000/api/v1";
const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const getArticle = cache(async (journalSlug: string, articleId: string) => {
  const res = await fetch(`${API_BASE}/journals/${encodeURIComponent(journalSlug)}/articles/${encodeURIComponent(articleId)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Article not found");
  return (await res.json()) as {
    id: string;
    title: string;
    abstractText?: string | null;
    keywordsText?: string[];
    contributors?: Array<{ displayName?: string | null }>;
    doi?: string | null;
    publishedAt?: string | null;
    status: string;
    access: string;
    pageStart?: number | null;
    pageEnd?: number | null;
    articleNumber?: string | null;
    issue?: { id: string; number: number; title?: string | null; volume?: { year: number; number: number } } | null;
    publishedAssets?: Array<{ id: string; pdfFileId: string; versionLabel: string }>;
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ journalSlug: string; articleId: string }>;
}): Promise<Metadata> {
  const { journalSlug, articleId } = await params;
  const [journal, article] = await Promise.all([getJournal(journalSlug), getArticle(journalSlug, articleId)]);
  const canonicalUrl = `${SITE_BASE}/${journalSlug}/articles/${articleId}`;
  const description = article.abstractText?.trim() || `Read ${article.title} in ${journal.title}.`;
  const keywordList = article.keywordsText ?? [];
  const pdf = article.publishedAssets?.[0];
  const citationAuthors =
    article.contributors?.map((contributor) => contributor.displayName?.trim()).filter((value): value is string => !!value) ?? [];
  const citationDate = article.publishedAt ? new Date(article.publishedAt).toISOString().slice(0, 10) : undefined;
  const citationPdfUrl = pdf ? `${API_BASE}/files/${encodeURIComponent(pdf.pdfFileId)}/download` : undefined;
  const otherMeta: Record<string, string | number | (string | number)[]> = {
    citation_title: article.title,
    citation_journal_title: journal.title,
    citation_abstract_html_url: canonicalUrl,
    "DC.Title": article.title,
    "DC.Description": description,
    "DC.Identifier": article.doi ? `https://doi.org/${article.doi}` : canonicalUrl,
    "DC.Source": journal.title,
    "DC.Language": "en",
    "DC.Type": "Text",
    "DC.Format": "text/html",
    "DC.Rights": article.access === "OPEN" ? "Open Access" : "Restricted Access",
  };
  if (citationDate) {
    otherMeta.citation_publication_date = citationDate;
    otherMeta["DC.Date"] = citationDate;
  }
  if (article.doi) otherMeta.citation_doi = article.doi;
  if (citationPdfUrl) otherMeta.citation_pdf_url = citationPdfUrl;
  if (journal.issnPrint ?? journal.issnOnline) otherMeta.citation_issn = journal.issnPrint ?? journal.issnOnline ?? "";
  if (article.issue?.volume?.number) otherMeta.citation_volume = String(article.issue.volume.number);
  if (article.issue?.number) otherMeta.citation_issue = String(article.issue.number);
  if (article.pageStart) otherMeta.citation_firstpage = String(article.pageStart);
  if (article.pageEnd) otherMeta.citation_lastpage = String(article.pageEnd);
  if (article.articleNumber) otherMeta.citation_article_number = article.articleNumber;
  if (citationAuthors.length > 0) {
    otherMeta.citation_author = citationAuthors;
    otherMeta["DC.Creator"] = citationAuthors;
  }

  return {
    title: `${article.title} | ${journal.title}`,
    description,
    keywords: keywordList,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: article.title,
      description,
      siteName: journal.title,
      publishedTime: article.publishedAt ?? undefined,
      tags: keywordList,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
    },
    other: otherMeta,
  };
}

export default async function ArticleLandingPage({
  params,
}: {
  params: Promise<{ journalSlug: string; articleId: string }>;
}) {
  const { journalSlug, articleId } = await params;
  const [journal, article] = await Promise.all([getJournal(journalSlug), getArticle(journalSlug, articleId)]);
  const pdf = article.publishedAssets?.[0];
  const canonicalUrl = `${SITE_BASE}/${journalSlug}/articles/${articleId}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    url: canonicalUrl,
    headline: article.title,
    description: article.abstractText ?? undefined,
    abstract: article.abstractText ?? undefined,
    inLanguage: "en",
    datePublished: article.publishedAt ?? undefined,
    dateModified: article.publishedAt ?? undefined,
    author:
      article.contributors?.map((contributor) => ({
        "@type": "Person",
        name: contributor.displayName?.trim() || "Unknown Author",
      })) ?? undefined,
    identifier: article.doi ? [{ "@type": "PropertyValue", propertyID: "DOI", value: article.doi }] : undefined,
    keywords: article.keywordsText?.join(", ") || undefined,
    isAccessibleForFree: article.access === "OPEN",
    license: article.access === "OPEN" ? "https://creativecommons.org/licenses/by/4.0/" : undefined,
    mainEntityOfPage: canonicalUrl,
    isPartOf: article.issue
      ? {
          "@type": "PublicationIssue",
          issueNumber: article.issue.number,
          name: article.issue.title || undefined,
          isPartOf: article.issue.volume
            ? {
                "@type": "PublicationVolume",
                volumeNumber: article.issue.volume.number,
                isPartOf: {
                  "@type": "Periodical",
                  name: journal.title,
                  issn: [journal.issnPrint, journal.issnOnline].filter(Boolean),
                },
              }
            : {
                "@type": "Periodical",
                name: journal.title,
                issn: [journal.issnPrint, journal.issnOnline].filter(Boolean),
              },
        }
      : {
          "@type": "Periodical",
          name: journal.title,
          issn: [journal.issnPrint, journal.issnOnline].filter(Boolean),
        },
    publisher: {
      "@type": "Organization",
      name: "STM Journals",
    },
  };

  return (
    <main className="main-stack">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <JournalNav journalSlug={journalSlug} journalTitle={journal.title} />
      <Breadcrumbs
        items={[
          { label: "Journals", href: "/journals" },
          { label: journal.title, href: `/${journalSlug}` },
          { label: "Archive", href: `/${journalSlug}/archive` },
          ...(article.issue ? [{ label: `Issue ${article.issue.number}`, href: `/${journalSlug}/archive/issues/${article.issue.id}` }] : []),
          { label: "Article" },
        ]}
      />
      <section className="hero">
        <p className="eyebrow" style={{ color: "rgba(234, 244, 255, 0.84)" }}>
          Article
        </p>
        <h1>{article.title}</h1>
        <p>{journal.title}</p>
      </section>



      <a href={`/${journalSlug}/archive`} className="button button-ghost compact" style={{ width: "fit-content" }}>
        Back to archive
      </a>

      <section className="card">
        <div className="meta-row">
          <span className="chip">Status: {article.status}</span>
          <span className="chip">Access: {article.access}</span>
          {article.doi ? <span className="chip">DOI: {article.doi}</span> : null}
        </div>
        {article.issue ? (
          <p className="muted" style={{ marginTop: 8 }}>
            Vol {article.issue.volume?.number ?? "-"} ({article.issue.volume?.year ?? "-"}) • Issue {article.issue.number}
            {article.issue.title ? ` — ${article.issue.title}` : ""}
          </p>
        ) : null}
        {article.abstractText ? (
          <>
            <h2 style={{ marginTop: 12, marginBottom: 6 }}>Abstract</h2>
            <p>{article.abstractText}</p>
          </>
        ) : null}
        {article.keywordsText && article.keywordsText.length > 0 ? (
          <p className="muted" style={{ marginTop: 10 }}>
            Keywords: {article.keywordsText.join(", ")}
          </p>
        ) : null}
        {pdf ? (
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <a
              href={`${API_BASE}/files/${encodeURIComponent(pdf.pdfFileId)}/download`}
              className="button compact"
              target="_blank"
              rel="noreferrer"
            >
              Download PDF
            </a>
            {article.access === "RESTRICTED" ? (
              <p className="muted">
                This PDF is restricted and requires an authenticated account.{" "}
                <Link href="/login" style={{ color: "var(--accent)", fontWeight: 700 }}>
                  Sign in
                </Link>{" "}
                if prompted.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2 style={{ marginBottom: 10 }}>Related Pages</h2>
        <div className="meta-row">
          <Link href={`/${journalSlug}`} className="button button-ghost compact">Journal overview</Link>
          <Link href={`/${journalSlug}/policies`} className="button button-ghost compact">Journal policies</Link>
          <Link href={`/${journalSlug}/editorial-board`} className="button button-ghost compact">Editorial board</Link>
        </div>
      </section>
    </main>
  );
}
