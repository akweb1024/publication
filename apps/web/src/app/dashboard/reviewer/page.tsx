"use client";

import { useEffect, useState } from "react";
import { apiJson } from "../../../lib/clientApi";
import ErrorAlert from "../../../components/ErrorAlert";

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

export default function ReviewerDashboardPage() {
  const [items, setItems] = useState<ReviewerAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load reviewer assignments");
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
    setMessage(null);
    try {
      await apiJson(`/reviewer/assignments/${assignmentId}/respond`, {
        method: "POST",
        body: JSON.stringify({ response }),
      });
      await loadAssignments();
      setMessage(response === "accept" ? "Assignment accepted." : "Assignment declined.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to update assignment");
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
      return;
    }
    setBusyId(assignmentId);
    setError(null);
    setMessage(null);
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
      setMessage("Review submitted.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to submit review");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p>Loading reviewer dashboard...</p>;

  return (
    <main className="main-stack">
      <section className="hero">
        <h1>Reviewer Assignments</h1>
        <p>Respond quickly to invitations and keep review deadlines on track.</p>
        <div className="meta-row">
          <a href="/dashboard" className="button button-ghost compact">
            Back to workspace
          </a>
        </div>
      </section>

      {message ? <p style={{ color: "var(--accent-2)", fontWeight: 700 }}>{message}</p> : null}
      {error ? <ErrorAlert message={error} /> : null}

      <section className="card">
        <p className="eyebrow">My Queue</p>
        <h2 style={{ marginTop: 8, marginBottom: 10 }}>Assignments</h2>
        <ul className="list">
          {items.map((item) => {
            const canRespond = item.status === "INVITED";
            const canSubmitReview = item.status === "ACCEPTED" || item.status === "OVERDUE";
            const draft = draftFor(item.id);
            return (
              <li key={item.id} className="list-item">
                <p style={{ fontWeight: 700 }}>
                  {item.reviewRound.submission.trackingNumber ?? "(submission)"} • Round {item.reviewRound.roundNumber}
                </p>
                <p>{item.reviewRound.submission.manuscriptTitle ?? "Untitled manuscript"}</p>
                <p className="muted">
                  {item.status} • Invited {new Date(item.invitedAt).toLocaleString()}
                  {item.respondBy ? ` • Respond by ${new Date(item.respondBy).toLocaleString()}` : ""}
                  {item.dueAt ? ` • Due ${new Date(item.dueAt).toLocaleString()}` : ""}
                </p>
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="button compact"
                    type="button"
                    disabled={!canRespond || busyId !== null}
                    onClick={() => respond(item.id, "accept")}
                  >
                    {busyId === item.id ? "Saving..." : "Accept"}
                  </button>
                  <button
                    className="button button-ghost compact"
                    type="button"
                    disabled={!canRespond || busyId !== null}
                    onClick={() => respond(item.id, "decline")}
                  >
                    Decline
                  </button>
                </div>
                {canSubmitReview ? (
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <div className="field">
                      <label htmlFor={`recommendation-${item.id}`}>Recommendation</label>
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
                        <option value="ACCEPT">Accept</option>
                        <option value="MINOR">Minor revision</option>
                        <option value="MAJOR">Major revision</option>
                        <option value="REJECT">Reject</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`comments-author-${item.id}`}>Comments to Author</label>
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
                        placeholder="Provide constructive, blinded feedback for the author."
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`comments-editor-${item.id}`}>Comments to Editor (optional)</label>
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
                        placeholder="Private note for editor only."
                      />
                    </div>
                    <div>
                      <button
                        className="button compact"
                        type="button"
                        disabled={busyId !== null || !draft.commentsToAuthor.trim()}
                        onClick={() => submitReview(item.id)}
                      >
                        {busyId === item.id ? "Submitting..." : "Submit Review"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
          {items.length === 0 ? <li className="list-item">No reviewer assignments yet.</li> : null}
        </ul>
      </section>
    </main>
  );
}
