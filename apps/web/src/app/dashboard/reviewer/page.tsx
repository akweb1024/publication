"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiJson } from "../../../lib/clientApi";
import { errorMessage } from "../../../lib/errorMessage";
import ErrorAlert from "../../../components/ErrorAlert";
import AppShell from "../../../components/dashboard/AppShell";
import StatusBadge from "../../../components/dashboard/StatusBadge";
import ToastNotification from "../../../components/dashboard/ToastNotification";
import SkeletonBlock from "../../../components/dashboard/SkeletonBlock";
import ContextualHelp from "../../../components/dashboard/ContextualHelp";

type ReviewerAssignment = {
  id: string;
  status: string;
  invitedAt: string;
  respondBy?: string | null;
  dueAt?: string | null;
  reviewRound: {
    submissionId: string;
    roundNumber: number;
    submission: {
      trackingNumber?: string | null;
      manuscriptTitle?: string | null;
    };
  };
};

const STATUS_TONE_MAP: Record<string, "ok" | "warn" | "danger" | "info" | "neutral"> = {
  INVITED: "info",
  ACCEPTED: "ok",
  OVERDUE: "danger",
  COMPLETED: "ok",
  DECLINED: "neutral",
};

export default function ReviewerDashboardPage() {
  const [items, setItems] = useState<ReviewerAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<string, { recommendation: "ACCEPT" | "MINOR" | "MAJOR" | "REJECT"; commentsToAuthor: string; commentsToEditor: string }>
  >({});

  async function loadAssignments() {
    const res = await apiJson<{ items: ReviewerAssignment[] }>("/reviewer/assignments", { method: "GET" });
    setItems(res.items);
  }

  useEffect(() => {
    let mounted = true;
    async function boot() {
      setLoading(true);
      setError(null);
      try {
        await apiJson("/auth/session", { method: "GET" });
        if (!mounted) return;
        await loadAssignments();
      } catch (err: unknown) {
        if (!mounted) return;
        setError(errorMessage(err) || "Failed to load reviewer assignments");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();
    return () => {
      mounted = false;
    };
  }, []);

  async function respond(assignmentId: string, response: "accept" | "decline") {
    setBusyId(assignmentId);
    setError(null);
    setToast(null);
    try {
      await apiJson(`/reviewer/assignments/${assignmentId}/respond`, {
        method: "POST",
        body: JSON.stringify({ response }),
      });
      await loadAssignments();
      setToast({ tone: "success", message: response === "accept" ? "Assignment accepted." : "Assignment declined." });
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to update assignment");
      setToast({ tone: "error", message: "Failed to update assignment." });
    } finally {
      setBusyId(null);
    }
  }

  function draftFor(assignmentId: string) {
    return (
      reviewDrafts[assignmentId] ?? { recommendation: "MAJOR", commentsToAuthor: "", commentsToEditor: "" }
    );
  }

  async function submitReview(assignmentId: string) {
    const draft = draftFor(assignmentId);
    if (!draft.commentsToAuthor.trim()) {
      setError("Comments to author are required.");
      setToast({ tone: "error", message: "Comments to author are required." });
      return;
    }
    setBusyId(assignmentId);
    setError(null);
    setToast(null);
    try {
      await apiJson(`/reviewer/assignments/${assignmentId}/submit-review`, {
        method: "POST",
        body: JSON.stringify({
          recommendation: draft.recommendation,
          commentsToAuthor: draft.commentsToAuthor.trim(),
          commentsToEditor: draft.commentsToEditor.trim() || undefined,
        }),
      });
      await loadAssignments();
      setToast({ tone: "success", message: "Review submitted." });
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to submit review");
      setToast({ tone: "error", message: "Failed to submit review." });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Loading..."
        sectionLabel="Peer Review"
        breadcrumbItems={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reviewer", href: "/dashboard/reviewer" }]}
        helpTopic="Reviewer Workspace"
      >
        <SkeletonBlock height={44} />
        <SkeletonBlock height={120} />
        <SkeletonBlock height={180} />
      </AppShell>
    );
  }

  const invitedCount = items.filter((i) => i.status === "INVITED").length;
  const acceptedCount = items.filter((i) => i.status === "ACCEPTED").length;
  const overdueCount = items.filter((i) => i.status === "OVERDUE").length;

  return (
    <AppShell
      title="Reviewer Assignments"
      sectionLabel="Peer Review"
      description="Respond quickly to invitations and keep review deadlines on track."
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Reviewer", href: "/dashboard/reviewer" },
      ]}
      workflowSteps={[
        { label: "Accept Invitation", state: invitedCount > 0 ? "current" : "complete" },
        { label: "Read Manuscript", state: acceptedCount > 0 ? "current" : "upcoming" },
        { label: "Write Review", state: "upcoming" },
        { label: "Submit Review", state: "upcoming" },
      ]}
      quickActions={[
        { label: "Back to Dashboard", href: "/dashboard", variant: "ghost" },
      ]}
      helpTopic="Reviewer Workspace"
    >
      {/* Stats */}
      <div className="shell-stats-grid">
        <div className="shell-stat-card">
          <span className="shell-stat-icon">📨</span>
          <p className="shell-stat-label">Invitations</p>
          <p className="shell-stat-value">{invitedCount}</p>
          {invitedCount > 0 ? <p className="shell-stat-hint" style={{ color: "var(--warn)" }}>Action needed</p> : null}
        </div>
        <div className="shell-stat-card">
          <span className="shell-stat-icon">✅</span>
          <p className="shell-stat-label">Accepted</p>
          <p className="shell-stat-value">{acceptedCount}</p>
        </div>
        <div className="shell-stat-card">
          <span className="shell-stat-icon">⚠️</span>
          <p className="shell-stat-label">Overdue</p>
          <p className="shell-stat-value">{overdueCount}</p>
          {overdueCount > 0 ? <p className="shell-stat-hint" style={{ color: "var(--danger)" }}>Submit immediately</p> : null}
        </div>
      </div>

      {error ? <ErrorAlert message={error} /> : null}

      {/* Assignments */}
      <div className="shell-form-section">
        <div className="shell-form-section-header">
          <h3>📋 My Assignments</h3>
          <span className="muted">{items.length} total</span>
        </div>

        {items.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 12 }}>
            <h3>No reviewer assignments yet</h3>
            <p className="muted">When an editor invites you to review a manuscript, it will appear here.</p>
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {items.map((item) => {
            const canRespond = item.status === "INVITED";
            const canSubmitReview = item.status === "ACCEPTED" || item.status === "OVERDUE";
            const draft = draftFor(item.id);
            return (
              <div key={item.id} className="shell-section-card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: "1rem" }}>{item.reviewRound.submission.trackingNumber ?? "(submission)"}</p>
                    <p>{item.reviewRound.submission.manuscriptTitle ?? "Untitled manuscript"}</p>
                    <p className="muted">
                      Round {item.reviewRound.roundNumber} • Invited {new Date(item.invitedAt).toLocaleString()}
                      {item.respondBy ? ` • Respond by ${new Date(item.respondBy).toLocaleString()}` : ""}
                      {item.dueAt ? ` • Due ${new Date(item.dueAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <StatusBadge label={item.status} tone={STATUS_TONE_MAP[item.status] ?? "neutral"} />
                </div>

                {/* Respond buttons */}
                {canRespond && (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="button compact button-primary"
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => respond(item.id, "accept")}
                    >
                      {busyId === item.id ? "Saving..." : "Accept Invitation"}
                    </button>
                    <button
                      className="button button-ghost compact"
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => respond(item.id, "decline")}
                    >
                      Decline
                    </button>
                    <ContextualHelp text="Accepting means you commit to reviewing the manuscript by the due date. Declining will notify the editor to find another reviewer." />
                  </div>
                )}

                {/* Submit review form */}
                {canSubmitReview && (
                  <div className="shell-form-section" style={{ marginTop: 10, borderLeft: "3px solid #0d9488" }}>
                    <h3 style={{ fontSize: "0.95rem" }}>📝 Submit Review <ContextualHelp text="Write your review with comments to the author (required) and confidential comments to the editor (optional). Select a recommendation that reflects your assessment of the manuscript quality." /></h3>
                    <div className="shell-form-grid" style={{ marginTop: 8 }}>
                      <div className="field">
                        <label htmlFor={`recommendation-${item.id}`}>Recommendation <span className="shell-field-required">*</span></label>
                        <select
                          id={`recommendation-${item.id}`}
                          className="select"
                          value={draft.recommendation}
                          onChange={(event) =>
                            setReviewDrafts((prev) => ({
                              ...prev,
                              [item.id]: { ...draft, recommendation: event.target.value as typeof draft.recommendation },
                            }))
                          }
                        >
                          <option value="ACCEPT">Accept — Manuscript is suitable for publication</option>
                          <option value="MINOR">Minor revision — Small changes needed</option>
                          <option value="MAJOR">Major revision — Significant changes required</option>
                          <option value="REJECT">Reject — Not suitable for publication</option>
                        </select>
                      </div>
                    </div>
                    <div className="field" style={{ marginTop: 8 }}>
                      <label htmlFor={`comments-author-${item.id}`}>Comments to Author <span className="shell-field-required">*</span></label>
                      <textarea
                        id={`comments-author-${item.id}`}
                        className="input"
                        rows={4}
                        value={draft.commentsToAuthor}
                        onChange={(event) =>
                          setReviewDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, commentsToAuthor: event.target.value },
                          }))
                        }
                        placeholder="Provide detailed feedback for the author..."
                      />
                      <p className="shell-field-hint">These comments will be shared with the manuscript author. Required.</p>
                    </div>
                    <div className="field" style={{ marginTop: 8 }}>
                      <label htmlFor={`comments-editor-${item.id}`}>Confidential Comments to Editor (optional)</label>
                      <textarea
                        id={`comments-editor-${item.id}`}
                        className="input"
                        rows={3}
                        value={draft.commentsToEditor}
                        onChange={(event) =>
                          setReviewDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, commentsToEditor: event.target.value },
                          }))
                        }
                        placeholder="Private feedback visible only to the handling editor..."
                      />
                      <p className="shell-field-hint">Optional. These comments are visible only to the editor, not the author.</p>
                    </div>
                    <div className="shell-form-actions">
                      <button
                        className="button button-primary compact"
                        type="button"
                        disabled={busyId !== null || !draft.commentsToAuthor.trim()}
                        onClick={() => submitReview(item.id)}
                      >
                        {busyId === item.id ? "Submitting..." : "Submit Review"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ToastNotification open={!!toast} tone={toast?.tone ?? "info"} message={toast?.message ?? ""} onClose={() => setToast(null)} />
    </AppShell>
  );
}
