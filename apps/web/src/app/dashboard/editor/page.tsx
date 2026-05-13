"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiJson } from "../../../lib/clientApi";
import { errorMessage } from "../../../lib/errorMessage";
import ErrorAlert from "../../../components/ErrorAlert";
import AppShell from "../../../components/dashboard/AppShell";
import StatusBadge from "../../../components/dashboard/StatusBadge";
import ToastNotification from "../../../components/dashboard/ToastNotification";
import SkeletonBlock from "../../../components/dashboard/SkeletonBlock";
import ContextualHelp from "../../../components/dashboard/ContextualHelp";

type Journal = { id: string; slug: string; title: string };
type QueueItem = {
  id: string;
  status: string;
  trackingNumber?: string | null;
  manuscriptTitle?: string | null;
  createdAt: string;
  submittedAt?: string | null;
  latestReviewRoundId?: string | null;
  latestReviewRoundNumber?: number | null;
  activeEditorAssignments?: number;
  reviewerInvitesCount?: number;
  reviewerPendingCount?: number;
  reviewerAcceptedCount?: number;
  nearestRespondBy?: string | null;
  nearestDueAt?: string | null;
};
type EditorCandidate = { id: string; name: string; email: string; roles: string[] };
type ReviewerCandidate = { id: string; name: string; email: string };
type DecisionType = "DESK_REJECT" | "REVISE_MAJOR" | "REVISE_MINOR" | "ACCEPT" | "REJECT";

const STATUS_OPTIONS = [
  "",
  "SUBMITTED",
  "TRIAGE",
  "EDITOR_ASSIGNED",
  "UNDER_REVIEW",
  "REVISION_REQUESTED",
  "REVISED_SUBMITTED",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
] as const;
type SortOption = "DUE_SOONEST" | "RESPOND_SOONEST" | "NEWEST" | "OLDEST";

const STATUS_TONE_MAP: Record<string, "ok" | "warn" | "danger" | "info" | "neutral" | "submitted" | "under-review" | "accepted" | "rejected" | "revision" | "draft"> = {
  SUBMITTED: "submitted",
  TRIAGE: "info",
  EDITOR_ASSIGNED: "info",
  UNDER_REVIEW: "under-review",
  REVISION_REQUESTED: "revision",
  REVISED_SUBMITTED: "revision",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  WITHDRAWN: "neutral",
};

export default function EditorialQueuePage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [selectedJournal, setSelectedJournal] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<(typeof STATUS_OPTIONS)[number]>("");
  const [selectedSort, setSelectedSort] = useState<SortOption>("DUE_SOONEST");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [editors, setEditors] = useState<EditorCandidate[]>([]);
  const [reviewers, setReviewers] = useState<ReviewerCandidate[]>([]);
  const [assignEditorBySubmission, setAssignEditorBySubmission] = useState<Record<string, string>>({});
  const [inviteReviewerBySubmission, setInviteReviewerBySubmission] = useState<Record<string, string>>({});
  const [respondByBySubmission, setRespondByBySubmission] = useState<Record<string, string>>({});
  const [dueAtBySubmission, setDueAtBySubmission] = useState<Record<string, string>>({});
  const [decisionBySubmission, setDecisionBySubmission] = useState<Record<string, DecisionType>>({});
  const [decisionLetterBySubmission, setDecisionLetterBySubmission] = useState<Record<string, string>>({});
  const [decisionNoteBySubmission, setDecisionNoteBySubmission] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);

  const selectedJournalTitle = useMemo(
    () => journals.find((journal) => journal.slug === selectedJournal)?.title ?? selectedJournal,
    [journals, selectedJournal]
  );
  const sortedItems = useMemo(() => {
    const itemsCopy = [...items];
    if (selectedSort === "NEWEST") {
      return itemsCopy.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    }
    if (selectedSort === "OLDEST") {
      return itemsCopy.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
    }
    if (selectedSort === "RESPOND_SOONEST") {
      return itemsCopy.sort((left, right) => {
        const leftTs = left.nearestRespondBy ? new Date(left.nearestRespondBy).getTime() : Number.POSITIVE_INFINITY;
        const rightTs = right.nearestRespondBy ? new Date(right.nearestRespondBy).getTime() : Number.POSITIVE_INFINITY;
        if (leftTs === rightTs) return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        return leftTs - rightTs;
      });
    }
    return itemsCopy.sort((left, right) => {
      const leftTs = left.nearestDueAt ? new Date(left.nearestDueAt).getTime() : Number.POSITIVE_INFINITY;
      const rightTs = right.nearestDueAt ? new Date(right.nearestDueAt).getTime() : Number.POSITIVE_INFINITY;
      if (leftTs === rightTs) return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      return leftTs - rightTs;
    });
  }, [items, selectedSort]);

  async function loadQueue(journalSlug: string, status: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const data = await apiJson<{ items: QueueItem[] }>(`/journals/${encodeURIComponent(journalSlug)}/editor/queue${query}`, {
      method: "GET",
    });
    setItems(data.items);
  }

  async function loadCandidates(journalSlug: string) {
    const data = await apiJson<{ editors: EditorCandidate[]; reviewers: ReviewerCandidate[] }>(
      `/journals/${encodeURIComponent(journalSlug)}/editor/candidates`,
      { method: "GET" }
    );
    setEditors(data.editors);
    setReviewers(data.reviewers);
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
        setSelectedJournal(first);
        if (first) {
          await loadQueue(first, "");
          await loadCandidates(first);
        }
      } catch (err: unknown) {
        if (!mounted) return;
        setError(errorMessage(err) || "Failed to load editorial queue");
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
    if (!selectedJournal) return;
    loadQueue(selectedJournal, selectedStatus).catch((err: unknown) =>
      setError(errorMessage(err) || "Failed to load queue")
    );
    loadCandidates(selectedJournal).catch((err: unknown) =>
      setError(errorMessage(err) || "Failed to load assignment candidates")
    );
  }, [selectedJournal, selectedStatus]);

  async function startReviewRound(submissionId: string) {
    setBusyItemId(submissionId);
    setError(null);
    setToast(null);
    try {
      await apiJson(`/submissions/${submissionId}/start-review-round`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadQueue(selectedJournal, selectedStatus);
      setToast({ tone: "success", message: "Review round started." });
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to start review round");
      setToast({ tone: "error", message: "Failed to start review round." });
    } finally {
      setBusyItemId(null);
    }
  }

  async function assignEditor(submissionId: string) {
    const assigneeUserId = assignEditorBySubmission[submissionId];
    if (!assigneeUserId) {
      setError("Select an editor before assigning.");
      setToast({ tone: "error", message: "Select an editor before assigning." });
      return;
    }
    setBusyItemId(submissionId);
    setError(null);
    setToast(null);
    try {
      await apiJson(`/submissions/${submissionId}/assign-editor`, {
        method: "POST",
        body: JSON.stringify({ userId: assigneeUserId, role: "HANDLING_EDITOR" }),
      });
      await loadQueue(selectedJournal, selectedStatus);
      setToast({ tone: "success", message: "Handling editor assigned." });
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to assign editor");
      setToast({ tone: "error", message: "Failed to assign editor." });
    } finally {
      setBusyItemId(null);
    }
  }

  async function inviteReviewer(submissionId: string, latestReviewRoundId?: string | null) {
    const reviewerUserId = inviteReviewerBySubmission[submissionId];
    const respondByValue = respondByBySubmission[submissionId];
    const dueAtValue = dueAtBySubmission[submissionId];
    if (!reviewerUserId) {
      setError("Select a reviewer before inviting.");
      setToast({ tone: "error", message: "Select a reviewer before inviting." });
      return;
    }
    if (respondByValue && dueAtValue && new Date(respondByValue).getTime() > new Date(dueAtValue).getTime()) {
      setError("Respond By cannot be later than Due At.");
      setToast({ tone: "error", message: "Respond By cannot be later than Due At." });
      return;
    }
    setBusyItemId(submissionId);
    setError(null);
    setToast(null);
    try {
      let reviewRoundId = latestReviewRoundId ?? null;
      if (!reviewRoundId) {
        const started = await apiJson<{ id: string }>(`/submissions/${submissionId}/start-review-round`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        reviewRoundId = started.id;
      }
      await apiJson(`/review-rounds/${reviewRoundId}/invite-reviewer`, {
        method: "POST",
        body: JSON.stringify({
          reviewerUserId,
          respondBy: respondByValue ? new Date(respondByValue).toISOString() : undefined,
          dueAt: dueAtValue ? new Date(dueAtValue).toISOString() : undefined,
        }),
      });
      await loadQueue(selectedJournal, selectedStatus);
      setRespondByBySubmission((prev) => ({ ...prev, [submissionId]: "" }));
      setDueAtBySubmission((prev) => ({ ...prev, [submissionId]: "" }));
      setToast({ tone: "success", message: "Reviewer invited." });
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to invite reviewer");
      setToast({ tone: "error", message: "Failed to invite reviewer." });
    } finally {
      setBusyItemId(null);
    }
  }

  async function submitDecision(submissionId: string) {
    const type = decisionBySubmission[submissionId] ?? "REVISE_MAJOR";
    const letterToAuthor = decisionLetterBySubmission[submissionId]?.trim();
    if (!letterToAuthor) {
      setError("Decision letter to author is required.");
      setToast({ tone: "error", message: "Decision letter to author is required." });
      return;
    }
    setBusyItemId(submissionId);
    setError(null);
    setToast(null);
    try {
      await apiJson(`/submissions/${submissionId}/decisions`, {
        method: "POST",
        body: JSON.stringify({
          type,
          letterToAuthor,
          internalNote: decisionNoteBySubmission[submissionId]?.trim() || undefined,
        }),
      });
      await loadQueue(selectedJournal, selectedStatus);
      setToast({ tone: "success", message: "Decision recorded and author notification queued." });
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to record decision");
      setToast({ tone: "error", message: "Failed to record decision." });
    } finally {
      setBusyItemId(null);
    }
  }

  function deadlineErrorForSubmission(submissionId: string) {
    const respondByValue = respondByBySubmission[submissionId];
    const dueAtValue = dueAtBySubmission[submissionId];
    if (!respondByValue || !dueAtValue) return null;
    if (new Date(respondByValue).getTime() <= new Date(dueAtValue).getTime()) return null;
    return "Respond By must be earlier than or equal to Due At.";
  }

  if (loading) {
    return (
      <AppShell
        title="Loading..."
        sectionLabel="Editorial"
        breadcrumbItems={[{ label: "Dashboard", href: "/dashboard" }, { label: "Editorial", href: "/dashboard/editor" }]}
        helpTopic="Editorial Workspace"
      >
        <SkeletonBlock height={42} />
        <SkeletonBlock height={120} />
        <SkeletonBlock height={180} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Editorial Queue"
      sectionLabel="Editorial"
      description="Track incoming manuscripts, filter by status, assign editors and reviewers, and record editorial decisions."
      selectedJournalLabel={selectedJournalTitle || "No journal selected"}
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Editorial", href: "/dashboard/editor" },
        { label: "Queue", href: "/dashboard/editor" },
      ]}
      journals={journals}
      selectedJournalSlug={selectedJournal}
      onJournalChange={setSelectedJournal}
      workflowSteps={[
        { label: "New Submission", state: "complete" },
        { label: "Screening", state: selectedStatus === "TRIAGE" ? "current" : "complete" },
        { label: "Assign Editor", state: selectedStatus === "EDITOR_ASSIGNED" ? "current" : "upcoming" },
        { label: "Assign Reviewer", state: selectedStatus === "UNDER_REVIEW" ? "current" : "upcoming" },
        { label: "Collect Reports", state: "upcoming" },
        { label: "Make Decision", state: "upcoming" },
      ]}
      quickActions={[
        { label: "Start Review Round", href: "/dashboard/editor", variant: "primary" },
        { label: "Submissions", href: "/dashboard/submissions", variant: "ghost" },
      ]}
      helpTopic="Editorial Workspace"
    >
      {error ? <ErrorAlert message={error} /> : null}

      {/* Filters */}
      <div className="shell-form-section">
        <div className="shell-form-section-header">
          <h3>🔍 Filters & Sort <ContextualHelp text="Use these filters to narrow down the submissions queue. Select a journal, status, and sort order to find manuscripts needing action." /></h3>
        </div>
        <div className="shell-form-grid" style={{ marginTop: 8 }}>
          <div className="field">
            <label htmlFor="status-filter">Status</label>
            <select
              id="status-filter"
              className="select"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as (typeof STATUS_OPTIONS)[number])}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status || "ALL"} value={status}>
                  {status || "ALL"}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sort-filter">Sort</label>
            <select
              id="sort-filter"
              className="select"
              value={selectedSort}
              onChange={(event) => setSelectedSort(event.target.value as SortOption)}
            >
              <option value="DUE_SOONEST">Nearest due date</option>
              <option value="RESPOND_SOONEST">Nearest respond-by</option>
              <option value="NEWEST">Newest</option>
              <option value="OLDEST">Oldest</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      <div className="shell-stats-grid">
        <div className="shell-stat-card">
          <span className="shell-stat-icon">📝</span>
          <p className="shell-stat-label">Submissions</p>
          <p className="shell-stat-value">{sortedItems.length}</p>
        </div>
        <div className="shell-stat-card">
          <span className="shell-stat-icon">👤</span>
          <p className="shell-stat-label">Editors Available</p>
          <p className="shell-stat-value">{editors.length}</p>
        </div>
        <div className="shell-stat-card">
          <span className="shell-stat-icon">🔍</span>
          <p className="shell-stat-label">Reviewers Available</p>
          <p className="shell-stat-value">{reviewers.length}</p>
        </div>
      </div>

      {/* Queue */}
      <div className="shell-form-section">
        <div className="shell-form-section-header">
          <h3>📋 Submission Queue</h3>
          <span className="muted">{sortedItems.length} items</span>
        </div>

        {sortedItems.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 12 }}>
            <h3>No submissions found for selected filters.</h3>
            <p className="muted">Try changing the status filter or selecting a different journal.</p>
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {sortedItems.map((item) => {
            const deadlineError = deadlineErrorForSubmission(item.id);
            return (
              <div key={item.id} className="shell-section-card">
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: "1rem" }}>{item.trackingNumber ?? "(pending tracking number)"}</p>
                    <p>{item.manuscriptTitle ?? "Untitled manuscript"}</p>
                  </div>
                  <StatusBadge label={item.status} tone={STATUS_TONE_MAP[item.status] ?? "neutral"} />
                </div>

                {/* Metadata */}
                <p className="muted" style={{ marginTop: 6 }}>
                  Created {new Date(item.createdAt).toLocaleString()}
                  {item.submittedAt ? ` • Submitted ${new Date(item.submittedAt).toLocaleString()}` : ""}
                  {item.latestReviewRoundNumber ? ` • Round ${item.latestReviewRoundNumber}` : ""}
                </p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  <span className="chip chip-small">Editors: {item.activeEditorAssignments ?? 0}</span>
                  <span className="chip chip-small">Invites: {item.reviewerInvitesCount ?? 0}</span>
                  <span className="chip chip-small">Accepted: {item.reviewerAcceptedCount ?? 0}</span>
                  <span className="chip chip-small">Pending: {item.reviewerPendingCount ?? 0}</span>
                </div>
                {item.nearestRespondBy || item.nearestDueAt ? (
                  <p className="muted" style={{ marginTop: 4 }}>
                    {item.nearestRespondBy ? `Respond-by: ${new Date(item.nearestRespondBy).toLocaleString()}` : ""}
                    {item.nearestRespondBy && item.nearestDueAt ? " • " : ""}
                    {item.nearestDueAt ? `Due: ${new Date(item.nearestDueAt).toLocaleString()}` : ""}
                  </p>
                ) : null}

                {/* Actions */}
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  <button
                    className="button compact button-primary"
                    onClick={() => startReviewRound(item.id)}
                    disabled={busyItemId !== null}
                    type="button"
                  >
                    {busyItemId === item.id ? "Starting..." : "Start Review Round"}
                  </button>

                  {/* Assign Editor */}
                  <div className="shell-form-grid">
                    <div className="field">
                      <label htmlFor={`editor-${item.id}`}>Handling Editor <ContextualHelp text="Select a qualified editor to handle this submission. The editor will manage the review process and make the final recommendation." /></label>
                      <select
                        id={`editor-${item.id}`}
                        className="select"
                        value={assignEditorBySubmission[item.id] ?? ""}
                        onChange={(event) =>
                          setAssignEditorBySubmission((prev) => ({ ...prev, [item.id]: event.target.value }))
                        }
                        disabled={busyItemId !== null}
                      >
                        <option value="">Select handling editor</option>
                        {editors.map((editor) => (
                          <option key={editor.id} value={editor.id}>
                            {editor.name} ({editor.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ alignSelf: "end" }}>
                      <button
                        className="button compact"
                        onClick={() => assignEditor(item.id)}
                        disabled={busyItemId !== null}
                        type="button"
                      >
                        Assign Editor
                      </button>
                    </div>
                  </div>

                  {/* Invite Reviewer */}
                  <div className="shell-form-grid">
                    <div className="field">
                      <label htmlFor={`reviewer-${item.id}`}>Reviewer <ContextualHelp text="Select a reviewer to invite. Reviewers will assess the manuscript quality and provide recommendations. Set appropriate deadlines for their response and review completion." /></label>
                      <select
                        id={`reviewer-${item.id}`}
                        className="select"
                        value={inviteReviewerBySubmission[item.id] ?? ""}
                        onChange={(event) =>
                          setInviteReviewerBySubmission((prev) => ({ ...prev, [item.id]: event.target.value }))
                        }
                        disabled={busyItemId !== null}
                      >
                        <option value="">Select reviewer</option>
                        {reviewers.map((reviewer) => (
                          <option key={reviewer.id} value={reviewer.id}>
                            {reviewer.name} ({reviewer.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`respond-by-${item.id}`}>Respond By</label>
                      <input
                        id={`respond-by-${item.id}`}
                        className="input"
                        type="datetime-local"
                        value={respondByBySubmission[item.id] ?? ""}
                        onChange={(event) =>
                          setRespondByBySubmission((prev) => ({ ...prev, [item.id]: event.target.value }))
                        }
                        disabled={busyItemId !== null}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`due-at-${item.id}`}>Due At</label>
                      <input
                        id={`due-at-${item.id}`}
                        className="input"
                        type="datetime-local"
                        value={dueAtBySubmission[item.id] ?? ""}
                        onChange={(event) => setDueAtBySubmission((prev) => ({ ...prev, [item.id]: event.target.value }))}
                        disabled={busyItemId !== null}
                      />
                    </div>
                    <div style={{ alignSelf: "end" }}>
                      <button
                        className="button compact"
                        onClick={() => inviteReviewer(item.id, item.latestReviewRoundId)}
                        disabled={busyItemId !== null || !!deadlineError}
                        type="button"
                      >
                        Invite Reviewer
                      </button>
                    </div>
                  </div>
                  {deadlineError ? <p className="shell-field-error">{deadlineError}</p> : null}

                  {/* Decision */}
                  <div className="shell-form-section" style={{ marginTop: 6, borderLeft: "3px solid #ea580c" }}>
                    <h3 style={{ fontSize: "0.95rem" }}>⚖️ Editorial Decision <ContextualHelp text="Record your editorial decision after review. The letter to author will be sent to the manuscript author. The internal note is visible only to editorial staff." /></h3>
                    <div className="shell-form-grid" style={{ marginTop: 8 }}>
                      <div className="field">
                        <label htmlFor={`decision-type-${item.id}`}>Decision Type</label>
                        <select
                          id={`decision-type-${item.id}`}
                          className="select"
                          value={decisionBySubmission[item.id] ?? "REVISE_MAJOR"}
                          onChange={(event) =>
                            setDecisionBySubmission((prev) => ({ ...prev, [item.id]: event.target.value as DecisionType }))
                          }
                          disabled={busyItemId !== null}
                        >
                          <option value="DESK_REJECT">Desk reject</option>
                          <option value="REVISE_MAJOR">Revise major</option>
                          <option value="REVISE_MINOR">Revise minor</option>
                          <option value="ACCEPT">Accept</option>
                          <option value="REJECT">Reject</option>
                        </select>
                      </div>
                    </div>
                    <div className="field" style={{ marginTop: 8 }}>
                      <label htmlFor={`decision-letter-${item.id}`}>Letter to Author <span className="shell-field-required">*</span></label>
                      <textarea
                        id={`decision-letter-${item.id}`}
                        className="input"
                        rows={4}
                        value={decisionLetterBySubmission[item.id] ?? ""}
                        onChange={(event) =>
                          setDecisionLetterBySubmission((prev) => ({ ...prev, [item.id]: event.target.value }))
                        }
                        disabled={busyItemId !== null}
                        placeholder="Share outcome and next steps with the author..."
                      />
                      <p className="shell-field-hint">This letter will be sent to the manuscript author. Required for all decisions.</p>
                    </div>
                    <div className="field" style={{ marginTop: 8 }}>
                      <label htmlFor={`decision-note-${item.id}`}>Internal Note (optional)</label>
                      <textarea
                        id={`decision-note-${item.id}`}
                        className="input"
                        rows={2}
                        value={decisionNoteBySubmission[item.id] ?? ""}
                        onChange={(event) =>
                          setDecisionNoteBySubmission((prev) => ({ ...prev, [item.id]: event.target.value }))
                        }
                        disabled={busyItemId !== null}
                        placeholder="Notes visible only to editorial staff..."
                      />
                    </div>
                    <div className="shell-form-actions">
                      <button
                        className="button button-primary compact"
                        onClick={() => submitDecision(item.id)}
                        disabled={busyItemId !== null || !(decisionLetterBySubmission[item.id] ?? "").trim()}
                        type="button"
                      >
                        {busyItemId === item.id ? "Saving..." : "Record Decision"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ToastNotification open={!!toast} tone={toast?.tone ?? "info"} message={toast?.message ?? ""} onClose={() => setToast(null)} />
    </AppShell>
  );
}
