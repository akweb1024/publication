"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson } from "../../../lib/clientApi";
import { errorMessage } from "../../../lib/errorMessage";
import ErrorAlert from "../../../components/ErrorAlert";
import AppShell from "../../../components/dashboard/AppShell";
import SkeletonBlock from "../../../components/dashboard/SkeletonBlock";
import StatusBadge from "../../../components/dashboard/StatusBadge";
import ToastNotification from "../../../components/dashboard/ToastNotification";
import ConfirmationModal from "../../../components/dashboard/ConfirmationModal";

type Journal = { id: string; slug: string; title: string };
type ProductionStatus = "NOT_STARTED" | "IN_PRODUCTION" | "AUTHOR_PROOF" | "FINAL_QA" | "READY_FOR_PUBLICATION";
type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
type TaskType = "COPYEDIT" | "TYPESET" | "AUTHOR_PROOF" | "EDITOR_PROOF" | "DOI_METADATA" | "FINAL_QA";
type ProofStatus = "DRAFT" | "SENT_TO_AUTHOR" | "AUTHOR_APPROVED" | "EDITOR_APPROVED" | "CHANGES_REQUESTED";
type ProductionArticle = {
  id: string;
  title: string;
  status: string;
  productionStatus: ProductionStatus;
  issueId: string | null;
  submission: { trackingNumber: string | null; manuscriptTitle: string | null };
  taskSummary: { total: number; done: number; blocked: number };
  latestProofRound: { id: string; roundNumber: number; status: ProofStatus } | null;
};
type ProductionTask = {
  id: string;
  type: TaskType;
  status: TaskStatus;
  title: string;
  notes: string | null;
  assignedToUserId: string | null;
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  assignedTo?: { id: string; name: string; email: string } | null;
  completedBy?: { id: string; name: string; email: string } | null;
};
type ProofAnnotation = {
  id: string;
  pageNumber: number | null;
  anchorText: string | null;
  commentText: string;
  resolvedAt: string | null;
  createdAt: string;
  createdBy: { name: string; email: string };
};
type ProofRound = {
  id: string;
  roundNumber: number;
  status: ProofStatus;
  proofFileId: string | null;
  authorApprovedAt: string | null;
  editorApprovedAt: string | null;
  notes: string | null;
  annotations: ProofAnnotation[];
};
type ArticleProductionDetail = {
  article: ProductionArticle & { journalId: string };
  tasks: ProductionTask[];
  proofRounds: ProofRound[];
};

const TASK_STATUS_OPTIONS: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"];

function productionTone(status: ProductionStatus) {
  if (status === "READY_FOR_PUBLICATION") return "ok" as const;
  if (status === "FINAL_QA") return "warn" as const;
  if (status === "AUTHOR_PROOF") return "info" as const;
  if (status === "IN_PRODUCTION") return "under-review" as const;
  return "neutral" as const;
}

function taskTone(status: TaskStatus) {
  if (status === "DONE") return "ok" as const;
  if (status === "BLOCKED") return "danger" as const;
  if (status === "IN_PROGRESS") return "info" as const;
  if (status === "CANCELLED") return "neutral" as const;
  return "draft" as const;
}

function proofTone(status: ProofStatus) {
  if (status === "EDITOR_APPROVED") return "ok" as const;
  if (status === "CHANGES_REQUESTED") return "warn" as const;
  if (status === "AUTHOR_APPROVED") return "info" as const;
  return "neutral" as const;
}

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString();
}

export default function ProductionPipelinePage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [journalSlug, setJournalSlug] = useState("");
  const [articles, setArticles] = useState<ProductionArticle[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [detail, setDetail] = useState<ArticleProductionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const [proofFileId, setProofFileId] = useState("");
  const [proofNotes, setProofNotes] = useState("");
  const [annotationText, setAnnotationText] = useState("");
  const [confirmReadyArticle, setConfirmReadyArticle] = useState<string | null>(null);

  const selectedArticle = useMemo(
    () => articles.find((article) => article.id === selectedArticleId) ?? articles[0] ?? null,
    [articles, selectedArticleId]
  );
  const selectedJournalTitle = useMemo(
    () => journals.find((journal) => journal.slug === journalSlug)?.title ?? "",
    [journals, journalSlug]
  );
  const readyCount = useMemo(() => articles.filter((article) => article.productionStatus === "READY_FOR_PUBLICATION").length, [articles]);
  const blockedCount = useMemo(() => articles.reduce((sum, article) => sum + article.taskSummary.blocked, 0), [articles]);
  const latestProof = detail?.proofRounds[0] ?? null;

  const loadDetail = useCallback(async (articleId: string) => {
    const next = await apiJson<ArticleProductionDetail>(`/articles/${encodeURIComponent(articleId)}/production`, { method: "GET" });
    setDetail(next);
  }, []);

  const loadProductionData = useCallback(async (slug: string, preferredArticleId?: string) => {
    const res = await apiJson<{ items: ProductionArticle[] }>(`/journals/${encodeURIComponent(slug)}/production/articles`, { method: "GET" });
    setArticles(res.items);
    const nextArticleId = preferredArticleId && res.items.some((article) => article.id === preferredArticleId)
      ? preferredArticleId
      : res.items[0]?.id ?? "";
    setSelectedArticleId(nextArticleId);
    if (nextArticleId) {
      await loadDetail(nextArticleId);
    } else {
      setDetail(null);
    }
  }, [loadDetail]);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      setLoading(true);
      setError(null);
      try {
        await apiJson("/auth/session", { method: "GET" });
        const journalRes = await apiJson<{ items: Journal[] }>("/journals", { method: "GET" });
        if (!mounted) return;
        setJournals(journalRes.items);
        const first = journalRes.items[0]?.slug ?? "";
        setJournalSlug(first);
        if (first) await loadProductionData(first);
      } catch (err: unknown) {
        if (mounted) setError(errorMessage(err) || "Failed to load production pipeline");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();
    return () => {
      mounted = false;
    };
  }, [loadProductionData]);

  async function onJournalChange(nextSlug: string) {
    setJournalSlug(nextSlug);
    setError(null);
    try {
      await loadProductionData(nextSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to load production pipeline");
      setToast({ tone: "error", message: "Failed to load production pipeline." });
    }
  }

  async function selectArticle(articleId: string) {
    setSelectedArticleId(articleId);
    setError(null);
    try {
      await loadDetail(articleId);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to load article production detail");
    }
  }

  async function startPipeline(articleId: string) {
    setBusyId(articleId);
    setError(null);
    try {
      await apiJson(`/articles/${encodeURIComponent(articleId)}/production/start`, { method: "POST", body: JSON.stringify({}) });
      setToast({ tone: "success", message: "Production pipeline started." });
      await loadProductionData(journalSlug, articleId);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to start production pipeline");
      setToast({ tone: "error", message: "Failed to start production pipeline." });
    } finally {
      setBusyId(null);
    }
  }

  async function updateTask(taskId: string, status: TaskStatus) {
    setBusyId(taskId);
    setError(null);
    try {
      await apiJson(`/production/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setToast({ tone: "success", message: "Production task updated." });
      await loadProductionData(journalSlug, selectedArticleId);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to update production task");
      setToast({ tone: "error", message: "Failed to update production task." });
    } finally {
      setBusyId(null);
    }
  }

  async function createProofRound(articleId: string) {
    setBusyId("proof-round");
    setError(null);
    try {
      await apiJson(`/articles/${encodeURIComponent(articleId)}/proof-rounds`, {
        method: "POST",
        body: JSON.stringify({
          proofFileId: proofFileId.trim() || undefined,
          notes: proofNotes.trim() || undefined,
        }),
      });
      setProofFileId("");
      setProofNotes("");
      setToast({ tone: "success", message: "Proof round created." });
      await loadProductionData(journalSlug, articleId);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to create proof round");
      setToast({ tone: "error", message: "Failed to create proof round." });
    } finally {
      setBusyId(null);
    }
  }

  async function updateProofStatus(proofRoundId: string, status: ProofStatus) {
    setBusyId(proofRoundId);
    setError(null);
    try {
      await apiJson(`/proof-rounds/${encodeURIComponent(proofRoundId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setToast({ tone: "success", message: "Proof status updated." });
      await loadProductionData(journalSlug, selectedArticleId);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to update proof status");
      setToast({ tone: "error", message: "Failed to update proof status." });
    } finally {
      setBusyId(null);
    }
  }

  async function approveProof(proofRoundId: string) {
    setBusyId(proofRoundId);
    setError(null);
    try {
      await apiJson(`/proof-rounds/${encodeURIComponent(proofRoundId)}/approve`, {
        method: "POST",
        body: JSON.stringify({ actor: "editor" }),
      });
      setToast({ tone: "success", message: "Proof approved by editor." });
      await loadProductionData(journalSlug, selectedArticleId);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to approve proof");
      setToast({ tone: "error", message: "Failed to approve proof." });
    } finally {
      setBusyId(null);
      setConfirmReadyArticle(null);
    }
  }

  async function createAnnotation(proofRoundId: string) {
    if (!annotationText.trim()) {
      setError("Enter a proof annotation before saving.");
      return;
    }
    setBusyId("annotation");
    setError(null);
    try {
      await apiJson(`/proof-rounds/${encodeURIComponent(proofRoundId)}/annotations`, {
        method: "POST",
        body: JSON.stringify({ commentText: annotationText.trim() }),
      });
      setAnnotationText("");
      setToast({ tone: "success", message: "Proof annotation saved." });
      await loadDetail(selectedArticleId);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to save annotation");
      setToast({ tone: "error", message: "Failed to save annotation." });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <AppShell title="Loading..." sectionLabel="Production" breadcrumbItems={[{ label: "Dashboard", href: "/dashboard" }, { label: "Production", href: "/dashboard/production" }]} helpTopic="Production Pipeline">
        <SkeletonBlock height={44} />
        <SkeletonBlock height={140} />
        <SkeletonBlock height={220} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Production Pipeline"
      sectionLabel="Production & Publishing"
      description="Move accepted articles through copyediting, layout, proofs, metadata QA, and final publication readiness."
      selectedJournalLabel={selectedJournalTitle}
      breadcrumbItems={[{ label: "Dashboard", href: "/dashboard" }, { label: "Production", href: "/dashboard/production" }]}
      journals={journals}
      selectedJournalSlug={journalSlug}
      onJournalChange={onJournalChange}
      quickActions={[
        { label: "Publishing", href: "/dashboard/publishing", variant: "ghost" },
        { label: "Accepted Papers", href: "/dashboard/publishing?status=IN_PRESS", variant: "ghost" },
      ]}
      workflowSteps={[
        { label: "Accepted", state: "complete" },
        { label: "Copyedit", state: "current" },
        { label: "Proof", state: "upcoming" },
        { label: "Final QA", state: "upcoming" },
        { label: "Ready", state: "upcoming" },
      ]}
      helpTopic="Production Pipeline"
    >
      {error ? <ErrorAlert message={error} /> : null}

      <div className="shell-stats-grid">
        <div className="shell-stat-card">
          <p className="shell-stat-label">In-Press Articles</p>
          <p className="shell-stat-value">{articles.length}</p>
        </div>
        <div className="shell-stat-card">
          <p className="shell-stat-label">Ready To Publish</p>
          <p className="shell-stat-value">{readyCount}</p>
        </div>
        <div className="shell-stat-card">
          <p className="shell-stat-label">Blocked Tasks</p>
          <p className="shell-stat-value">{blockedCount}</p>
        </div>
        <div className="shell-stat-card">
          <p className="shell-stat-label">Active Proofs</p>
          <p className="shell-stat-value">{articles.filter((article) => article.latestProofRound).length}</p>
        </div>
      </div>

      <div className="dashboard-grid-two">
        <div className="shell-table-wrap">
          <div className="shell-table-toolbar">
            <div className="shell-table-toolbar-left">
              <strong>Accepted Article Queue</strong>
              <StatusBadge label={`${articles.length}`} tone="info" />
            </div>
          </div>
          <table className="shell-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Production</th>
                <th>Tasks</th>
                <th>Proof</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id} className="shell-table-row-link" onClick={() => selectArticle(article.id)}>
                  <td>
                    <strong>{article.title}</strong>
                    <br />
                    <span className="muted">{article.submission?.trackingNumber ?? "No tracking number"}</span>
                  </td>
                  <td><StatusBadge label={article.productionStatus} tone={productionTone(article.productionStatus)} /></td>
                  <td>{article.taskSummary.done}/{article.taskSummary.total || 0}</td>
                  <td>{article.latestProofRound ? <StatusBadge label={`R${article.latestProofRound.roundNumber} ${article.latestProofRound.status}`} tone={proofTone(article.latestProofRound.status)} /> : <span className="muted">No proof</span>}</td>
                </tr>
              ))}
              {articles.length === 0 ? <tr><td colSpan={4} className="shell-table-empty">No in-press articles found.</td></tr> : null}
            </tbody>
          </table>
        </div>

        <div className="shell-form-section">
          <div className="shell-form-section-header">
            <h3>{selectedArticle?.title ?? "Article Detail"}</h3>
            {selectedArticle ? <StatusBadge label={selectedArticle.productionStatus} tone={productionTone(selectedArticle.productionStatus)} /> : null}
          </div>
          {selectedArticle && detail ? (
            <div className="shell-step-form">
              <p className="muted">{selectedArticle.submission?.trackingNumber ?? "No tracking number"}</p>
              {selectedArticle.productionStatus === "NOT_STARTED" ? (
                <button type="button" className="button button-primary compact" disabled={busyId !== null} onClick={() => startPipeline(selectedArticle.id)}>
                  {busyId === selectedArticle.id ? "Starting..." : "Start Production Pipeline"}
                </button>
              ) : null}

              <div className="shell-table-wrap">
                <table className="shell-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Due</th>
                      <th>Status</th>
                      <th>Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.tasks.map((task) => (
                      <tr key={task.id}>
                        <td>
                          <strong>{task.title}</strong>
                          <br />
                          <span className="muted">{task.type}</span>
                        </td>
                        <td>{formatDate(task.dueAt)}</td>
                        <td><StatusBadge label={task.status} tone={taskTone(task.status)} /></td>
                        <td>
                          <select
                            className="select"
                            value={task.status}
                            disabled={busyId !== null}
                            onChange={(event) => updateTask(task.id, event.target.value as TaskStatus)}
                          >
                            {TASK_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                    {detail.tasks.length === 0 ? <tr><td colSpan={4} className="shell-table-empty">Start production to create default tasks.</td></tr> : null}
                  </tbody>
                </table>
              </div>

              <div className="shell-form-section" style={{ padding: 14 }}>
                <div className="shell-form-section-header">
                  <h3>Proof Rounds</h3>
                  {latestProof ? <StatusBadge label={`Round ${latestProof.roundNumber}`} tone={proofTone(latestProof.status)} /> : null}
                </div>
                <div className="shell-form-grid">
                  <div className="field">
                    <label htmlFor="proof-file">Proof file id</label>
                    <input id="proof-file" className="input" value={proofFileId} onChange={(event) => setProofFileId(event.target.value)} placeholder="Optional stored file id" />
                  </div>
                  <div className="field">
                    <label htmlFor="proof-notes">Proof notes</label>
                    <input id="proof-notes" className="input" value={proofNotes} onChange={(event) => setProofNotes(event.target.value)} placeholder="Optional notes for this proof" />
                  </div>
                </div>
                <div className="shell-form-actions">
                  <button type="button" className="button compact" disabled={busyId !== null} onClick={() => createProofRound(selectedArticle.id)}>
                    {busyId === "proof-round" ? "Creating..." : "Create Proof Round"}
                  </button>
                </div>

                {latestProof ? (
                  <div className="shell-step-form" style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <StatusBadge label={latestProof.status} tone={proofTone(latestProof.status)} />
                      <button type="button" className="button button-ghost compact" disabled={busyId !== null} onClick={() => updateProofStatus(latestProof.id, "SENT_TO_AUTHOR")}>Send To Author</button>
                      <button type="button" className="button button-ghost compact" disabled={busyId !== null} onClick={() => updateProofStatus(latestProof.id, "CHANGES_REQUESTED")}>Request Changes</button>
                      <button type="button" className="button button-primary compact" disabled={busyId !== null} onClick={() => setConfirmReadyArticle(latestProof.id)}>Approve Proof</button>
                    </div>
                    <div className="field">
                      <label htmlFor="proof-annotation">Add proof annotation</label>
                      <textarea id="proof-annotation" rows={3} value={annotationText} onChange={(event) => setAnnotationText(event.target.value)} />
                    </div>
                    <button type="button" className="button compact" disabled={busyId !== null || !annotationText.trim()} onClick={() => createAnnotation(latestProof.id)}>Save Annotation</button>
                    {latestProof.annotations.length > 0 ? (
                      <div className="shell-activity-list">
                        {latestProof.annotations.map((annotation) => (
                          <div key={annotation.id} className="shell-activity-item">
                            <span className="shell-activity-dot" style={{ background: "#0d9488" }} />
                            <div>
                              <strong>{annotation.createdBy.name}</strong>
                              <p className="muted" style={{ margin: "4px 0" }}>{annotation.commentText}</p>
                              <span className="shell-activity-time">{new Date(annotation.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : <p className="muted">Select an in-press article to manage production.</p>}
        </div>
      </div>

      <ToastNotification open={!!toast} tone={toast?.tone ?? "info"} message={toast?.message ?? ""} onClose={() => setToast(null)} />
      <ConfirmationModal
        open={!!confirmReadyArticle}
        title="Approve Proof"
        description="This records editor proof approval. When all required production tasks are done, the article becomes ready for publication."
        confirmLabel="Approve"
        busy={busyId !== null}
        onCancel={() => setConfirmReadyArticle(null)}
        onConfirm={() => {
          if (confirmReadyArticle) void approveProof(confirmReadyArticle);
        }}
      />
    </AppShell>
  );
}
