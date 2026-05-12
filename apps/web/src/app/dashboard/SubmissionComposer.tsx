"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiJson } from "../../lib/clientApi";
import { errorMessage } from "../../lib/errorMessage";
import ErrorAlert from "../../components/ErrorAlert";

type Journal = { id: string; slug: string; title: string; description?: string | null };
type Submission = {
  id: string;
  status: string;
  trackingNumber?: string | null;
  manuscriptTitle?: string | null;
  createdAt: string;
};

type SubmissionDetail = {
  id: string;
  journalSlug: string;
  status: string;
  trackingNumber?: string | null;
  manuscriptTitle?: string | null;
  abstractText?: string | null;
  keywordsText?: string[] | null;
  articleType?: string | null;
  hasManuscriptFile?: boolean;
  contributors?: Array<{
    id: string;
    displayName: string;
    email: string;
    affiliation?: string | null;
    isCorresponding: boolean;
  }>;
};

type ActiveRequiredPolicy = { policyVersionId: string; key: string; title: string; versionNumber: number };

type Me = { id: string; email: string; name: string };

async function sha256Hex(file: File) {
  const arr = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", arr);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function SubmissionComposer() {
  const [user, setUser] = useState<Me | null>(null);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [selectedJournal, setSelectedJournal] = useState<string>("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [currentSubmissionId, setCurrentSubmissionId] = useState<string>("");
  const [currentSubmission, setCurrentSubmission] = useState<SubmissionDetail | null>(null);

  const [title, setTitle] = useState("");
  const [abstractText, setAbstractText] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [articleType, setArticleType] = useState("");

  const [contributorName, setContributorName] = useState("");
  const [contributorEmail, setContributorEmail] = useState("");
  const [contributorAffiliation, setContributorAffiliation] = useState("");

  const [activeRequiredPolicies, setActiveRequiredPolicies] = useState<ActiveRequiredPolicy[]>([]);
  const [acceptedPolicyVersionIds, setAcceptedPolicyVersionIds] = useState<string[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const [showValidation, setShowValidation] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<{
    submissionId: string;
    manuscriptTitle: string;
    abstractText: string;
    keywordsText: string;
    articleType: string;
  } | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canEditDraft = currentSubmission?.status === "DRAFT";
  const draftIsDirty = useMemo(() => {
    if (!currentSubmissionId || !lastSavedSnapshot || lastSavedSnapshot.submissionId !== currentSubmissionId) return false;
    return (
      lastSavedSnapshot.manuscriptTitle !== title ||
      lastSavedSnapshot.abstractText !== abstractText ||
      lastSavedSnapshot.keywordsText !== keywordsText ||
      lastSavedSnapshot.articleType !== articleType
    );
  }, [currentSubmissionId, lastSavedSnapshot, title, abstractText, keywordsText, articleType]);

  const journalOptions = useMemo(() => journals.map((j) => ({ value: j.slug, label: j.title })), [journals]);

  const loadSubmissions = useCallback(async (journalSlug: string) => {
    const res = await apiJson<{ items: Submission[] }>(
      `/submissions?journalSlug=${encodeURIComponent(journalSlug)}&mine=true`,
      { method: "GET" }
    );
    setSubmissions(res.items);
    const firstSubmission = res.items[0];
    if (firstSubmission) {
      setCurrentSubmissionId((prev) => prev || firstSubmission.id);
    }
  }, []);

  const loadPolicies = useCallback(async (journalSlug: string) => {
    const required = await apiJson<{ items: ActiveRequiredPolicy[] }>(
      `/journals/${encodeURIComponent(journalSlug)}/policies/active-required`,
      { method: "GET" }
    );
    setActiveRequiredPolicies(required.items);
    setAcceptedPolicyVersionIds(required.items.map((r) => r.policyVersionId));
  }, []);

  async function loadCurrentSubmission(submissionId: string) {
    const detail = await apiJson<SubmissionDetail>(`/submissions/${submissionId}`, { method: "GET" });
    setCurrentSubmission(detail);
    const nextTitle = detail.manuscriptTitle ?? "";
    const nextAbstract = detail.abstractText ?? "";
    const nextKeywords = (detail.keywordsText ?? []).join(", ");
    const nextArticleType = detail.articleType ?? "";
    setTitle(nextTitle);
    setAbstractText(nextAbstract);
    setKeywordsText(nextKeywords);
    setArticleType(nextArticleType);
    setLastSavedSnapshot({
      submissionId,
      manuscriptTitle: nextTitle,
      abstractText: nextAbstract,
      keywordsText: nextKeywords,
      articleType: nextArticleType,
    });
    setAutosaveState("idle");
    setLastSavedAt(new Date());
    setShowValidation(false);
  }

  useEffect(() => {
    let mounted = true;
    async function boot() {
      setLoading(true);
      setError(null);
      try {
        const me = await apiJson<Me>("/auth/session", { method: "GET" });
        const js = await apiJson<{ items: Journal[] }>("/journals", { method: "GET" });
        if (!mounted) return;
        setUser(me);
        setJournals(js.items);
        const first = js.items[0]?.slug ?? "";
        setSelectedJournal(first);
        if (first) {
          await loadSubmissions(first);
          await loadPolicies(first);
        }
      } catch (err: unknown) {
        if (!mounted) return;
        setError(errorMessage(err) || "Failed to load dashboard");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();
    return () => {
      mounted = false;
    };
  }, [loadPolicies, loadSubmissions]);

  useEffect(() => {
    if (!selectedJournal) return;
    loadSubmissions(selectedJournal).catch((err: unknown) => setError(errorMessage(err) || "Failed to load submissions"));
    loadPolicies(selectedJournal).catch(() => {
      setActiveRequiredPolicies([]);
    });
  }, [loadPolicies, loadSubmissions, selectedJournal]);

  useEffect(() => {
    if (!currentSubmissionId) {
      setCurrentSubmission(null);
      return;
    }
    loadCurrentSubmission(currentSubmissionId).catch((err: unknown) =>
      setError(errorMessage(err) || "Failed to load submission")
    );
  }, [currentSubmissionId]);

  async function createDraft() {
    if (!selectedJournal) return;
    setBusyAction("create-draft");
    setSuccess(null);
    setError(null);
    try {
      const draft = await apiJson<{ id: string }>(`/journals/${encodeURIComponent(selectedJournal)}/submissions`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadSubmissions(selectedJournal);
      setCurrentSubmissionId(draft.id);
      setSuccess("Draft created.");
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to create draft");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveDraftMetadata() {
    if (!currentSubmissionId) return;
    setBusyAction("save-metadata");
    await persistDraftMetadata({ showSuccess: true, markBusy: false });
    setBusyAction(null);
  }

  function canSwitchWithUnsavedChanges() {
    if (!canEditDraft || !draftIsDirty || busyAction === "save-metadata" || autosaveState === "saving") return true;
    return window.confirm("You have unsaved draft metadata changes. Switch anyway?");
  }

  const persistDraftMetadata = useCallback(async (options: { showSuccess: boolean; markBusy: boolean }) => {
    if (!currentSubmissionId) return;
    if (options.markBusy) setBusyAction("save-metadata");
    if (options.showSuccess) setSuccess(null);
    setError(null);
    try {
      const normalizedKeywords = keywordsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await apiJson(`/submissions/${currentSubmissionId}/update-draft`, {
        method: "POST",
        body: JSON.stringify({
          manuscriptTitle: title || undefined,
          abstractText: abstractText || undefined,
          keywordsText: normalizedKeywords,
          articleType: articleType || undefined,
        }),
      });
      setLastSavedSnapshot({
        submissionId: currentSubmissionId,
        manuscriptTitle: title,
        abstractText,
        keywordsText,
        articleType,
      });
      setAutosaveState("saved");
      setLastSavedAt(new Date());
      await loadSubmissions(selectedJournal);
      if (options.showSuccess) setSuccess("Draft metadata saved.");
    } catch (err: unknown) {
      setAutosaveState("error");
      setError(errorMessage(err) || "Failed to save metadata");
    } finally {
      if (options.markBusy) setBusyAction(null);
    }
  }, [abstractText, articleType, currentSubmissionId, keywordsText, loadSubmissions, selectedJournal, title]);

  async function addContributor() {
    if (!currentSubmissionId) return;
    if (!contributorName.trim() || !contributorEmailValid) {
      setError("Please provide a valid contributor name and email.");
      return;
    }
    setBusyAction("add-contributor");
    setSuccess(null);
    setError(null);
    try {
      await apiJson(`/submissions/${currentSubmissionId}/contributors`, {
        method: "POST",
        body: JSON.stringify({
          displayName: contributorName,
          email: contributorEmail,
          affiliation: contributorAffiliation || undefined,
          isCorresponding: true,
          creditRoles: [],
        }),
      });
      setContributorName("");
      setContributorEmail("");
      setContributorAffiliation("");
      await loadCurrentSubmission(currentSubmissionId);
      setSuccess("Contributor added.");
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to add contributor");
    } finally {
      setBusyAction(null);
    }
  }

  async function uploadFile() {
    if (!currentSubmissionId || !file) return;
    setBusyAction("upload-file");
    setSuccess(null);
    setError(null);
    try {
      const sha256 = await sha256Hex(file);
      const prepare = await apiJson<{ uploadUrl: string; fileId: string }>(`/submissions/${currentSubmissionId}/files`, {
        method: "POST",
        body: JSON.stringify({
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          sha256,
          role: "MANUSCRIPT",
        }),
      });
      const uploadRes = await fetch(prepare.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
      setCurrentSubmission((prev) => (prev ? { ...prev, hasManuscriptFile: true } : prev));
      setFile(null);
      setSuccess("File uploaded.");
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to upload file");
    } finally {
      setBusyAction(null);
    }
  }

  async function submitDraft() {
    if (!currentSubmissionId) return;
    setShowValidation(true);
    if (!canSubmit) {
      setError("Submission is incomplete. Resolve all checklist items.");
      return;
    }
    setBusyAction("submit-draft");
    setSuccess(null);
    setError(null);
    try {
      await apiJson(`/submissions/${currentSubmissionId}/submit`, {
        method: "POST",
        body: JSON.stringify({ acceptedPolicyVersionIds }),
      });
      await loadCurrentSubmission(currentSubmissionId);
      await loadSubmissions(selectedJournal);
      setSuccess("Submission sent successfully.");
    } catch (err: unknown) {
      const message = errorMessage(err) || "Failed to submit";
      setError(message);
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    if (!currentSubmissionId || !canEditDraft) return;
    if (!lastSavedSnapshot || lastSavedSnapshot.submissionId !== currentSubmissionId) return;
    if (!draftIsDirty) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setAutosaveState("idle");
    autosaveTimerRef.current = setTimeout(async () => {
      setAutosaveState("saving");
      await persistDraftMetadata({ showSuccess: false, markBusy: false });
    }, 900);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [title, abstractText, keywordsText, articleType, currentSubmissionId, canEditDraft, lastSavedSnapshot, draftIsDirty, persistDraftMetadata]);

  useEffect(() => {
    const shouldWarn = canEditDraft && draftIsDirty;
    if (!shouldWarn) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [canEditDraft, draftIsDirty]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const normalizedKeywords = useMemo(
    () =>
      keywordsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [keywordsText]
  );

  const completenessChecks = useMemo(() => {
    const checks = [
      { label: "Manuscript title provided", done: !!title.trim() },
      { label: "Abstract provided", done: !!abstractText.trim() },
      { label: "At least one keyword provided", done: normalizedKeywords.length > 0 },
      { label: "Article type selected", done: !!articleType.trim() },
      { label: "At least one contributor added", done: (currentSubmission?.contributors?.length ?? 0) > 0 },
      { label: "Manuscript file uploaded", done: !!currentSubmission?.hasManuscriptFile },
      {
        label: "All required policies acknowledged",
        done: activeRequiredPolicies.every((policy) => acceptedPolicyVersionIds.includes(policy.policyVersionId)),
      },
    ];
    return checks;
  }, [
    title,
    abstractText,
    normalizedKeywords.length,
    articleType,
    currentSubmission?.contributors?.length,
    currentSubmission?.hasManuscriptFile,
    activeRequiredPolicies,
    acceptedPolicyVersionIds,
  ]);

  const missingChecks = completenessChecks.filter((check) => !check.done);
  const canSubmit = canEditDraft && missingChecks.length === 0 && busyAction === null;
  const stepProgress = useMemo(
    () => [
      { label: "Draft Selected", done: !!currentSubmissionId },
      { label: "Metadata Complete", done: !!title.trim() && !!abstractText.trim() && normalizedKeywords.length > 0 && !!articleType.trim() },
      { label: "Contributor Added", done: (currentSubmission?.contributors?.length ?? 0) > 0 },
      { label: "File Uploaded", done: !!currentSubmission?.hasManuscriptFile },
      {
        label: "Policies Accepted",
        done: activeRequiredPolicies.every((policy) => acceptedPolicyVersionIds.includes(policy.policyVersionId)),
      },
      { label: "Ready to Submit", done: missingChecks.length === 0 },
    ],
    [
      currentSubmissionId,
      title,
      abstractText,
      normalizedKeywords.length,
      articleType,
      currentSubmission?.contributors?.length,
      currentSubmission?.hasManuscriptFile,
      activeRequiredPolicies,
      acceptedPolicyVersionIds,
      missingChecks.length,
    ]
  );
  const completedSteps = stepProgress.filter((step) => step.done).length;
  const progressPercent = Math.round((completedSteps / stepProgress.length) * 100);
  const normalizedTitle = title.trim();
  const normalizedAbstract = abstractText.trim();
  const normalizedArticleType = articleType.trim();
  const contributorEmailValid = contributorEmail.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contributorEmail);
  const titleError = showValidation && !normalizedTitle ? "Title is required." : null;
  const abstractError = showValidation && !normalizedAbstract ? "Abstract is required." : null;
  const keywordsError = showValidation && normalizedKeywords.length === 0 ? "Add at least one keyword." : null;
  const articleTypeError = showValidation && !normalizedArticleType ? "Article type is required." : null;
  const contributorNameError = contributorName.length > 0 && contributorName.trim().length < 2 ? "Use at least 2 characters." : null;
  const contributorEmailError = contributorEmail.length > 0 && !contributorEmailValid ? "Enter a valid email address." : null;
  const secondsSinceLastSave = lastSavedAt ? Math.max(0, Math.floor((nowTick - lastSavedAt.getTime()) / 1000)) : null;
  const relativeLastSaved =
    secondsSinceLastSave === null
      ? null
      : secondsSinceLastSave < 5
        ? "just now"
        : secondsSinceLastSave < 60
          ? `${secondsSinceLastSave} sec ago`
          : `${Math.floor(secondsSinceLastSave / 60)} min ago`;
  const autosaveDot = {
    color:
      autosaveState === "saving"
        ? "var(--accent)"
        : autosaveState === "saved"
          ? "var(--accent-2)"
          : autosaveState === "error"
            ? "var(--warn)"
            : "var(--ink-600)",
    label:
      autosaveState === "saving"
        ? "Saving"
        : autosaveState === "saved"
          ? "Saved"
          : autosaveState === "error"
            ? "Error"
            : "Idle",
  };

  if (loading) return <p>Loading dashboard...</p>;
  if (error && !user) return <ErrorAlert message={error} />;
  if (!user) return <p>Please log in.</p>;

  return (
    <main className="main-stack">
      <section className="hero">
        <h1>Submission Composer</h1>
        <p>
          Create and complete manuscript drafts with metadata, contributors, files, and policy acknowledgment.
        </p>
        <div className="meta-row">
          <span className="chip">
            <span className="status-dot" />
            Logged in as {user.name}
          </span>
          <Link className="button button-ghost compact" href="/dashboard">
            Back to workspace
          </Link>
        </div>
        <div className="card" style={{ marginTop: 14, color: "var(--ink-900)" }}>
          <p className="eyebrow">Progress</p>
          <p style={{ marginTop: 6, marginBottom: 8, color: "var(--ink-700)" }}>
            {completedSteps}/{stepProgress.length} steps complete ({progressPercent}%)
          </p>
          <div
            aria-label="Submission progress"
            style={{
              width: "100%",
              height: 10,
              borderRadius: 999,
              background: "rgba(148, 163, 184, 0.25)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
                transition: "width 220ms ease",
              }}
            />
          </div>
          <ul className="list" style={{ marginTop: 10 }}>
            {stepProgress.map((step) => (
              <li key={step.label} className="list-item">
                <span style={{ color: step.done ? "var(--accent-2)" : "var(--ink-600)" }}>{step.done ? "✓" : "•"}</span>{" "}
                <span style={{ color: "var(--ink-700)" }}>{step.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Step 1</p>
        <h2 style={{ marginTop: 6, marginBottom: 8 }}>Select journal and draft</h2>
        <div className="field">
          <label htmlFor="journal">Journal</label>
          <select
            id="journal"
            className="select"
            value={selectedJournal}
            onChange={(e) => {
              if (!canSwitchWithUnsavedChanges()) return;
              setSelectedJournal(e.target.value);
              setCurrentSubmissionId("");
            }}
          >
            {journalOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="button" onClick={createDraft} disabled={busyAction !== null}>
            {busyAction === "create-draft" ? "Creating..." : "Create Draft"}
          </button>
          <select
            className="select"
            style={{ maxWidth: 420 }}
            value={currentSubmissionId}
            onChange={(e) => {
              if (!canSwitchWithUnsavedChanges()) return;
              setCurrentSubmissionId(e.target.value);
            }}
          >
            <option value="">Select existing draft/submission</option>
            {submissions.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.trackingNumber ?? "(draft)")} | {s.status} | {new Date(s.createdAt).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
      </section>

      {currentSubmission ? (
        <>
          <section className="card">
            <p className="eyebrow">Step 2</p>
            <h2 style={{ marginTop: 6, marginBottom: 8 }}>Manuscript metadata</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              Status: <strong>{currentSubmission.status}</strong>{" "}
              {currentSubmission.trackingNumber ? `| Tracking: ${currentSubmission.trackingNumber}` : ""}
            </p>
            <div className="field">
              <label htmlFor="title">Manuscript Title</label>
              <input
                id="title"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canEditDraft}
              />
              {titleError ? <p className="alert">{titleError}</p> : null}
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="abstract">Abstract</label>
              <textarea
                id="abstract"
                className="input"
                rows={6}
                value={abstractText}
                onChange={(e) => setAbstractText(e.target.value)}
                disabled={!canEditDraft}
              />
              {abstractError ? <p className="alert">{abstractError}</p> : null}
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="keywords">Keywords (comma separated)</label>
              <input
                id="keywords"
                className="input"
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                disabled={!canEditDraft}
              />
              {keywordsError ? <p className="alert">{keywordsError}</p> : null}
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="articleType">Article Type</label>
              <input
                id="articleType"
                className="input"
                value={articleType}
                onChange={(e) => setArticleType(e.target.value)}
                disabled={!canEditDraft}
              />
              {articleTypeError ? <p className="alert">{articleTypeError}</p> : null}
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="button" onClick={saveDraftMetadata} disabled={!canEditDraft || busyAction !== null}>
                {busyAction === "save-metadata" ? "Saving..." : "Save Metadata"}
              </button>
              <p className="muted" style={{ marginTop: 8 }}>
                <span
                  aria-label={`Autosave ${autosaveDot.label}`}
                  title={`Autosave ${autosaveDot.label}`}
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "999px",
                    background: autosaveDot.color,
                    marginRight: 8,
                    verticalAlign: "middle",
                  }}
                />
                Autosave:{" "}
                {autosaveState === "saving"
                  ? "Saving…"
                  : autosaveState === "saved"
                    ? "All changes saved"
                    : autosaveState === "error"
                      ? "Save failed"
                      : "Idle"}
                {relativeLastSaved ? ` • Last saved ${relativeLastSaved}` : ""}
              </p>
            </div>
          </section>

          <section className="card">
            <p className="eyebrow">Step 3</p>
            <h2 style={{ marginTop: 6, marginBottom: 8 }}>Contributors</h2>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div className="field">
                <label htmlFor="cName">Name</label>
                <input
                  id="cName"
                  className="input"
                  value={contributorName}
                onChange={(e) => setContributorName(e.target.value)}
                disabled={!canEditDraft}
              />
              {contributorNameError ? <p className="alert">{contributorNameError}</p> : null}
            </div>
              <div className="field">
                <label htmlFor="cEmail">Email</label>
                <input
                  id="cEmail"
                  className="input"
                  value={contributorEmail}
                onChange={(e) => setContributorEmail(e.target.value)}
                disabled={!canEditDraft}
              />
              {contributorEmailError ? <p className="alert">{contributorEmailError}</p> : null}
            </div>
              <div className="field">
                <label htmlFor="cAff">Affiliation</label>
                <input
                  id="cAff"
                  className="input"
                  value={contributorAffiliation}
                  onChange={(e) => setContributorAffiliation(e.target.value)}
                  disabled={!canEditDraft}
                />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="button" onClick={addContributor} disabled={!canEditDraft || busyAction !== null}>
                {busyAction === "add-contributor" ? "Adding..." : "Add Contributor"}
              </button>
            </div>
            <ul className="list" style={{ marginTop: 12 }}>
              {(currentSubmission.contributors ?? []).map((c) => (
                <li key={c.id} className="list-item">
                  <p style={{ fontWeight: 700 }}>{c.displayName}</p>
                  <p className="muted">
                    {c.email}
                    {c.affiliation ? ` | ${c.affiliation}` : ""}
                  </p>
                </li>
              ))}
              {(currentSubmission.contributors ?? []).length === 0 ? (
                <li className="list-item">No contributors added yet.</li>
              ) : null}
            </ul>
          </section>

          <section className="card">
            <p className="eyebrow">Step 4</p>
            <h2 style={{ marginTop: 6, marginBottom: 8 }}>Attach manuscript file</h2>
            <div className="field">
              <label htmlFor="file">File</label>
              <input
                id="file"
                className="input"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={!canEditDraft}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="button" onClick={uploadFile} disabled={!canEditDraft || !file || busyAction !== null}>
                {busyAction === "upload-file" ? "Uploading..." : "Upload File"}
              </button>
            </div>
          </section>

          <section className="card">
            <p className="eyebrow">Step 5</p>
            <h2 style={{ marginTop: 6, marginBottom: 8 }}>Policy acknowledgment and submit</h2>
            <p className="muted" style={{ marginBottom: 10 }}>
              Review and acknowledge applicable policies before final submission.
            </p>
            <ul className="list">
              {activeRequiredPolicies.map((doc) => (
                <li key={doc.policyVersionId} className="list-item">
                  <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={acceptedPolicyVersionIds.includes(doc.policyVersionId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAcceptedPolicyVersionIds((prev) =>
                            Array.from(new Set([...prev, doc.policyVersionId]))
                          );
                        } else {
                          setAcceptedPolicyVersionIds((prev) =>
                            prev.filter((k) => k !== doc.policyVersionId)
                          );
                        }
                      }}
                      disabled={!canEditDraft}
                    />
                    <span style={{ fontWeight: 700 }}>
                      {doc.title} (v{doc.versionNumber})
                    </span>
                  </label>
                </li>
              ))}
              {activeRequiredPolicies.length === 0 ? (
                <li className="list-item">No required active policies for this journal.</li>
              ) : null}
            </ul>
            <div style={{ marginTop: 12 }}>
              <button className="button" onClick={submitDraft} disabled={!canEditDraft || !canSubmit}>
                {busyAction === "submit-draft" ? "Submitting..." : "Submit Manuscript"}
              </button>
            </div>
            <ul className="list" style={{ marginTop: 12 }}>
              {completenessChecks.map((check) => (
                <li key={check.label} className="list-item">
                  <span style={{ color: check.done ? "var(--accent-2)" : "var(--warn)" }}>{check.done ? "✓" : "•"}</span>{" "}
                  {check.label}
                </li>
              ))}
            </ul>
            {missingChecks.length > 0 ? (
              <p className="muted" style={{ marginTop: 10 }}>
                Complete all checklist items to enable submission.
              </p>
            ) : null}
          </section>
        </>
      ) : null}

      {success ? <p style={{ color: "var(--accent-2)", fontWeight: 700 }}>{success}</p> : null}
      {error ? <ErrorAlert message={error} /> : null}
    </main>
  );
}
