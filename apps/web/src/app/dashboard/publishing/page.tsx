"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson } from "../../../lib/clientApi";
import { errorMessage } from "../../../lib/errorMessage";
import ErrorAlert from "../../../components/ErrorAlert";
import AppShell from "../../../components/dashboard/AppShell";
import StatCard from "../../../components/dashboard/StatCard";
import StatusBadge from "../../../components/dashboard/StatusBadge";
import ToastNotification from "../../../components/dashboard/ToastNotification";
import SkeletonBlock from "../../../components/dashboard/SkeletonBlock";

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
  const [toast, setToast] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState("IN_PRESS");

  const parsedVolumeYear = Number(volumeYear);
  const yearAlreadyExists = Number.isFinite(parsedVolumeYear) && volumes.some((volume) => volume.year === parsedVolumeYear);
  const suggestedNextYear = volumes.length > 0 ? String(Math.max(...volumes.map((volume) => volume.year)) + 1) : String(new Date().getFullYear());

  const selectedJournal = useMemo(
    () => journals.find((journal) => journal.slug === journalSlug)?.title ?? "No journal selected",
    [journals, journalSlug]
  );

  const filteredArticles = useMemo(() => {
    if (statusFilter === "ALL") return articles;
    return articles.filter((article) => article.status === statusFilter);
  }, [articles, statusFilter]);

  const pendingPdfUploads = filteredArticles.filter((article) => !(pdfFileIdByArticle[article.id] ?? "").trim()).length;

  const loadPublishingData = useCallback(async (slug: string) => {
    const [volumeRes, issueRes, articleRes] = await Promise.all([
      apiJson<{ items: Volume[] }>(`/journals/${encodeURIComponent(slug)}/volumes`, { method: "GET" }),
      apiJson<{ items: Issue[] }>(`/journals/${encodeURIComponent(slug)}/issues`, { method: "GET" }),
      apiJson<{ items: Article[] }>(`/journals/${encodeURIComponent(slug)}/articles?status=IN_PRESS`, { method: "GET" }),
    ]);
    setVolumes(volumeRes.items);
    setIssues(issueRes.items);
    setArticles(articleRes.items);
    setIssueVolumeId((prev) => prev || volumeRes.items[0]?.id || "");
  }, []);

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
      } catch (err: unknown) {
        if (!mounted) return;
        setError(errorMessage(err) || "Failed to load publishing dashboard");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();
    return () => {
      mounted = false;
    };
  }, [loadPublishingData]);

  useEffect(() => {
    if (!journalSlug) return;
    loadPublishingData(journalSlug).catch((err: unknown) => setError(errorMessage(err) || "Failed to refresh publishing data"));
  }, [journalSlug, loadPublishingData]);

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
    try {
      await apiJson(`/journals/${encodeURIComponent(journalSlug)}/volumes`, {
        method: "POST",
        body: JSON.stringify({ year: Number(volumeYear), number: Number(volumeNumber) }),
      });
      await loadPublishingData(journalSlug);
      setToast({ tone: "success", message: "Volume created." });
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to create volume");
      setToast({ tone: "error", message: "Failed to create volume." });
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
    try {
      await apiJson(`/journals/${encodeURIComponent(journalSlug)}/issues`, {
        method: "POST",
        body: JSON.stringify({ volumeId: issueVolumeId, number: Number(issueNumber), title: issueTitle || undefined }),
      });
      await loadPublishingData(journalSlug);
      setToast({ tone: "success", message: "Issue created." });
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to create issue");
      setToast({ tone: "error", message: "Failed to create issue." });
    } finally {
      setBusyId(null);
    }
  }

  async function assignIssue(articleId: string) {
    const issueId = assignIssueByArticle[articleId];
    if (!issueId) return setError("Select an issue before assigning.");
    setBusyId(articleId);
    setError(null);
    try {
      await apiJson(`/articles/${articleId}/assign-issue`, { method: "POST", body: JSON.stringify({ issueId }) });
      await loadPublishingData(journalSlug);
      setToast({ tone: "success", message: "Article assigned to issue." });
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to assign issue");
      setToast({ tone: "error", message: "Failed to assign issue." });
    } finally {
      setBusyId(null);
    }
  }

  async function publish(articleId: string) {
    const pdfFileId = pdfFileIdByArticle[articleId]?.trim();
    if (!pdfFileId) return setError("Provide a PDF file id before publishing.");
    setBusyId(articleId);
    setError(null);
    try {
      await apiJson(`/articles/${articleId}/publish`, { method: "POST", body: JSON.stringify({ pdfFileId }) });
      await loadPublishingData(journalSlug);
      setToast({ tone: "success", message: "Article published." });
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to publish article");
      setToast({ tone: "error", message: "Failed to publish article." });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <main className="dashboard-page-content">
        <SkeletonBlock height={44} />
        <SkeletonBlock height={120} />
        <SkeletonBlock height={180} />
      </main>
    );
  }

  return (
    <AppShell
      title="Publishing Operations"
      sectionLabel="Publishing"
      description="Run daily publishing workflow from volume creation to final publication."
      selectedJournalLabel={selectedJournal}
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Publishing", href: "/dashboard/publishing" },
      ]}
      journals={journals}
      selectedJournalSlug={journalSlug}
      onJournalChange={setJournalSlug}
      quickActions={[
        { label: "Create Journal", href: "/dashboard/journals", variant: "ghost" },
        { label: "Create Volume", onClick: createVolume, variant: "primary" },
        { label: "Create Issue", onClick: createIssue, variant: "secondary" },
      ]}
      workflowSteps={[
        { label: "Select Accepted Paper", state: "complete" },
        { label: "Verify Metadata", state: "complete" },
        { label: "Select Volume and Issue", state: "current" },
        { label: "Upload Final PDF", state: "upcoming" },
        { label: "Add DOI / Pages / Article ID", state: "upcoming" },
        { label: "Preview and Publish", state: "upcoming" },
      ]}
    >
      {error ? <ErrorAlert message={error} /> : null}

      <section className="dashboard-grid-three">
        <StatCard label="Total Volumes" value={volumes.length} />
        <StatCard label="Total Issues" value={issues.length} />
        <StatCard label="Accepted Waiting" value={filteredArticles.length} hint="In press queue" />
        <StatCard label="Published Articles" value={articles.filter((article) => !!article.publishedAt).length} />
        <StatCard label="Pending PDF Uploads" value={pendingPdfUploads} />
      </section>

      <section className="card">
        <p className="eyebrow">Workflow</p>
        <div className="dashboard-grid-three" style={{ marginTop: 10 }}>
          <div className="form-section"><h3>1. Select Journal</h3><p>Use journal switcher in the top bar.</p></div>
          <div className="form-section"><h3>2. Create Volume</h3><p>Define publication year and volume number.</p></div>
          <div className="form-section"><h3>3. Create Issue</h3><p>Create issue under selected volume.</p></div>
          <div className="form-section"><h3>4. Assign Accepted Papers</h3><p>Map in-press articles to an issue.</p></div>
          <div className="form-section"><h3>5. Upload PDF Assets</h3><p>Provide published file id for each article.</p></div>
          <div className="form-section"><h3>6. Publish Article</h3><p>Publish the final article to archive.</p></div>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Volume & Issue Setup</p>
        <div className="dashboard-grid-two" style={{ marginTop: 10 }}>
          <div className="form-section">
            <h3>Create Volume</h3>
            <div className="field">
              <label htmlFor="volume-year">Volume Year</label>
              <input id="volume-year" className="input" type="number" value={volumeYear} onChange={(event) => setVolumeYear(event.target.value)} />
              <p className="muted">Suggested next year: {suggestedNextYear}</p>
            </div>
            <div className="field">
              <label htmlFor="volume-number">Volume Number</label>
              <input id="volume-number" className="input" type="number" value={volumeNumber} onChange={(event) => setVolumeNumber(event.target.value)} />
            </div>
            <button className="button button-primary compact" type="button" disabled={busyId !== null || yearAlreadyExists} onClick={createVolume}>
              {busyId === "create-volume" ? "Creating..." : "Create Volume"}
            </button>
            {yearAlreadyExists ? <p className="alert" style={{ marginTop: 8 }}>A volume already exists for {volumeYear}.</p> : null}
          </div>

          <div className="form-section">
            <h3>Create Issue</h3>
            <div className="field">
              <label htmlFor="issue-volume">Parent Volume</label>
              <select id="issue-volume" className="select" value={issueVolumeId} onChange={(event) => setIssueVolumeId(event.target.value)}>
                <option value="">Select volume</option>
                {volumes.map((volume) => (
                  <option key={volume.id} value={volume.id}>{volume.year} / Vol {volume.number}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="issue-number">Issue Number</label>
              <input id="issue-number" className="input" type="number" value={issueNumber} onChange={(event) => setIssueNumber(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="issue-title">Issue Title</label>
              <input id="issue-title" className="input" value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)} placeholder="Special Issue on..." />
            </div>
            <button className="button compact" disabled={busyId !== null} onClick={createIssue} type="button">
              {busyId === "create-issue" ? "Creating..." : "Create Issue"}
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <p className="eyebrow">Assign & Publish Articles</p>
          <div className="field" style={{ minWidth: 220 }}>
            <label htmlFor="article-status-filter">Article Status</label>
            <select id="article-status-filter" className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="IN_PRESS">IN_PRESS</option>
              <option value="ALL">ALL</option>
            </select>
          </div>
        </div>
        <ul className="list" style={{ marginTop: 10 }}>
          {filteredArticles.map((article) => (
            <li key={article.id} className="list-item">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontWeight: 700 }}>{article.title || "(untitled article)"}</p>
                  <p className="muted">{article.submission?.trackingNumber ?? "No tracking"}</p>
                </div>
                <StatusBadge label={article.status} tone={article.status === "PUBLISHED" ? "ok" : "info"} />
              </div>
              <div className="dashboard-grid-two" style={{ marginTop: 8 }}>
                <div className="field">
                  <label htmlFor={`issue-${article.id}`}>Assign Issue</label>
                  <select
                    id={`issue-${article.id}`}
                    className="select"
                    value={assignIssueByArticle[article.id] ?? article.issueId ?? ""}
                    onChange={(event) => setAssignIssueByArticle((prev) => ({ ...prev, [article.id]: event.target.value }))}
                    disabled={busyId !== null}
                  >
                    <option value="">Select issue</option>
                    {issues.map((issue) => (
                      <option key={issue.id} value={issue.id}>Issue {issue.number} {issue.title ? `- ${issue.title}` : ""}</option>
                    ))}
                  </select>
                </div>
                <div style={{ alignSelf: "end" }}>
                  <button className="button compact" type="button" disabled={busyId !== null} onClick={() => assignIssue(article.id)}>
                    Assign Paper
                  </button>
                </div>
              </div>
              <div className="dashboard-grid-two" style={{ marginTop: 8 }}>
                <div className="field">
                  <label htmlFor={`pdf-${article.id}`}>Published PDF File Id</label>
                  <input
                    id={`pdf-${article.id}`}
                    className="input"
                    placeholder="Paste file id"
                    value={pdfFileIdByArticle[article.id] ?? ""}
                    onChange={(event) => setPdfFileIdByArticle((prev) => ({ ...prev, [article.id]: event.target.value }))}
                    disabled={busyId !== null}
                  />
                </div>
                <div style={{ alignSelf: "end" }}>
                  <button className="button button-primary compact" type="button" disabled={busyId !== null} onClick={() => publish(article.id)}>
                    Publish Article
                  </button>
                </div>
              </div>
            </li>
          ))}
          {filteredArticles.length === 0 ? <li className="list-item"><div className="empty-state"><p>No matching articles in current filter.</p></div></li> : null}
        </ul>
      </section>
      <ToastNotification open={!!toast} tone={toast?.tone ?? "info"} message={toast?.message ?? ""} onClose={() => setToast(null)} />
    </AppShell>
  );
}
