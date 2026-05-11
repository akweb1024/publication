"use client";

import { useEffect, useState } from "react";
import { apiJson } from "../../../lib/clientApi";
import ErrorAlert from "../../../components/ErrorAlert";

type Journal = { id: string; slug: string; title: string };
type Volume = { id: string; year: number; number: number };
type Issue = { id: string; volumeId: string; number: number; title?: string | null; status: string; publicationDate?: string | null };
type Article = { id: string; title: string; status: string; issueId?: string | null; publishedAt?: string | null; submission?: { trackingNumber?: string | null } };

export default function PublishingDashboardPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [journalSlug, setJournalSlug] = useState("");
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [volumeYear, setVolumeYear] = useState(String(new Date().getFullYear()));
  const [volumeNumber, setVolumeNumber] = useState("1");
  const [issueVolumeId, setIssueVolumeId] = useState("");
  const [issueNumber, setIssueNumber] = useState("1");
  const [issueTitle, setIssueTitle] = useState("");
  const [assignIssueByArticle, setAssignIssueByArticle] = useState<Record<string, string>>({});
  const [pdfFileIdByArticle, setPdfFileIdByArticle] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const parsedVolumeYear = Number(volumeYear);
  const yearAlreadyExists = Number.isFinite(parsedVolumeYear) && volumes.some((volume) => volume.year === parsedVolumeYear);
  const suggestedNextYear =
    volumes.length > 0 ? String(Math.max(...volumes.map((volume) => volume.year)) + 1) : String(new Date().getFullYear());

  async function loadPublishingData(slug: string) {
    const [volumeRes, issueRes, articleRes] = await Promise.all([
      apiJson<{ items: Volume[] }>(`/journals/${encodeURIComponent(slug)}/volumes`, { method: "GET" }),
      apiJson<{ items: Issue[] }>(`/journals/${encodeURIComponent(slug)}/issues`, { method: "GET" }),
      apiJson<{ items: Article[] }>(`/journals/${encodeURIComponent(slug)}/articles?status=IN_PRESS`, { method: "GET" }),
    ]);
    setVolumes(volumeRes.items);
    setIssues(issueRes.items);
    setArticles(articleRes.items);
    if (!issueVolumeId && volumeRes.items[0]?.id) setIssueVolumeId(volumeRes.items[0].id);
  }

  useEffect(() => {
    let mounted = true;
    async function boot() {
      setLoading(true);
      setError(null);
      try {
        await apiJson("/auth/session", { method: "GET" });
        const journalsRes = await apiJson<{ items: Journal[] }>("/journals", { method: "GET" });
        if (!mounted) return;
        setJournals(journalsRes.items);
        const first = journalsRes.items[0]?.slug ?? "";
        setJournalSlug(first);
        if (first) await loadPublishingData(first);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load publishing dashboard");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!journalSlug) return;
    loadPublishingData(journalSlug).catch((err: any) => setError(err?.message ?? "Failed to refresh publishing data"));
  }, [journalSlug]);

  useEffect(() => {
    if (!volumes.length) return;
    if (!volumeYear || yearAlreadyExists) {
      setVolumeYear(suggestedNextYear);
    }
  }, [volumes, volumeYear, yearAlreadyExists, suggestedNextYear]);

  async function createVolume() {
    if (yearAlreadyExists) {
      setError(`Volume for ${volumeYear} already exists in this journal. Only one volume per year is allowed.`);
      return;
    }
    setBusyId("create-volume");
    setError(null);
    setMessage(null);
    try {
      await apiJson(`/journals/${encodeURIComponent(journalSlug)}/volumes`, {
        method: "POST",
        body: JSON.stringify({ year: Number(volumeYear), number: Number(volumeNumber) }),
      });
      await loadPublishingData(journalSlug);
      setMessage("Volume created.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to create volume");
    } finally {
      setBusyId(null);
    }
  }

  async function createIssue() {
    if (!issueVolumeId) {
      setError("Select a volume first.");
      return;
    }
    setBusyId("create-issue");
    setError(null);
    setMessage(null);
    try {
      await apiJson(`/journals/${encodeURIComponent(journalSlug)}/issues`, {
        method: "POST",
        body: JSON.stringify({ volumeId: issueVolumeId, number: Number(issueNumber), title: issueTitle || undefined }),
      });
      await loadPublishingData(journalSlug);
      setMessage("Issue created.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to create issue");
    } finally {
      setBusyId(null);
    }
  }

  async function assignIssue(articleId: string) {
    const issueId = assignIssueByArticle[articleId];
    if (!issueId) return setError("Select an issue before assigning.");
    setBusyId(articleId);
    setError(null);
    setMessage(null);
    try {
      await apiJson(`/articles/${articleId}/assign-issue`, { method: "POST", body: JSON.stringify({ issueId }) });
      await loadPublishingData(journalSlug);
      setMessage("Article assigned to issue.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to assign issue");
    } finally {
      setBusyId(null);
    }
  }

  async function publish(articleId: string) {
    const pdfFileId = pdfFileIdByArticle[articleId]?.trim();
    if (!pdfFileId) return setError("Provide a PDF file id before publishing.");
    setBusyId(articleId);
    setError(null);
    setMessage(null);
    try {
      await apiJson(`/articles/${articleId}/publish`, { method: "POST", body: JSON.stringify({ pdfFileId }) });
      await loadPublishingData(journalSlug);
      setMessage("Article published.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to publish article");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p>Loading publishing dashboard...</p>;

  return (
    <main className="main-stack">
      <section className="hero">
        <h1>Publishing Operations</h1>
        <p>Create volumes/issues, assign accepted papers, and publish articles with PDF assets.</p>
        <div className="meta-row">
          <a href="/dashboard/editor" className="button button-ghost compact">
            Back to Editorial Queue
          </a>
        </div>
      </section>
      {message ? <p style={{ color: "var(--accent-2)", fontWeight: 700 }}>{message}</p> : null}
      {error ? <ErrorAlert message={error} /> : null}

      <section className="card">
        <p className="eyebrow">Journal</p>
        <select className="select" value={journalSlug} onChange={(event) => setJournalSlug(event.target.value)}>
          {journals.map((journal) => (
            <option key={journal.id} value={journal.slug}>
              {journal.title}
            </option>
          ))}
        </select>
      </section>

      <section className="card">
        <p className="eyebrow">Volume + Issue Setup</p>
        <div className="grid" style={{ marginTop: 8 }}>
          <div className="field">
            <label htmlFor="volume-year">Volume year</label>
            <input id="volume-year" className="input" type="number" value={volumeYear} onChange={(event) => setVolumeYear(event.target.value)} />
            <p className="muted">Suggested next year: {suggestedNextYear}</p>
          </div>
          <div className="field">
            <label htmlFor="volume-number">Volume number</label>
            <input id="volume-number" className="input" type="number" value={volumeNumber} onChange={(event) => setVolumeNumber(event.target.value)} />
          </div>
          <div style={{ alignSelf: "end" }}>
            <button
              className="button compact"
              disabled={busyId !== null || yearAlreadyExists}
              onClick={createVolume}
              type="button"
            >
              Create Volume
            </button>
          </div>
        </div>
        {yearAlreadyExists ? (
          <p className="alert" style={{ marginTop: 8 }}>
            A volume already exists for {volumeYear} in this journal.
          </p>
        ) : null}
        <div className="grid" style={{ marginTop: 12 }}>
          <div className="field">
            <label htmlFor="issue-volume">Parent volume</label>
            <select id="issue-volume" className="select" value={issueVolumeId} onChange={(event) => setIssueVolumeId(event.target.value)}>
              <option value="">Select volume</option>
              {volumes.map((volume) => (
                <option key={volume.id} value={volume.id}>
                  {volume.year} / Vol {volume.number}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="issue-number">Issue number</label>
            <input id="issue-number" className="input" type="number" value={issueNumber} onChange={(event) => setIssueNumber(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="issue-title">Issue title</label>
            <input id="issue-title" className="input" value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)} />
          </div>
          <div style={{ alignSelf: "end" }}>
            <button className="button compact" disabled={busyId !== null} onClick={createIssue} type="button">
              Create Issue
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">IN_PRESS Articles</p>
        <ul className="list" style={{ marginTop: 10 }}>
          {articles.map((article) => (
            <li key={article.id} className="list-item">
              <p style={{ fontWeight: 700 }}>{article.title || "(untitled article)"}</p>
              <p className="muted">
                {article.submission?.trackingNumber ?? "No tracking"} • {article.status}
              </p>
              <div className="grid" style={{ marginTop: 8, gridTemplateColumns: "minmax(220px,1fr) auto" }}>
                <select
                  className="select"
                  value={assignIssueByArticle[article.id] ?? article.issueId ?? ""}
                  onChange={(event) => setAssignIssueByArticle((prev) => ({ ...prev, [article.id]: event.target.value }))}
                  disabled={busyId !== null}
                >
                  <option value="">Select issue</option>
                  {issues.map((issue) => (
                    <option key={issue.id} value={issue.id}>
                      Issue {issue.number} {issue.title ? `• ${issue.title}` : ""}
                    </option>
                  ))}
                </select>
                <button className="button compact" type="button" disabled={busyId !== null} onClick={() => assignIssue(article.id)}>
                  Assign Issue
                </button>
              </div>
              <div className="grid" style={{ marginTop: 8, gridTemplateColumns: "minmax(220px,1fr) auto" }}>
                <input
                  className="input"
                  placeholder="Published PDF file id"
                  value={pdfFileIdByArticle[article.id] ?? ""}
                  onChange={(event) => setPdfFileIdByArticle((prev) => ({ ...prev, [article.id]: event.target.value }))}
                  disabled={busyId !== null}
                />
                <button className="button compact" type="button" disabled={busyId !== null} onClick={() => publish(article.id)}>
                  Publish
                </button>
              </div>
            </li>
          ))}
          {articles.length === 0 ? <li className="list-item">No in-press articles yet. Accept a submission first.</li> : null}
        </ul>
      </section>
    </main>
  );
}
