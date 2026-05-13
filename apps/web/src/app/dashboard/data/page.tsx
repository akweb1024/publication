"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../../../components/dashboard/AppShell";
import SkeletonBlock from "../../../components/dashboard/SkeletonBlock";
import StatusBadge from "../../../components/dashboard/StatusBadge";
import ToastNotification from "../../../components/dashboard/ToastNotification";
import { apiJson } from "../../../lib/clientApi";
import { errorMessage } from "../../../lib/errorMessage";

type EntityTab = "journals" | "submissions" | "volumes" | "issues" | "articles";

type Journal = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  timezone: string;
};

type JournalDetail = Journal & {
  issnPrint?: string | null;
  issnOnline?: string | null;
  requiredPolicyKeys?: string[];
};

type Submission = {
  id: string;
  status: string;
  trackingNumber?: string | null;
  manuscriptTitle?: string | null;
  abstractText?: string | null;
  keywordsText?: string[];
  articleType?: string | null;
  createdAt?: string;
  submittedAt?: string | null;
};

type Volume = { id: string; year: number; number: number };
type Issue = { id: string; volumeId: string; number: number; title?: string | null; status?: string | null; publicationDate?: string | null };
type Article = {
  id: string;
  title: string;
  status: string;
  issueId?: string | null;
  publishedAt?: string | null;
  submission?: { trackingNumber?: string | null } | null;
};

type ToastState = { tone: "success" | "error" | "info"; message: string } | null;

const ENTITY_TABS: Array<{ key: EntityTab; label: string; description: string }> = [
  { key: "journals", label: "Journals", description: "Create and edit journal profile records." },
  { key: "submissions", label: "Submissions", description: "Search and update your draft manuscript metadata." },
  { key: "volumes", label: "Volumes", description: "Create publication volumes for the selected journal." },
  { key: "issues", label: "Issues", description: "Create issues inside existing volumes." },
  { key: "articles", label: "Articles", description: "Review article records and assign issues." },
];

const EMPTY_JOURNAL_FORM = {
  slug: "",
  title: "",
  description: "",
  timezone: "UTC",
  issnPrint: "",
  issnOnline: "",
  requiredPolicyKeys: "",
};

function compactDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function toneForStatus(status?: string | null): "ok" | "warn" | "danger" | "info" | "neutral" | "submitted" | "under-review" | "accepted" | "rejected" | "revision" | "published" | "draft" {
  switch ((status ?? "").toUpperCase()) {
    case "DRAFT":
      return "draft";
    case "SUBMITTED":
      return "submitted";
    case "UNDER_REVIEW":
      return "under-review";
    case "REVISION_REQUESTED":
      return "revision";
    case "ACCEPTED":
    case "IN_PRESS":
      return "accepted";
    case "PUBLISHED":
      return "published";
    case "REJECTED":
    case "RETRACTED":
      return "rejected";
    default:
      return "neutral";
  }
}

function keywordTextToArray(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export default function DataManagerPage() {
  const [activeTab, setActiveTab] = useState<EntityTab>("journals");
  const [journals, setJournals] = useState<Journal[]>([]);
  const [selectedJournalSlug, setSelectedJournalSlug] = useState("");
  const [journalDetail, setJournalDetail] = useState<JournalDetail | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const [journalForm, setJournalForm] = useState(EMPTY_JOURNAL_FORM);
  const [newJournalMode, setNewJournalMode] = useState(false);
  const [submissionForm, setSubmissionForm] = useState({ id: "", manuscriptTitle: "", abstractText: "", keywordsText: "", articleType: "" });
  const [volumeForm, setVolumeForm] = useState({ year: String(new Date().getFullYear()), number: "1" });
  const [issueForm, setIssueForm] = useState({ volumeId: "", number: "1", title: "", publicationDate: "" });
  const [articleIssueDrafts, setArticleIssueDrafts] = useState<Record<string, string>>({});

  const selectedJournal = useMemo(
    () => journals.find((journal) => journal.slug === selectedJournalSlug) ?? null,
    [journals, selectedJournalSlug]
  );

  const query = search.trim().toLowerCase();
  const statusOptions = useMemo(() => {
    const source = activeTab === "articles"
      ? articles.map((item) => item.status)
      : activeTab === "issues"
        ? issues.map((item) => item.status ?? "")
        : submissions.map((item) => item.status);
    return Array.from(new Set(source.filter(Boolean))).sort();
  }, [activeTab, articles, issues, submissions]);

  const visibleJournals = useMemo(() => journals.filter((journal) => {
    if (!query) return true;
    return [journal.title, journal.slug, journal.description, journal.timezone].some((value) => String(value ?? "").toLowerCase().includes(query));
  }), [journals, query]);

  const visibleSubmissions = useMemo(() => submissions.filter((submission) => {
    const matchesStatus = statusFilter === "all" || submission.status === statusFilter;
    const matchesQuery = !query || [submission.trackingNumber, submission.manuscriptTitle, submission.articleType, submission.status].some((value) => String(value ?? "").toLowerCase().includes(query));
    return matchesStatus && matchesQuery;
  }), [query, statusFilter, submissions]);

  const visibleVolumes = useMemo(() => volumes.filter((volume) => {
    if (!query) return true;
    return [`${volume.year}`, `${volume.number}`, volume.id].some((value) => value.toLowerCase().includes(query));
  }), [query, volumes]);

  const visibleIssues = useMemo(() => issues.filter((issue) => {
    const matchesStatus = statusFilter === "all" || issue.status === statusFilter;
    const volume = volumes.find((item) => item.id === issue.volumeId);
    const matchesQuery = !query || [issue.title, issue.status, issue.id, `${issue.number}`, volume ? `${volume.year} / ${volume.number}` : ""].some((value) => String(value ?? "").toLowerCase().includes(query));
    return matchesStatus && matchesQuery;
  }), [issues, query, statusFilter, volumes]);

  const visibleArticles = useMemo(() => articles.filter((article) => {
    const matchesStatus = statusFilter === "all" || article.status === statusFilter;
    const matchesQuery = !query || [article.title, article.status, article.submission?.trackingNumber, article.id].some((value) => String(value ?? "").toLowerCase().includes(query));
    return matchesStatus && matchesQuery;
  }), [articles, query, statusFilter]);

  const metricCards = [
    { label: "Journals", value: journals.length, hint: `${visibleJournals.length} visible`, icon: "📚" },
    { label: "Drafts", value: submissions.filter((item) => item.status === "DRAFT").length, hint: `${submissions.length} submissions`, icon: "📝" },
    { label: "Volumes", value: volumes.length, hint: `${issues.length} issues`, icon: "📦" },
    { label: "Articles", value: articles.length, hint: `${articles.filter((item) => item.status === "PUBLISHED").length} published`, icon: "📖" },
  ];

  const populateJournalForm = useCallback((detail: JournalDetail | null) => {
    if (!detail) {
      setJournalForm(EMPTY_JOURNAL_FORM);
      return;
    }
    setJournalForm({
      slug: detail.slug,
      title: detail.title ?? "",
      description: detail.description ?? "",
      timezone: detail.timezone ?? "UTC",
      issnPrint: detail.issnPrint ?? "",
      issnOnline: detail.issnOnline ?? "",
      requiredPolicyKeys: (detail.requiredPolicyKeys ?? []).join(", "),
    });
  }, []);

  const loadSelectedJournalData = useCallback(async (slug: string) => {
    if (!slug) return;
    setSectionLoading(true);
    setError(null);
    const [detailRes, submissionRes, volumeRes, issueRes, articleRes] = await Promise.allSettled([
      apiJson<JournalDetail>(`/journals/${encodeURIComponent(slug)}`, { method: "GET" }),
      apiJson<{ items: Submission[] }>(`/submissions?journalSlug=${encodeURIComponent(slug)}&mine=true`, { method: "GET" }),
      apiJson<{ items: Volume[] }>(`/journals/${encodeURIComponent(slug)}/volumes`, { method: "GET" }),
      apiJson<{ items: Issue[] }>(`/journals/${encodeURIComponent(slug)}/issues`, { method: "GET" }),
      apiJson<{ items: Article[] }>(`/journals/${encodeURIComponent(slug)}/articles`, { method: "GET" }),
    ]);

    if (detailRes.status === "fulfilled") {
      setJournalDetail(detailRes.value);
      populateJournalForm(detailRes.value);
    }
    setSubmissions(submissionRes.status === "fulfilled" ? submissionRes.value.items : []);
    setVolumes(volumeRes.status === "fulfilled" ? volumeRes.value.items : []);
    setIssues(issueRes.status === "fulfilled" ? issueRes.value.items : []);
    setArticles(articleRes.status === "fulfilled" ? articleRes.value.items : []);
    if (issueRes.status === "fulfilled") {
      setArticleIssueDrafts((prev) => {
        const next = { ...prev };
        for (const article of articleRes.status === "fulfilled" ? articleRes.value.items : []) {
          if (!next[article.id]) next[article.id] = article.issueId ?? "";
        }
        return next;
      });
    }
    setSectionLoading(false);
  }, [populateJournalForm]);

  const reloadAll = useCallback(async (preferredSlug?: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiJson("/auth/session", { method: "GET" });
      const journalRes = await apiJson<{ items: Journal[] }>("/journals", { method: "GET" });
      setJournals(journalRes.items);
      const nextSlug = preferredSlug && journalRes.items.some((item) => item.slug === preferredSlug)
        ? preferredSlug
        : journalRes.items[0]?.slug ?? "";
      setSelectedJournalSlug(nextSlug);
      if (nextSlug) await loadSelectedJournalData(nextSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to load data manager");
    } finally {
      setLoading(false);
    }
  }, [loadSelectedJournalData]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  async function changeJournal(slug: string) {
    setSelectedJournalSlug(slug);
    setNewJournalMode(false);
    await loadSelectedJournalData(slug);
  }

  async function saveJournal(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (newJournalMode) {
        const created = await apiJson<Journal>("/journals", {
          method: "POST",
          body: JSON.stringify({
            slug: journalForm.slug.trim(),
            title: journalForm.title.trim(),
            description: journalForm.description.trim() || null,
            timezone: journalForm.timezone.trim() || "UTC",
          }),
        });
        setToast({ tone: "success", message: "Journal created." });
        setNewJournalMode(false);
        await reloadAll(created.slug);
      } else if (selectedJournalSlug) {
        await apiJson(`/journals/${encodeURIComponent(selectedJournalSlug)}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: journalForm.title.trim(),
            description: journalForm.description.trim() || null,
            timezone: journalForm.timezone.trim() || "UTC",
            issnPrint: journalForm.issnPrint.trim() || null,
            issnOnline: journalForm.issnOnline.trim() || null,
            requiredPolicyKeys: keywordTextToArray(journalForm.requiredPolicyKeys),
          }),
        });
        setToast({ tone: "success", message: "Journal updated." });
        await reloadAll(selectedJournalSlug);
      }
    } catch (err: unknown) {
      const message = errorMessage(err) || "Failed to save journal";
      setError(message);
      setToast({ tone: "error", message });
    } finally {
      setSaving(false);
    }
  }

  async function createDraft() {
    if (!selectedJournalSlug) return;
    setSaving(true);
    try {
      await apiJson(`/journals/${encodeURIComponent(selectedJournalSlug)}/submissions`, { method: "POST" });
      setToast({ tone: "success", message: "Draft submission created." });
      await loadSelectedJournalData(selectedJournalSlug);
      setActiveTab("submissions");
    } catch (err: unknown) {
      setToast({ tone: "error", message: errorMessage(err) || "Failed to create draft." });
    } finally {
      setSaving(false);
    }
  }

  async function saveSubmissionDraft(event: FormEvent) {
    event.preventDefault();
    if (!submissionForm.id || !selectedJournalSlug) return;
    setSaving(true);
    try {
      await apiJson(`/submissions/${encodeURIComponent(submissionForm.id)}/update-draft`, {
        method: "POST",
        body: JSON.stringify({
          manuscriptTitle: submissionForm.manuscriptTitle.trim(),
          abstractText: submissionForm.abstractText.trim(),
          keywordsText: keywordTextToArray(submissionForm.keywordsText),
          articleType: submissionForm.articleType.trim(),
        }),
      });
      setToast({ tone: "success", message: "Submission draft updated." });
      setSubmissionForm({ id: "", manuscriptTitle: "", abstractText: "", keywordsText: "", articleType: "" });
      await loadSelectedJournalData(selectedJournalSlug);
    } catch (err: unknown) {
      setToast({ tone: "error", message: errorMessage(err) || "Failed to update submission." });
    } finally {
      setSaving(false);
    }
  }

  async function createVolume(event: FormEvent) {
    event.preventDefault();
    if (!selectedJournalSlug) return;
    setSaving(true);
    try {
      await apiJson(`/journals/${encodeURIComponent(selectedJournalSlug)}/volumes`, {
        method: "POST",
        body: JSON.stringify({ year: Number(volumeForm.year), number: Number(volumeForm.number) }),
      });
      setToast({ tone: "success", message: "Volume created." });
      await loadSelectedJournalData(selectedJournalSlug);
    } catch (err: unknown) {
      setToast({ tone: "error", message: errorMessage(err) || "Failed to create volume." });
    } finally {
      setSaving(false);
    }
  }

  async function createIssue(event: FormEvent) {
    event.preventDefault();
    if (!selectedJournalSlug || !issueForm.volumeId) return;
    setSaving(true);
    try {
      await apiJson(`/journals/${encodeURIComponent(selectedJournalSlug)}/issues`, {
        method: "POST",
        body: JSON.stringify({
          volumeId: issueForm.volumeId,
          number: Number(issueForm.number),
          title: issueForm.title.trim() || undefined,
          publicationDate: issueForm.publicationDate ? new Date(`${issueForm.publicationDate}T00:00:00.000Z`).toISOString() : undefined,
        }),
      });
      setToast({ tone: "success", message: "Issue created." });
      await loadSelectedJournalData(selectedJournalSlug);
    } catch (err: unknown) {
      setToast({ tone: "error", message: errorMessage(err) || "Failed to create issue." });
    } finally {
      setSaving(false);
    }
  }

  async function assignIssue(articleId: string) {
    if (!selectedJournalSlug || !articleIssueDrafts[articleId]) return;
    setSaving(true);
    try {
      await apiJson(`/articles/${encodeURIComponent(articleId)}/assign-issue`, {
        method: "POST",
        body: JSON.stringify({ issueId: articleIssueDrafts[articleId] }),
      });
      setToast({ tone: "success", message: "Article issue updated." });
      await loadSelectedJournalData(selectedJournalSlug);
    } catch (err: unknown) {
      setToast({ tone: "error", message: errorMessage(err) || "Failed to assign issue." });
    } finally {
      setSaving(false);
    }
  }

  function startNewJournal() {
    setNewJournalMode(true);
    setActiveTab("journals");
    setJournalDetail(null);
    setJournalForm(EMPTY_JOURNAL_FORM);
  }

  function editSubmission(submission: Submission) {
    setActiveTab("submissions");
    setSubmissionForm({
      id: submission.id,
      manuscriptTitle: submission.manuscriptTitle ?? "",
      abstractText: submission.abstractText ?? "",
      keywordsText: (submission.keywordsText ?? []).join(", "),
      articleType: submission.articleType ?? "",
    });
  }

  const activeDescription = ENTITY_TABS.find((tab) => tab.key === activeTab)?.description ?? "";

  return (
    <AppShell
      title="Data Manager"
      sectionLabel="Administration"
      description="Search, filter, create, and update core publishing records from one table-first workspace."
      breadcrumbItems={[{ label: "Dashboard", href: "/dashboard" }, { label: "Data Manager", href: "/dashboard/data" }]}
      journals={journals}
      selectedJournalSlug={selectedJournalSlug}
      selectedJournalLabel={selectedJournal?.title ?? "No journal selected"}
      onJournalChange={changeJournal}
      quickActions={[
        { label: "New Journal", onClick: startNewJournal, variant: "primary" },
        { label: "New Draft", onClick: createDraft, variant: "secondary" },
      ]}
      helpTopic="Data Manager"
      helpContent="Use this table-first workspace to inspect and edit records. Choose a data type, search or filter the table, then use the forms below for create and update operations. Destructive deletes are intentionally not exposed here until backend archival rules exist."
    >
      {loading ? (
        <>
          <SkeletonBlock height={80} />
          <SkeletonBlock height={260} />
        </>
      ) : (
        <>
          {error ? <section className="shell-alert-card"><div className="shell-alert-item danger"><span>⚠️</span><span>{error}</span></div></section> : null}

          <section className="data-manager-toolbar">
            <div className="data-manager-tabs" role="tablist" aria-label="Data tables">
              {ENTITY_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`data-manager-tab ${activeTab === tab.key ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setStatusFilter("all");
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="data-manager-filters">
              <label className="field">
                <span className="sr-only">Search records</span>
                <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, slug, status, ID..." />
              </label>
              {(activeTab === "submissions" || activeTab === "articles" || activeTab === "issues") ? (
                <label className="field">
                  <span className="sr-only">Filter status</span>
                  <select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">All statuses</option>
                    {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
            <p className="muted">{activeDescription}</p>
          </section>

          <section className="shell-stats-grid">
            {metricCards.map((metric) => (
              <article key={metric.label} className="shell-stat-card">
                <span className="shell-stat-icon">{metric.icon}</span>
                <p className="shell-stat-label">{metric.label}</p>
                <p className="shell-stat-value">{metric.value}</p>
                <p className="shell-stat-hint">{metric.hint}</p>
              </article>
            ))}
          </section>

          {sectionLoading ? <SkeletonBlock height={220} /> : (
            <section className="shell-table-wrap data-manager-table">
              <DataTable
                activeTab={activeTab}
                journals={visibleJournals}
                submissions={visibleSubmissions}
                volumes={visibleVolumes}
                issues={visibleIssues}
                articles={visibleArticles}
                allVolumes={volumes}
                articleIssueDrafts={articleIssueDrafts}
                saving={saving}
                onEditJournal={(journal) => {
                  setNewJournalMode(false);
                  void changeJournal(journal.slug);
                }}
                onEditSubmission={editSubmission}
                onArticleIssueChange={(articleId, issueId) => setArticleIssueDrafts((prev) => ({ ...prev, [articleId]: issueId }))}
                onAssignIssue={assignIssue}
              />
            </section>
          )}

          <section className="data-manager-forms">
            {(activeTab === "journals" || newJournalMode) ? (
              <form className="shell-form-section" onSubmit={saveJournal}>
                <div className="shell-form-section-header">
                  <div>
                    <h3>{newJournalMode ? "Create Journal" : "Edit Journal"}</h3>
                    <p className="muted">{newJournalMode ? "Add a new live journal and assign yourself as admin." : "Update profile, identifiers, and policy metadata."}</p>
                  </div>
                  {!newJournalMode ? <StatusBadge label={journalDetail?.slug ?? "Selected"} tone="info" /> : null}
                </div>
                <div className="shell-form-grid">
                  <label className="field">
                    <span>Slug</span>
                    <input className="input" value={journalForm.slug} disabled={!newJournalMode} onChange={(event) => setJournalForm((prev) => ({ ...prev, slug: event.target.value }))} placeholder="journal-slug" required={newJournalMode} />
                  </label>
                  <label className="field">
                    <span>Title</span>
                    <input className="input" value={journalForm.title} onChange={(event) => setJournalForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Journal title" required />
                  </label>
                  <label className="field">
                    <span>Timezone</span>
                    <input className="input" value={journalForm.timezone} onChange={(event) => setJournalForm((prev) => ({ ...prev, timezone: event.target.value }))} placeholder="UTC" required />
                  </label>
                  <label className="field">
                    <span>Print ISSN</span>
                    <input className="input" value={journalForm.issnPrint} disabled={newJournalMode} onChange={(event) => setJournalForm((prev) => ({ ...prev, issnPrint: event.target.value }))} placeholder="1234-5678" />
                  </label>
                  <label className="field">
                    <span>Online ISSN</span>
                    <input className="input" value={journalForm.issnOnline} disabled={newJournalMode} onChange={(event) => setJournalForm((prev) => ({ ...prev, issnOnline: event.target.value }))} placeholder="1234-5678" />
                  </label>
                  <label className="field shell-form-grid-full">
                    <span>Description</span>
                    <textarea className="textarea" value={journalForm.description} onChange={(event) => setJournalForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} placeholder="Journal scope and overview" />
                  </label>
                  <label className="field shell-form-grid-full">
                    <span>Required policy keys</span>
                    <input className="input" value={journalForm.requiredPolicyKeys} disabled={newJournalMode} onChange={(event) => setJournalForm((prev) => ({ ...prev, requiredPolicyKeys: event.target.value }))} placeholder="ethics, peer-review, authorship" />
                  </label>
                </div>
                <div className="shell-form-actions">
                  {newJournalMode ? <button type="button" className="button button-ghost compact" onClick={() => { setNewJournalMode(false); populateJournalForm(journalDetail); }}>Cancel</button> : null}
                  <button type="submit" className="button button-primary compact" disabled={saving}>{saving ? "Saving..." : newJournalMode ? "Create Journal" : "Save Journal"}</button>
                </div>
              </form>
            ) : null}

            {activeTab === "submissions" ? (
              <form className="shell-form-section" onSubmit={saveSubmissionDraft}>
                <div className="shell-form-section-header">
                  <div>
                    <h3>Edit Draft Submission</h3>
                    <p className="muted">Select a draft row, then update manuscript metadata.</p>
                  </div>
                  <button type="button" className="button compact" onClick={createDraft} disabled={saving || !selectedJournalSlug}>Create Draft</button>
                </div>
                <div className="shell-form-grid">
                  <label className="field">
                    <span>Submission ID</span>
                    <input className="input" value={submissionForm.id} readOnly placeholder="Select a draft from the table" />
                  </label>
                  <label className="field">
                    <span>Article Type</span>
                    <input className="input" value={submissionForm.articleType} onChange={(event) => setSubmissionForm((prev) => ({ ...prev, articleType: event.target.value }))} placeholder="Research Article" required={!!submissionForm.id} />
                  </label>
                  <label className="field shell-form-grid-full">
                    <span>Manuscript Title</span>
                    <input className="input" value={submissionForm.manuscriptTitle} onChange={(event) => setSubmissionForm((prev) => ({ ...prev, manuscriptTitle: event.target.value }))} placeholder="Title" required={!!submissionForm.id} />
                  </label>
                  <label className="field shell-form-grid-full">
                    <span>Abstract</span>
                    <textarea className="textarea" value={submissionForm.abstractText} onChange={(event) => setSubmissionForm((prev) => ({ ...prev, abstractText: event.target.value }))} rows={4} required={!!submissionForm.id} />
                  </label>
                  <label className="field shell-form-grid-full">
                    <span>Keywords</span>
                    <input className="input" value={submissionForm.keywordsText} onChange={(event) => setSubmissionForm((prev) => ({ ...prev, keywordsText: event.target.value }))} placeholder="keyword one, keyword two" />
                  </label>
                </div>
                <div className="shell-form-actions">
                  <button type="submit" className="button button-primary compact" disabled={saving || !submissionForm.id}>{saving ? "Saving..." : "Update Draft"}</button>
                </div>
              </form>
            ) : null}

            {activeTab === "volumes" ? (
              <form className="shell-form-section" onSubmit={createVolume}>
                <div className="shell-form-section-header"><h3>Create Volume</h3></div>
                <div className="shell-form-grid">
                  <label className="field"><span>Year</span><input className="input" type="number" min={1900} value={volumeForm.year} onChange={(event) => setVolumeForm((prev) => ({ ...prev, year: event.target.value }))} required /></label>
                  <label className="field"><span>Number</span><input className="input" type="number" min={1} value={volumeForm.number} onChange={(event) => setVolumeForm((prev) => ({ ...prev, number: event.target.value }))} required /></label>
                </div>
                <div className="shell-form-actions"><button type="submit" className="button button-primary compact" disabled={saving || !selectedJournalSlug}>Create Volume</button></div>
              </form>
            ) : null}

            {activeTab === "issues" ? (
              <form className="shell-form-section" onSubmit={createIssue}>
                <div className="shell-form-section-header"><h3>Create Issue</h3></div>
                <div className="shell-form-grid">
                  <label className="field"><span>Volume</span><select className="select" value={issueForm.volumeId} onChange={(event) => setIssueForm((prev) => ({ ...prev, volumeId: event.target.value }))} required><option value="">Select volume</option>{volumes.map((volume) => <option key={volume.id} value={volume.id}>Vol {volume.number} / {volume.year}</option>)}</select></label>
                  <label className="field"><span>Issue Number</span><input className="input" type="number" min={1} value={issueForm.number} onChange={(event) => setIssueForm((prev) => ({ ...prev, number: event.target.value }))} required /></label>
                  <label className="field"><span>Publication Date</span><input className="input" type="date" value={issueForm.publicationDate} onChange={(event) => setIssueForm((prev) => ({ ...prev, publicationDate: event.target.value }))} /></label>
                  <label className="field shell-form-grid-full"><span>Title</span><input className="input" value={issueForm.title} onChange={(event) => setIssueForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Special issue title" /></label>
                </div>
                <div className="shell-form-actions"><button type="submit" className="button button-primary compact" disabled={saving || !issueForm.volumeId}>Create Issue</button></div>
              </form>
            ) : null}
          </section>
        </>
      )}
      {toast ? <ToastNotification open={!!toast} tone={toast.tone} message={toast.message} onClose={() => setToast(null)} /> : null}
    </AppShell>
  );
}

function DataTable({
  activeTab,
  journals,
  submissions,
  volumes,
  issues,
  articles,
  allVolumes,
  articleIssueDrafts,
  saving,
  onEditJournal,
  onEditSubmission,
  onArticleIssueChange,
  onAssignIssue,
}: {
  activeTab: EntityTab;
  journals: Journal[];
  submissions: Submission[];
  volumes: Volume[];
  issues: Issue[];
  articles: Article[];
  allVolumes: Volume[];
  articleIssueDrafts: Record<string, string>;
  saving: boolean;
  onEditJournal: (journal: Journal) => void;
  onEditSubmission: (submission: Submission) => void;
  onArticleIssueChange: (articleId: string, issueId: string) => void;
  onAssignIssue: (articleId: string) => void;
}) {
  if (activeTab === "journals") {
    return (
      <table className="shell-table">
        <thead><tr><th>Journal</th><th>Slug</th><th>Timezone</th><th>Description</th><th>Action</th></tr></thead>
        <tbody>
          {journals.map((journal) => (
            <tr key={journal.id}><td><strong>{journal.title}</strong></td><td>{journal.slug}</td><td>{journal.timezone}</td><td>{journal.description || "-"}</td><td><button type="button" className="button compact" onClick={() => onEditJournal(journal)}>Edit</button></td></tr>
          ))}
          {journals.length === 0 ? <tr><td colSpan={5} className="shell-table-empty">No journals match the current filters.</td></tr> : null}
        </tbody>
      </table>
    );
  }
  if (activeTab === "submissions") {
    return (
      <table className="shell-table">
        <thead><tr><th>Manuscript</th><th>Status</th><th>Tracking</th><th>Created</th><th>Submitted</th><th>Action</th></tr></thead>
        <tbody>
          {submissions.map((submission) => (
            <tr key={submission.id}>
              <td><strong>{submission.manuscriptTitle || "Untitled draft"}</strong><br /><span className="muted">{submission.articleType || submission.id}</span></td>
              <td><StatusBadge label={submission.status} tone={toneForStatus(submission.status)} /></td>
              <td>{submission.trackingNumber || "-"}</td>
              <td>{compactDate(submission.createdAt)}</td>
              <td>{compactDate(submission.submittedAt)}</td>
              <td><button type="button" className="button compact" onClick={() => onEditSubmission(submission)} disabled={submission.status !== "DRAFT"}>Edit Draft</button></td>
            </tr>
          ))}
          {submissions.length === 0 ? <tr><td colSpan={6} className="shell-table-empty">No submissions match the current filters.</td></tr> : null}
        </tbody>
      </table>
    );
  }
  if (activeTab === "volumes") {
    return (
      <table className="shell-table">
        <thead><tr><th>Year</th><th>Volume Number</th><th>ID</th></tr></thead>
        <tbody>
          {volumes.map((volume) => <tr key={volume.id}><td>{volume.year}</td><td>{volume.number}</td><td>{volume.id}</td></tr>)}
          {volumes.length === 0 ? <tr><td colSpan={3} className="shell-table-empty">No volumes match the current filters.</td></tr> : null}
        </tbody>
      </table>
    );
  }
  if (activeTab === "issues") {
    return (
      <table className="shell-table">
        <thead><tr><th>Issue</th><th>Volume</th><th>Status</th><th>Publication Date</th><th>ID</th></tr></thead>
        <tbody>
          {issues.map((issue) => {
            const volume = allVolumes.find((item) => item.id === issue.volumeId);
            return <tr key={issue.id}><td><strong>Issue {issue.number}</strong><br /><span className="muted">{issue.title || "Untitled"}</span></td><td>{volume ? `Vol ${volume.number} / ${volume.year}` : issue.volumeId}</td><td><StatusBadge label={issue.status || "Draft"} tone="neutral" /></td><td>{compactDate(issue.publicationDate)}</td><td>{issue.id}</td></tr>;
          })}
          {issues.length === 0 ? <tr><td colSpan={5} className="shell-table-empty">No issues match the current filters.</td></tr> : null}
        </tbody>
      </table>
    );
  }
  return (
    <table className="shell-table">
      <thead><tr><th>Article</th><th>Status</th><th>Tracking</th><th>Issue</th><th>Published</th><th>Action</th></tr></thead>
      <tbody>
        {articles.map((article) => (
          <tr key={article.id}>
            <td><strong>{article.title}</strong><br /><span className="muted">{article.id}</span></td>
            <td><StatusBadge label={article.status} tone={toneForStatus(article.status)} /></td>
            <td>{article.submission?.trackingNumber || "-"}</td>
            <td>
              <select className="select compact-select" value={articleIssueDrafts[article.id] ?? article.issueId ?? ""} onChange={(event) => onArticleIssueChange(article.id, event.target.value)}>
                <option value="">Unassigned</option>
                {issues.map((issue) => {
                  const volume = allVolumes.find((item) => item.id === issue.volumeId);
                  return <option key={issue.id} value={issue.id}>{volume ? `V${volume.number}/${volume.year}` : "Vol"} · Issue {issue.number}</option>;
                })}
              </select>
            </td>
            <td>{compactDate(article.publishedAt)}</td>
            <td><button type="button" className="button compact" onClick={() => onAssignIssue(article.id)} disabled={saving || !articleIssueDrafts[article.id]}>Assign Issue</button></td>
          </tr>
        ))}
        {articles.length === 0 ? <tr><td colSpan={6} className="shell-table-empty">No articles match the current filters.</td></tr> : null}
      </tbody>
    </table>
  );
}
