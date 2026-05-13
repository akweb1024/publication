"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson } from "../../../lib/clientApi";
import { errorMessage } from "../../../lib/errorMessage";
import ErrorAlert from "../../../components/ErrorAlert";
import AppShell from "../../../components/dashboard/AppShell";
import StatusBadge from "../../../components/dashboard/StatusBadge";
import ToastNotification from "../../../components/dashboard/ToastNotification";
import SkeletonBlock from "../../../components/dashboard/SkeletonBlock";
import ContextualHelp from "../../../components/dashboard/ContextualHelp";
import ConfirmationModal from "../../../components/dashboard/ConfirmationModal";

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
  const [confirmPublishArticle, setConfirmPublishArticle] = useState<string | null>(null);

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
      setToast({ tone: "error", message: `Volume for ${volumeYear} already exists.` });
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
      setToast({ tone: "error", message: "Select a volume first." });
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
    if (!issueId) {
      setError("Select an issue before assigning.");
      setToast({ tone: "error", message: "Select an issue before assigning." });
      return;
    }
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
    if (!pdfFileId) {
      setError("Provide a PDF file id before publishing.");
      setToast({ tone: "error", message: "Provide a PDF file id before publishing." });
      return;
    }
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
      setConfirmPublishArticle(null);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Loading..."
        sectionLabel="Publishing"
        breadcrumbItems={[{ label: "Dashboard", href: "/dashboard" }, { label: "Publishing", href: "/dashboard/publishing" }]}
        helpTopic="Publishing Operations"
      >
        <SkeletonBlock height={44} />
        <SkeletonBlock height={120} />
        <SkeletonBlock height={180} />
      </AppShell>
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
        { label: "Create Volume", onClick: createVolume, variant: "primary" },
        { label: "Create Issue", onClick: createIssue, variant: "secondary" },
        { label: "Journal Settings", href: "/dashboard/journals", variant: "ghost" },
      ]}
      workflowSteps={[
        { label: "Select Paper", state: "complete" },
        { label: "Verify Metadata", state: "complete" },
        { label: "Volume & Issue", state: "current" },
        { label: "Upload PDF", state: "upcoming" },
        { label: "Add DOI", state: "upcoming" },
        { label: "Publish", state: "upcoming" },
      ]}
      helpTopic="Publishing Operations"
    >
      {error ? <ErrorAlert message={error} /> : null}

      {/* Statistics */}
      <div className="shell-stats-grid">
        <div className="shell-stat-card">
          <span className="shell-stat-icon">📦</span>
          <p className="shell-stat-label">Volumes</p>
          <p className="shell-stat-value">{volumes.length}</p>
        </div>
        <div className="shell-stat-card">
          <span className="shell-stat-icon">📰</span>
          <p className="shell-stat-label">Issues</p>
          <p className="shell-stat-value">{issues.length}</p>
        </div>
        <div className="shell-stat-card">
          <span className="shell-stat-icon">📝</span>
          <p className="shell-stat-label">Accepted Waiting</p>
          <p className="shell-stat-value">{filteredArticles.length}</p>
          <p className="shell-stat-hint">In press queue</p>
        </div>
        <div className="shell-stat-card">
          <span className="shell-stat-icon">📖</span>
          <p className="shell-stat-label">Published</p>
          <p className="shell-stat-value">{articles.filter((a) => !!a.publishedAt).length}</p>
        </div>
        <div className="shell-stat-card">
          <span className="shell-stat-icon">📄</span>
          <p className="shell-stat-label">Pending PDFs</p>
          <p className="shell-stat-value">{pendingPdfUploads}</p>
          {pendingPdfUploads > 0 ? <p className="shell-stat-hint" style={{ color: "var(--warn)" }}>Upload needed</p> : null}
        </div>
      </div>

      {/* Workflow steps guide */}
      <div className="shell-section-grid">
        <div className="shell-section-card">
          <div className="shell-section-card-title">1️⃣ Select Journal</div>
          <p className="muted">Use journal switcher in the top bar or sidebar.</p>
        </div>
        <div className="shell-section-card">
          <div className="shell-section-card-title">2️⃣ Create Volume</div>
          <p className="muted">Define publication year and volume number below.</p>
        </div>
        <div className="shell-section-card">
          <div className="shell-section-card-title">3️⃣ Create Issue</div>
          <p className="muted">Create issue under selected volume below.</p>
        </div>
        <div className="shell-section-card">
          <div className="shell-section-card-title">4️⃣ Assign Papers</div>
          <p className="muted">Map in-press articles to an issue in the article list.</p>
        </div>
        <div className="shell-section-card">
          <div className="shell-section-card-title">5️⃣ Upload PDFs</div>
          <p className="muted">Provide published file id for each article.</p>
        </div>
        <div className="shell-section-card">
          <div className="shell-section-card-title">6️⃣ Publish</div>
          <p className="muted">Publish the final article to archive.</p>
        </div>
      </div>

      {/* Volume & Issue Setup */}
      <div className="shell-form-section">
        <div className="shell-form-section-header">
          <h3>📦 Volume & Issue Setup <ContextualHelp text="Each journal has one volume per year. Issues are created within volumes. The suggested next year is based on existing volumes. Only one volume per year is allowed." /></h3>
        </div>
        <div className="shell-form-grid" style={{ marginTop: 10 }}>
          {/* Create Volume */}
          <div className="shell-form-section" style={{ borderLeft: "3px solid var(--accent)" }}>
            <h3 style={{ fontSize: "0.95rem" }}>Create Volume</h3>
            <div className="field">
              <label htmlFor="volume-year">Volume Year <span className="shell-field-required">*</span></label>
              <input id="volume-year" className="input" type="number" value={volumeYear} onChange={(event) => setVolumeYear(event.target.value)} />
              <p className="shell-field-hint">Suggested next year: {suggestedNextYear}</p>
            </div>
            <div className="field">
              <label htmlFor="volume-number">Volume Number</label>
              <input id="volume-number" className="input" type="number" value={volumeNumber} onChange={(event) => setVolumeNumber(event.target.value)} />
            </div>
            <button className="button button-primary compact" type="button" disabled={busyId !== null || yearAlreadyExists} onClick={createVolume}>
              {busyId === "create-volume" ? "Creating..." : "Create Volume"}
            </button>
            {yearAlreadyExists ? <p className="shell-field-error" style={{ marginTop: 8 }}>A volume already exists for {volumeYear}.</p> : null}
          </div>

          {/* Create Issue */}
          <div className="shell-form-section" style={{ borderLeft: "3px solid #0d9488" }}>
            <h3 style={{ fontSize: "0.95rem" }}>Create Issue <ContextualHelp text="Issues are created within volumes. Each issue has a number and optional title. Special issues can have descriptive titles." /></h3>
            <div className="field">
              <label htmlFor="issue-volume">Parent Volume <span className="shell-field-required">*</span></label>
              <select id="issue-volume" className="select" value={issueVolumeId} onChange={(event) => setIssueVolumeId(event.target.value)}>
                <option value="">Select volume</option>
                {volumes.map((volume) => (
                  <option key={volume.id} value={volume.id}>{volume.year} / Vol {volume.number}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="issue-number">Issue Number <span className="shell-field-required">*</span></label>
              <input id="issue-number" className="input" type="number" value={issueNumber} onChange={(event) => setIssueNumber(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="issue-title">Issue Title (optional)</label>
              <input id="issue-title" className="input" value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)} placeholder="Special Issue on..." />
              <p className="shell-field-hint">Optional. Use for special themed issues.</p>
            </div>
            <button className="button compact" disabled={busyId !== null} onClick={createIssue} type="button">
              {busyId === "create-issue" ? "Creating..." : "Create Issue"}
            </button>
          </div>
        </div>
      </div>

      {/* Assign & Publish Articles */}
      <div className="shell-form-section">
        <div className="shell-form-section-header">
          <h3>📝 Assign & Publish Articles</h3>
          <div className="field" style={{ minWidth: 180 }}>
            <label htmlFor="article-status-filter">Status Filter</label>
            <select id="article-status-filter" className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="IN_PRESS">In Press</option>
              <option value="ALL">All</option>
            </select>
          </div>
        </div>

        {filteredArticles.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 12 }}>
            <h3>No matching articles</h3>
            <p className="muted">No articles in the current filter. Try selecting a different status or check the editorial queue for accepted papers.</p>
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {filteredArticles.map((article) => (
            <div key={article.id} className="shell-section-card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: "1rem" }}>{article.title || "(untitled article)"}</p>
                  <p className="muted">{article.submission?.trackingNumber ?? "No tracking number"} • {article.status}</p>
                </div>
                <StatusBadge label={article.status} tone={article.status === "PUBLISHED" ? "published" : article.status === "IN_PRESS" ? "info" : "neutral"} />
              </div>

              <div className="shell-form-grid" style={{ marginTop: 10 }}>
                <div className="field">
                  <label htmlFor={`issue-${article.id}`}>Assign Issue <ContextualHelp text="Select the issue this article should appear in. The article must be assigned to an issue before publishing." /></label>
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

              <div className="shell-form-grid" style={{ marginTop: 8 }}>
                <div className="field">
                  <label htmlFor={`pdf-${article.id}`}>Published PDF File Id <ContextualHelp text="Enter the file ID for the final published PDF. This should be a valid file identifier from the storage system. The PDF will be served to readers." /></label>
                  <input
                    id={`pdf-${article.id}`}
                    className="input"
                    placeholder="Paste file id (e.g. abc123-def456)"
                    value={pdfFileIdByArticle[article.id] ?? ""}
                    onChange={(event) => setPdfFileIdByArticle((prev) => ({ ...prev, [article.id]: event.target.value }))}
                    disabled={busyId !== null}
                  />
                </div>
                <div style={{ alignSelf: "end" }}>
                  <button className="button button-primary compact" type="button" disabled={busyId !== null || !pdfFileIdByArticle[article.id]?.trim()} onClick={() => setConfirmPublishArticle(article.id)}>
                    Publish Article
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ToastNotification open={!!toast} tone={toast?.tone ?? "info"} message={toast?.message ?? ""} onClose={() => setToast(null)} />
      <ConfirmationModal
        open={!!confirmPublishArticle}
        title="Publish Article"
        description={`This will make the article publicly available in the archive. This action cannot be undone. Make sure the article metadata, issue assignment, and PDF are all correct before publishing.`}
        confirmLabel="Publish"
        busy={busyId !== null}
        onCancel={() => setConfirmPublishArticle(null)}
        onConfirm={() => {
          if (confirmPublishArticle) void publish(confirmPublishArticle);
        }}
      />
    </AppShell>
  );
}
