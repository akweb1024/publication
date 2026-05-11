"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../../lib/clientApi";
import ErrorAlert from "../../../components/ErrorAlert";

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
const SORT_OPTIONS = ["DUE_SOONEST", "RESPOND_SOONEST", "NEWEST", "OLDEST"] as const;

export default function EditorialQueuePage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [selectedJournal, setSelectedJournal] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<(typeof STATUS_OPTIONS)[number]>("");
  const [selectedSort, setSelectedSort] = useState<(typeof SORT_OPTIONS)[number]>("DUE_SOONEST");
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
  const [message, setMessage] = useState<string | null>(null);

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
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load editorial queue");
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
    loadQueue(selectedJournal, selectedStatus).catch((err: any) =>
      setError(err?.message ?? "Failed to load queue")
    );
    loadCandidates(selectedJournal).catch((err: any) =>
      setError(err?.message ?? "Failed to load assignment candidates")
    );
  }, [selectedJournal, selectedStatus]);

  async function startReviewRound(submissionId: string) {
    setBusyItemId(submissionId);
    setError(null);
    setMessage(null);
    try {
      await apiJson(`/submissions/${submissionId}/start-review-round`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadQueue(selectedJournal, selectedStatus);
      setMessage("Review round started.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to start review round");
    } finally {
      setBusyItemId(null);
    }
  }

  async function assignEditor(submissionId: string) {
    const assigneeUserId = assignEditorBySubmission[submissionId];
    if (!assigneeUserId) {
      setError("Select an editor before assigning.");
      return;
    }
    setBusyItemId(submissionId);
    setError(null);
    setMessage(null);
    try {
      await apiJson(`/submissions/${submissionId}/assign-editor`, {
        method: "POST",
        body: JSON.stringify({ userId: assigneeUserId, role: "HANDLING_EDITOR" }),
      });
      await loadQueue(selectedJournal, selectedStatus);
      setMessage("Handling editor assigned.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to assign editor");
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
      return;
    }
    if (respondByValue && dueAtValue && new Date(respondByValue).getTime() > new Date(dueAtValue).getTime()) {
      setError("Respond By cannot be later than Due At.");
      return;
    }
    setBusyItemId(submissionId);
    setError(null);
    setMessage(null);
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
      setMessage("Reviewer invited.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to invite reviewer");
    } finally {
      setBusyItemId(null);
    }
  }

  async function submitDecision(submissionId: string) {
    const type = decisionBySubmission[submissionId] ?? "REVISE_MAJOR";
    const letterToAuthor = decisionLetterBySubmission[submissionId]?.trim();
    if (!letterToAuthor) {
      setError("Decision letter to author is required.");
      return;
    }
    setBusyItemId(submissionId);
    setError(null);
    setMessage(null);
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
      setMessage("Decision recorded and author notification queued.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to record decision");
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

  if (loading) return <p>Loading editorial queue...</p>;

  return (
    <main className="main-stack">
      <section className="hero">
        <h1>Editorial Queue</h1>
        <p>Track incoming manuscripts, filter by status, and move papers into review quickly.</p>
        <div className="meta-row">
          <span className="chip">{selectedJournalTitle || "No journal selected"}</span>
          <a href="/dashboard" className="button button-ghost compact">
            Back to workspace
          </a>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Filters</p>
        <div className="grid">
          <div className="field">
            <label htmlFor="journal-filter">Journal</label>
            <select
              id="journal-filter"
              className="select"
              value={selectedJournal}
              onChange={(event) => setSelectedJournal(event.target.value)}
            >
              {journals.map((journal) => (
                <option key={journal.id} value={journal.slug}>
                  {journal.title}
                </option>
              ))}
            </select>
          </div>
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
              onChange={(event) => setSelectedSort(event.target.value as (typeof SORT_OPTIONS)[number])}
            >
              <option value="DUE_SOONEST">Nearest due date</option>
              <option value="RESPOND_SOONEST">Nearest respond-by</option>
              <option value="NEWEST">Newest</option>
              <option value="OLDEST">Oldest</option>
            </select>
          </div>
        </div>
      </section>

      {message ? <p style={{ color: "var(--accent-2)", fontWeight: 700 }}>{message}</p> : null}
      {error ? <ErrorAlert message={error} /> : null}

      <section className="card">
        <p className="eyebrow">Queue</p>
        <h2 style={{ marginTop: 8, marginBottom: 10 }}>Submissions</h2>
        <ul className="list">
          {sortedItems.map((item) => (
            (() => {
              const deadlineError = deadlineErrorForSubmission(item.id);
              return (
            <li key={item.id} className="list-item">
              <p style={{ fontWeight: 700 }}>{item.trackingNumber ?? "(pending tracking number)"}</p>
              <p>{item.manuscriptTitle ?? "Untitled manuscript"}</p>
              <p className="muted">
                {item.status} • Created {new Date(item.createdAt).toLocaleString()}
                {item.submittedAt ? ` • Submitted ${new Date(item.submittedAt).toLocaleString()}` : ""}
                {item.latestReviewRoundNumber ? ` • Round ${item.latestReviewRoundNumber}` : ""}
              </p>
              <div className="meta-row" style={{ marginTop: 6 }}>
                <span className="chip">Editors: {item.activeEditorAssignments ?? 0}</span>
                <span className="chip">Invites: {item.reviewerInvitesCount ?? 0}</span>
                <span className="chip">Accepted: {item.reviewerAcceptedCount ?? 0}</span>
                <span className="chip">Pending: {item.reviewerPendingCount ?? 0}</span>
              </div>
              {item.nearestRespondBy || item.nearestDueAt ? (
                <p className="muted" style={{ marginTop: 4 }}>
                  {item.nearestRespondBy ? `Nearest respond-by: ${new Date(item.nearestRespondBy).toLocaleString()}` : ""}
                  {item.nearestRespondBy && item.nearestDueAt ? " • " : ""}
                  {item.nearestDueAt ? `Nearest due date: ${new Date(item.nearestDueAt).toLocaleString()}` : ""}
                </p>
              ) : null}
              <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                <button
                  className="button compact"
                  onClick={() => startReviewRound(item.id)}
                  disabled={busyItemId !== null}
                  type="button"
                >
                  {busyItemId === item.id ? "Starting..." : "Start Review Round"}
                </button>
                <div className="grid" style={{ gridTemplateColumns: "minmax(220px,1fr) auto" }}>
                  <select
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
                  <button
                    className="button compact"
                    onClick={() => assignEditor(item.id)}
                    disabled={busyItemId !== null}
                    type="button"
                  >
                    Assign Editor
                  </button>
                </div>
                <div className="grid" style={{ gridTemplateColumns: "minmax(220px,1fr) auto" }}>
                  <select
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
                  <button
                    className="button compact"
                    onClick={() => inviteReviewer(item.id, item.latestReviewRoundId)}
                    disabled={busyItemId !== null || !!deadlineError}
                    type="button"
                  >
                    Invite Reviewer
                  </button>
                </div>
                <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
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
                </div>
                {deadlineError ? <p className="alert">{deadlineError}</p> : null}
                <div className="card" style={{ marginTop: 6, padding: 12 }}>
                  <p className="eyebrow">Decision</p>
                  <div className="field" style={{ marginTop: 6 }}>
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
                  <div className="field" style={{ marginTop: 8 }}>
                    <label htmlFor={`decision-letter-${item.id}`}>Letter to Author</label>
                    <textarea
                      id={`decision-letter-${item.id}`}
                      className="input"
                      rows={4}
                      value={decisionLetterBySubmission[item.id] ?? ""}
                      onChange={(event) =>
                        setDecisionLetterBySubmission((prev) => ({ ...prev, [item.id]: event.target.value }))
                      }
                      disabled={busyItemId !== null}
                      placeholder="Share outcome and next steps with the author."
                    />
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
                    />
                  </div>
                  <button
                    className="button compact"
                    style={{ marginTop: 10 }}
                    onClick={() => submitDecision(item.id)}
                    disabled={busyItemId !== null || !(decisionLetterBySubmission[item.id] ?? "").trim()}
                    type="button"
                  >
                    {busyItemId === item.id ? "Saving..." : "Record Decision"}
                  </button>
                </div>
              </div>
            </li>
              );
            })()
          ))}
          {sortedItems.length === 0 ? <li className="list-item">No submissions found for selected filters.</li> : null}
        </ul>
      </section>
    </main>
  );
}
