"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../../lib/clientApi";
import { errorMessage } from "../../../lib/errorMessage";
import ErrorAlert from "../../../components/ErrorAlert";
import AppShell from "../../../components/dashboard/AppShell";
import StatusBadge from "../../../components/dashboard/StatusBadge";
import ToastNotification from "../../../components/dashboard/ToastNotification";
import SkeletonBlock from "../../../components/dashboard/SkeletonBlock";
import ConfirmationModal from "../../../components/dashboard/ConfirmationModal";

type Journal = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  timezone: string;
};

type JournalDetails = Journal & {
  issnPrint?: string | null;
  issnOnline?: string | null;
  brandingJson?: Record<string, unknown> | null;
  requiredPolicyKeys?: string[];
};

type JournalRoleAssignment = {
  id: string;
  role: string;
  subscriptionStartAt?: string | null;
  subscriptionEndAt?: string | null;
  user: { id: string; email: string; name: string };
};

const ROLE_OPTIONS = [
  "SUBSCRIBER",
  "AUTHOR_SUPPORT",
  "REVIEWER",
  "COPYEDITOR",
  "PRODUCTION_EDITOR",
  "ASSOCIATE_EDITOR",
  "SECTION_EDITOR",
  "MANAGING_EDITOR",
  "EDITOR_IN_CHIEF",
  "JOURNAL_ADMIN",
] as const;

export default function JournalSettingsPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [journalSlug, setJournalSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const [removeRoleTarget, setRemoveRoleTarget] = useState<{ email: string; role: string } | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [issnPrint, setIssnPrint] = useState("");
  const [issnOnline, setIssnOnline] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [brandingJsonText, setBrandingJsonText] = useState("{}");
  const [requiredPolicyKeysText, setRequiredPolicyKeysText] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");

  const [roleAssignments, setRoleAssignments] = useState<JournalRoleAssignment[]>([]);
  const [roleEmail, setRoleEmail] = useState("");
  const [roleName, setRoleName] = useState<(typeof ROLE_OPTIONS)[number]>("SUBSCRIBER");
  const [subscriberStartAt, setSubscriberStartAt] = useState("");
  const [subscriberEndAt, setSubscriberEndAt] = useState("");

  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTimezone, setNewTimezone] = useState("UTC");

  const selectedJournal = useMemo(
    () => journals.find((journal) => journal.slug === journalSlug) ?? null,
    [journals, journalSlug]
  );

  const normalizedIssnPrint = issnPrint.trim();
  const normalizedIssnOnline = issnOnline.trim();
  const normalizedRequiredPolicyKeys = requiredPolicyKeysText
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const issnPattern = /^\d{4}-\d{3}[\dXx]$/;
  const issnPrintError = normalizedIssnPrint && !issnPattern.test(normalizedIssnPrint) ? "ISSN format must be 1234-5678." : null;
  const issnOnlineError = normalizedIssnOnline && !issnPattern.test(normalizedIssnOnline) ? "ISSN format must be 1234-5678." : null;

  const brandingJsonError = useMemo(() => {
    try {
      JSON.parse(brandingJsonText || "{}");
      return null;
    } catch (err: unknown) {
      return errorMessage(err) || "Invalid JSON";
    }
  }, [brandingJsonText]);

  const titleError = !title.trim() ? "Title is required." : null;
  const timezoneError = !timezone.trim() ? "Timezone is required." : null;
  const requiredPolicyKeysError = normalizedRequiredPolicyKeys.length === 0 ? "Provide at least one required policy key." : null;

  const completionScore = useMemo(() => {
    const checks = [
      !!title.trim(),
      !!timezone.trim(),
      !issnPrintError,
      !issnOnlineError,
      !brandingJsonError,
      normalizedRequiredPolicyKeys.length > 0,
      metaTitle.trim().length > 10,
      metaDescription.trim().length > 20,
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }, [title, timezone, issnPrintError, issnOnlineError, brandingJsonError, normalizedRequiredPolicyKeys.length, metaTitle, metaDescription]);

  const canSave = !saving && !titleError && !timezoneError && !issnPrintError && !issnOnlineError && !brandingJsonError && !requiredPolicyKeysError;

  function formatIssnInput(value: string) {
    const raw = value.toUpperCase().replace(/[^0-9X]/g, "").slice(0, 8);
    if (raw.length <= 4) return raw;
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  }

  async function loadJournal(slug: string) {
    const detail = await apiJson<JournalDetails>(`/journals/${encodeURIComponent(slug)}`, { method: "GET" });
    setTitle(detail.title ?? "");
    setDescription(detail.description ?? "");
    setIssnPrint(detail.issnPrint ?? "");
    setIssnOnline(detail.issnOnline ?? "");
    setTimezone(detail.timezone ?? "UTC");
    setBrandingJsonText(JSON.stringify(detail.brandingJson ?? {}, null, 2));
    setRequiredPolicyKeysText((detail.requiredPolicyKeys ?? []).join(", "));
    setMetaTitle(detail.title ?? "");
    setMetaDescription(detail.description ?? "");
    const roleRes = await apiJson<{ items: JournalRoleAssignment[] }>(`/journals/${encodeURIComponent(slug)}/roles`, { method: "GET" });
    setRoleAssignments(roleRes.items);
  }

  async function reloadJournals(preferredSlug?: string) {
    const response = await apiJson<{ items: Journal[] }>("/journals", { method: "GET" });
    setJournals(response.items);
    const nextSlug =
      (preferredSlug && response.items.some((item) => item.slug === preferredSlug) ? preferredSlug : null) ??
      response.items[0]?.slug ??
      "";
    setJournalSlug(nextSlug);
    if (nextSlug) {
      await loadJournal(nextSlug);
    }
  }

  useEffect(() => {
    let mounted = true;
    async function boot() {
      setLoading(true);
      setError(null);
      try {
        await apiJson("/auth/session", { method: "GET" });
        await reloadJournals();
        if (!mounted) return;
      } catch (err: unknown) {
        if (!mounted) return;
        setError(errorMessage(err) || "Failed to load journal settings");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleJournalSwitch(nextSlug: string) {
    setJournalSlug(nextSlug);
    setError(null);
    setSectionLoading(true);
    try {
      await loadJournal(nextSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to load selected journal");
      setToast({ tone: "error", message: "Failed to load selected journal." });
    } finally {
      setSectionLoading(false);
    }
  }

  async function save() {
    if (!journalSlug || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      const brandingJson = JSON.parse(brandingJsonText || "{}");
      await apiJson(`/journals/${encodeURIComponent(journalSlug)}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          issnPrint: normalizedIssnPrint || null,
          issnOnline: normalizedIssnOnline || null,
          timezone: timezone.trim() || "UTC",
          brandingJson,
          requiredPolicyKeys: normalizedRequiredPolicyKeys,
        }),
      });
      setToast({ tone: "success", message: "Journal settings saved." });
      await loadJournal(journalSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to save journal settings");
      setToast({ tone: "error", message: "Failed to save journal settings." });
    } finally {
      setSaving(false);
    }
  }

  async function assignRole() {
    if (!journalSlug || !roleEmail.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiJson(`/journals/${encodeURIComponent(journalSlug)}/roles`, {
        method: "POST",
        body: JSON.stringify({
          email: roleEmail.trim(),
          role: roleName,
          subscriptionStartAt: roleName === "SUBSCRIBER" && subscriberStartAt ? new Date(subscriberStartAt).toISOString() : undefined,
          subscriptionEndAt: roleName === "SUBSCRIBER" && subscriberEndAt ? new Date(subscriberEndAt).toISOString() : undefined,
        }),
      });
      setToast({ tone: "success", message: `Assigned ${roleName} to ${roleEmail.trim()}.` });
      setRoleEmail("");
      setSubscriberStartAt("");
      setSubscriberEndAt("");
      await loadJournal(journalSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to assign role");
      setToast({ tone: "error", message: "Failed to assign role." });
    } finally {
      setSaving(false);
    }
  }

  async function removeRole(email: string, role: string) {
    if (!journalSlug) return;
    setSaving(true);
    setError(null);
    try {
      await apiJson(`/journals/${encodeURIComponent(journalSlug)}/roles/remove`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
      setToast({ tone: "success", message: `Removed ${role} from ${email}.` });
      await loadJournal(journalSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to remove role");
      setToast({ tone: "error", message: "Failed to remove role." });
    } finally {
      setSaving(false);
      setRemoveRoleTarget(null);
    }
  }

  async function createJournal() {
    if (!newSlug.trim() || !newTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await apiJson<Journal>("/journals", {
        method: "POST",
        body: JSON.stringify({
          slug: newSlug.trim().toLowerCase(),
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          timezone: newTimezone.trim() || "UTC",
        }),
      });
      setToast({ tone: "success", message: `Journal "${created.title}" created.` });
      setNewSlug("");
      setNewTitle("");
      setNewDescription("");
      setNewTimezone("UTC");
      await reloadJournals(created.slug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to create journal");
      setToast({ tone: "error", message: "Failed to create journal." });
    } finally {
      setSaving(false);
    }
  }

  async function runDefaultAdminBackfill() {
    setSaving(true);
    setError(null);
    try {
      const result = await apiJson<{ ok: boolean; affectedJournals: number; reason?: string }>(
        "/journals/admin/backfill-default-admin",
        { method: "POST" }
      );
      setToast({
        tone: result.ok ? "success" : "info",
        message: result.ok ? `Backfill completed for ${result.affectedJournals} journals.` : `Backfill skipped: ${result.reason ?? "not available"}.`,
      });
      if (journalSlug) await loadJournal(journalSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to run default admin backfill");
      setToast({ tone: "error", message: "Failed to run admin backfill." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="dashboard-page-content">
        <SkeletonBlock height={42} />
        <SkeletonBlock height={170} />
        <SkeletonBlock height={220} />
      </main>
    );
  }

  return (
    <AppShell
      title="Journal Settings"
      sectionLabel="Admin"
      description="Configure journal profile, branding, metadata, policy keys, and role assignments."
      selectedJournalLabel={selectedJournal?.title ?? "Select a journal"}
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Publishing", href: "/dashboard/publishing" },
        { label: "Journal Settings", href: "/dashboard/journals" },
      ]}
      journals={journals}
      selectedJournalSlug={journalSlug}
      onJournalChange={handleJournalSwitch}
      quickActions={[
        { label: "Create Journal", onClick: createJournal, variant: "primary" },
        { label: "Backfill Admin", onClick: runDefaultAdminBackfill, variant: "secondary" },
        { label: "Storage", href: "/dashboard/storage", variant: "ghost" },
      ]}
      workflowSteps={[
        { label: "Basic Journal Information", state: "complete" },
        { label: "ISSN / eISSN Details", state: "current" },
        { label: "Subject Area & Scope", state: "upcoming" },
        { label: "Editorial Board", state: "upcoming" },
        { label: "Policies & Branding", state: "upcoming" },
        { label: "Publish Journal Profile", state: "upcoming" },
      ]}
      actions={
        <StatusBadge
          label={completionScore >= 90 ? `Profile ${completionScore}%` : `Setup ${completionScore}%`}
          tone={completionScore >= 90 ? "ok" : "warn"}
        />
      }
    >
      {error ? <ErrorAlert message={error} /> : null}
      {sectionLoading ? (
        <section className="card">
          <SkeletonBlock height={24} />
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <SkeletonBlock height={34} />
            <SkeletonBlock height={34} />
            <SkeletonBlock height={80} />
          </div>
        </section>
      ) : null}

      <section className="card">
        <p className="eyebrow">Create Journal</p>
        <div className="dashboard-grid-two" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="new-journal-slug">Slug</label>
            <input id="new-journal-slug" className="input" value={newSlug} onChange={(event) => setNewSlug(event.target.value)} placeholder="cardiology-research" disabled={saving} />
          </div>
          <div className="field">
            <label htmlFor="new-journal-title">Title</label>
            <input id="new-journal-title" className="input" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Journal of Cardiology Research" disabled={saving} />
          </div>
          <div className="field">
            <label htmlFor="new-journal-timezone">Timezone</label>
            <input id="new-journal-timezone" className="input" value={newTimezone} onChange={(event) => setNewTimezone(event.target.value)} placeholder="UTC" disabled={saving} />
          </div>
          <div className="field">
            <label htmlFor="new-journal-description">Description</label>
            <textarea id="new-journal-description" className="input" rows={3} value={newDescription} onChange={(event) => setNewDescription(event.target.value)} disabled={saving} />
          </div>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Profile Form</p>
        <div className="form-section" style={{ marginTop: 10 }}>
          <h3>Basic Information</h3>
          <div className="dashboard-grid-two">
            <div className="field">
              <label htmlFor="title">Journal Title</label>
              <input id="title" className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Journal of ..." />
              {titleError ? <p className="alert">{titleError}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="timezone">Timezone</label>
              <input id="timezone" className="input" value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="UTC" />
              {timezoneError ? <p className="alert">{timezoneError}</p> : null}
            </div>
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea id="description" className="input" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
        </div>

        <div className="form-section" style={{ marginTop: 10 }}>
          <h3>ISSN Details</h3>
          <div className="dashboard-grid-two">
            <div className="field">
              <label htmlFor="issn-print">ISSN (Print)</label>
              <input id="issn-print" className="input" value={issnPrint} onChange={(event) => setIssnPrint(formatIssnInput(event.target.value))} placeholder="1234-5678" />
              {issnPrintError ? <p className="alert">{issnPrintError}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="issn-online">ISSN (Online)</label>
              <input id="issn-online" className="input" value={issnOnline} onChange={(event) => setIssnOnline(formatIssnInput(event.target.value))} placeholder="1234-5678" />
              {issnOnlineError ? <p className="alert">{issnOnlineError}</p> : null}
            </div>
          </div>
        </div>

        <div className="form-section" style={{ marginTop: 10 }}>
          <h3>Journal Branding</h3>
          <div className="field">
            <label htmlFor="branding-json">Branding JSON</label>
            <textarea id="branding-json" className="input" rows={10} value={brandingJsonText} onChange={(event) => setBrandingJsonText(event.target.value)} />
            {brandingJsonError ? <p className="alert">Invalid JSON: {brandingJsonError}</p> : null}
          </div>
        </div>

        <div className="form-section" style={{ marginTop: 10 }}>
          <h3>Policy Keys</h3>
          <div className="field">
            <label htmlFor="required-policy-keys">Required Policy Keys</label>
            <input id="required-policy-keys" className="input" value={requiredPolicyKeysText} onChange={(event) => setRequiredPolicyKeysText(event.target.value)} placeholder="peer-review, ethics, plagiarism" />
            {requiredPolicyKeysError ? <p className="alert">{requiredPolicyKeysError}</p> : null}
          </div>
        </div>

        <div className="form-section" style={{ marginTop: 10 }}>
          <h3>SEO & Metadata</h3>
          <div className="dashboard-grid-two">
            <div className="field">
              <label htmlFor="meta-title">Meta Title (preview)</label>
              <input id="meta-title" className="input" value={metaTitle} onChange={(event) => setMetaTitle(event.target.value)} placeholder="Journal title for SERP" />
            </div>
            <div className="field">
              <label htmlFor="meta-description">Meta Description (preview)</label>
              <textarea id="meta-description" className="input" rows={3} value={metaDescription} onChange={(event) => setMetaDescription(event.target.value)} placeholder="Short summary used for search snippets" />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="button button-primary compact" type="button" disabled={!canSave} onClick={save}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
          <StatusBadge label={`Progress ${completionScore}%`} tone={completionScore >= 80 ? "ok" : "warn"} />
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Access & Role Assignment</p>
        <div className="dashboard-grid-three" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="role-email">User Email</label>
            <input id="role-email" className="input" value={roleEmail} onChange={(event) => setRoleEmail(event.target.value)} placeholder="user@example.com" disabled={saving} />
          </div>
          <div className="field">
            <label htmlFor="role-name">Role</label>
            <select id="role-name" className="select" value={roleName} onChange={(event) => setRoleName(event.target.value as (typeof ROLE_OPTIONS)[number])} disabled={saving}>
              {ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div style={{ alignSelf: "end" }}>
            <button className="button compact" type="button" disabled={saving || !roleEmail.trim()} onClick={assignRole}>Assign Role</button>
          </div>
        </div>

        {roleName === "SUBSCRIBER" ? (
          <div className="dashboard-grid-two" style={{ marginTop: 8 }}>
            <div className="field">
              <label htmlFor="subscriber-start-at">Subscription Start</label>
              <input id="subscriber-start-at" className="input" type="datetime-local" value={subscriberStartAt} onChange={(event) => setSubscriberStartAt(event.target.value)} disabled={saving} />
            </div>
            <div className="field">
              <label htmlFor="subscriber-end-at">Subscription End</label>
              <input id="subscriber-end-at" className="input" type="datetime-local" value={subscriberEndAt} onChange={(event) => setSubscriberEndAt(event.target.value)} disabled={saving} />
            </div>
          </div>
        ) : null}

        <ul className="list" style={{ marginTop: 12 }}>
          {roleAssignments.map((assignment) => (
            <li className="list-item" key={assignment.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontWeight: 700 }}>{assignment.user.name} - {assignment.user.email}</p>
                  <p className="muted">{assignment.role}</p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <StatusBadge label={assignment.role} tone={assignment.role === "JOURNAL_ADMIN" ? "info" : "neutral"} />
                  <button className="button button-danger compact" type="button" disabled={saving} onClick={() => setRemoveRoleTarget({ email: assignment.user.email, role: assignment.role })}>Remove</button>
                </div>
              </div>
            </li>
          ))}
          {roleAssignments.length === 0 ? <li className="list-item"><div className="empty-state"><p>No role assignments yet.</p></div></li> : null}
        </ul>
      </section>
      <ToastNotification open={!!toast} tone={toast?.tone ?? "info"} message={toast?.message ?? ""} onClose={() => setToast(null)} />
      <ConfirmationModal
        open={!!removeRoleTarget}
        title="Remove Role Assignment"
        description={
          removeRoleTarget
            ? `This will remove ${removeRoleTarget.role} from ${removeRoleTarget.email}. Continue?`
            : ""
        }
        confirmLabel="Remove Role"
        busy={saving}
        onCancel={() => setRemoveRoleTarget(null)}
        onConfirm={() => {
          if (removeRoleTarget) void removeRole(removeRoleTarget.email, removeRoleTarget.role);
        }}
      />
    </AppShell>
  );
}
