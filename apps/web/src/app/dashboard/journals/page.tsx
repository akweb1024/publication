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
import ContextualHelp from "../../../components/dashboard/ContextualHelp";

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
      <AppShell title="Loading..." breadcrumbItems={[{ label: "Dashboard", href: "/dashboard" }, { label: "Journals", href: "/dashboard/journals" }]} helpTopic="Journal Settings">
        <SkeletonBlock height={42} />
        <SkeletonBlock height={170} />
        <SkeletonBlock height={220} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Journal Settings"
      sectionLabel="Admin"
      description="Configure journal profile, branding, ISSN metadata, policy keys, and role assignments."
      selectedJournalLabel={selectedJournal?.title ?? "Select a journal"}
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Journals", href: "/dashboard/journals" },
        { label: "Settings", href: "/dashboard/journals" },
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
        { label: "Basic Info", state: completionScore >= 25 ? "complete" : "current" },
        { label: "ISSN Details", state: completionScore >= 50 ? "complete" : completionScore >= 25 ? "current" : "upcoming" },
        { label: "Focus & Scope", state: completionScore >= 75 ? "complete" : completionScore >= 50 ? "current" : "upcoming" },
        { label: "Editorial Board", state: completionScore >= 90 ? "complete" : completionScore >= 75 ? "current" : "upcoming" },
        { label: "Policies & Branding", state: completionScore >= 95 ? "complete" : completionScore >= 90 ? "current" : "upcoming" },
        { label: "Publish Profile", state: completionScore >= 100 ? "current" : "upcoming" },
      ]}
      actions={
        <StatusBadge
          label={completionScore >= 90 ? `Profile ${completionScore}%` : `Setup ${completionScore}%`}
          tone={completionScore >= 90 ? "ok" : "warn"}
        />
      }
      helpTopic="Journal Settings"
    >
      {/* Progress bar */}
      <div className="shell-progress-bar" aria-label="Journal setup progress">
        <div className="shell-progress-fill" style={{ width: `${completionScore}%` }} />
      </div>

      {error ? <ErrorAlert message={error} /> : null}
      {sectionLoading ? (
        <div className="shell-form-section">
          <SkeletonBlock height={24} />
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <SkeletonBlock height={34} />
            <SkeletonBlock height={34} />
            <SkeletonBlock height={80} />
          </div>
        </div>
      ) : null}

      {/* Create Journal Section */}
      <div className="shell-form-section">
        <div className="shell-form-section-header">
          <h3>📝 Create Journal</h3>
        </div>
        <div className="shell-form-grid" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="new-journal-slug">Slug <span className="shell-field-required">*</span></label>
            <input id="new-journal-slug" className="input" value={newSlug} onChange={(event) => setNewSlug(event.target.value)} placeholder="e.g. cardiology-research" disabled={saving} />
            <p className="shell-field-hint">Lowercase, hyphen-separated. Used in URLs and public pages.</p>
          </div>
          <div className="field">
            <label htmlFor="new-journal-title">Title <span className="shell-field-required">*</span></label>
            <input id="new-journal-title" className="input" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="e.g. Journal of Cardiology Research" disabled={saving} />
          </div>
          <div className="field">
            <label htmlFor="new-journal-timezone">Timezone</label>
            <input id="new-journal-timezone" className="input" value={newTimezone} onChange={(event) => setNewTimezone(event.target.value)} placeholder="UTC" disabled={saving} />
            <p className="shell-field-hint">Default timezone for publication dates and scheduling.</p>
          </div>
          <div className="field shell-form-grid-full">
            <label htmlFor="new-journal-description">Description</label>
            <textarea id="new-journal-description" className="input" rows={3} value={newDescription} onChange={(event) => setNewDescription(event.target.value)} disabled={saving} placeholder="Brief description of the journal scope and purpose" />
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="shell-form-section">
        <div className="shell-form-section-header">
          <h3>📋 Profile Form</h3>
          <StatusBadge label={`Progress ${completionScore}%`} tone={completionScore >= 80 ? "ok" : "warn"} />
        </div>

        {/* Basic Information */}
        <div className="shell-form-section" style={{ marginTop: 10, borderLeft: "3px solid var(--accent)" }}>
          <h3 style={{ fontSize: "0.95rem" }}>Basic Information</h3>
          <div className="shell-form-grid">
            <div className="field">
              <label htmlFor="title">Journal Title <span className="shell-field-required">*</span></label>
              <input id="title" className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Journal of ..." />
              {titleError ? <p className="shell-field-error">{titleError}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="timezone">Timezone <span className="shell-field-required">*</span></label>
              <input id="timezone" className="input" value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="UTC" />
              {timezoneError ? <p className="shell-field-error">{timezoneError}</p> : null}
              <p className="shell-field-hint">Standard timezone identifier (e.g. UTC, America/New_York).</p>
            </div>
          </div>
          <div className="field shell-form-grid-full">
            <label htmlFor="description">Description</label>
            <textarea id="description" className="input" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A brief summary of the journal purpose and scope" />
          </div>
        </div>

        {/* ISSN Details */}
        <div className="shell-form-section" style={{ marginTop: 10, borderLeft: "3px solid #0d9488" }}>
          <h3 style={{ fontSize: "0.95rem" }}>ISSN Details <ContextualHelp text="ISSN (International Standard Serial Number) is a unique 8-digit identifier for serial publications. Format: 4 digits, hyphen, 4 digits (last digit can be X). Example: 1234-5678" /></h3>
          <div className="shell-form-grid">
            <div className="field">
              <label htmlFor="issn-print">ISSN (Print) <ContextualHelp text="Print ISSN identifies the physical printed version of the journal. Enter in 1234-5678 format." /></label>
              <input id="issn-print" className="input" value={issnPrint} onChange={(event) => setIssnPrint(formatIssnInput(event.target.value))} placeholder="1234-5678" />
              {issnPrintError ? <p className="shell-field-error">{issnPrintError}</p> : null}
              <p className="shell-field-hint">Auto-formatted as you type. Example: 1234-5678</p>
            </div>
            <div className="field">
              <label htmlFor="issn-online">ISSN (Online/eISSN) <ContextualHelp text="Online ISSN (eISSN) identifies the electronic/digital version. Same format as print ISSN." /></label>
              <input id="issn-online" className="input" value={issnOnline} onChange={(event) => setIssnOnline(formatIssnInput(event.target.value))} placeholder="1234-5678" />
              {issnOnlineError ? <p className="shell-field-error">{issnOnlineError}</p> : null}
              <p className="shell-field-hint">Auto-formatted. Last digit may be X (check digit).</p>
            </div>
          </div>
        </div>

        {/* Journal Branding */}
        <div className="shell-form-section" style={{ marginTop: 10, borderLeft: "3px solid #ea580c" }}>
          <h3 style={{ fontSize: "0.95rem" }}>Journal Branding <ContextualHelp text="Branding JSON controls the visual appearance of your journal's public pages. Use it to set colors, logos, and layout preferences." /></h3>
          <div className="field shell-form-grid-full">
            <label htmlFor="branding-json">Branding JSON</label>
            <textarea id="branding-json" className="input" rows={8} value={brandingJsonText} onChange={(event) => setBrandingJsonText(event.target.value)} placeholder='{"primaryColor": "#4f46e5", "logoUrl": "/logo.png"}' />
            {brandingJsonError ? <p className="shell-field-error">Invalid JSON: {brandingJsonError}</p> : null}
            <p className="shell-field-hint">JSON object for custom branding. Use keys like primaryColor, logoUrl, headerStyle.</p>
          </div>
        </div>

        {/* Policy Keys */}
        <div className="shell-form-section" style={{ marginTop: 10, borderLeft: "3px solid var(--accent)" }}>
          <h3 style={{ fontSize: "0.95rem" }}>Policy Keys <span className="shell-field-required">*</span> <ContextualHelp text="Required policy keys define which policies authors must accept before submitting. Each key maps to a policy version (e.g. peer-review, ethics, plagiarism)." /></h3>
          <div className="field shell-form-grid-full">
            <label htmlFor="required-policy-keys">Required Policy Keys (comma-separated)</label>
            <input id="required-policy-keys" className="input" value={requiredPolicyKeysText} onChange={(event) => setRequiredPolicyKeysText(event.target.value)} placeholder="peer-review, ethics, plagiarism" />
            {requiredPolicyKeysError ? <p className="shell-field-error">{requiredPolicyKeysError}</p> : null}
            <p className="shell-field-hint">At least one required policy key. Comma-separated list.</p>
          </div>
        </div>

        {/* SEO & Metadata */}
        <div className="shell-form-section" style={{ marginTop: 10, borderLeft: "3px solid #2563eb" }}>
          <h3 style={{ fontSize: "0.95rem" }}>SEO & Metadata</h3>
          <div className="shell-form-grid">
            <div className="field">
              <label htmlFor="meta-title">Meta Title (preview)</label>
              <input id="meta-title" className="input" value={metaTitle} onChange={(event) => setMetaTitle(event.target.value)} placeholder="Journal title for SERP" />
              <p className="shell-field-hint">Title shown in search engine results. Aim for 10+ characters.</p>
            </div>
            <div className="field">
              <label htmlFor="meta-description">Meta Description (preview)</label>
              <textarea id="meta-description" className="input" rows={3} value={metaDescription} onChange={(event) => setMetaDescription(event.target.value)} placeholder="Short summary used for search snippets" />
              <p className="shell-field-hint">Description shown in search results. Aim for 20+ characters.</p>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="shell-form-actions">
          <button className="button button-ghost compact" type="button" onClick={() => journalSlug && loadJournal(journalSlug)} disabled={saving}>
            Reset
          </button>
          <button className="button button-primary compact" type="button" disabled={!canSave} onClick={save}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Access & Role Assignment */}
      <div className="shell-form-section">
        <div className="shell-form-section-header">
          <h3>👥 Access & Role Assignment</h3>
          <ContextualHelp text="Assign journal roles to users by email. Roles determine what each user can access in this journal. Higher-tier roles inherit lower-tier capabilities." />
        </div>
        <div className="shell-form-grid" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="role-email">User Email <span className="shell-field-required">*</span></label>
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
          <div className="shell-form-grid" style={{ marginTop: 8 }}>
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

        {/* Role assignments table */}
        <div className="shell-table-wrap" style={{ marginTop: 14 }}>
          <table className="shell-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roleAssignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td style={{ fontWeight: 600 }}>{assignment.user.name}</td>
                  <td className="muted">{assignment.user.email}</td>
                  <td><StatusBadge label={assignment.role} tone={assignment.role === "JOURNAL_ADMIN" ? "info" : "neutral"} /></td>
                  <td>
                    <button className="button button-danger compact" type="button" disabled={saving} onClick={() => setRemoveRoleTarget({ email: assignment.user.email, role: assignment.role })}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {roleAssignments.length === 0 ? (
                <tr><td colSpan={4} className="shell-table-empty">No role assignments yet. Assign a role above to get started.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <ToastNotification open={!!toast} tone={toast?.tone ?? "info"} message={toast?.message ?? ""} onClose={() => setToast(null)} />
      <ConfirmationModal
        open={!!removeRoleTarget}
        title="Remove Role Assignment"
        description={
          removeRoleTarget
            ? `This will remove ${removeRoleTarget.role} from ${removeRoleTarget.email}. The user will lose access to this journal's ${removeRoleTarget.role} capabilities. Continue?`
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
