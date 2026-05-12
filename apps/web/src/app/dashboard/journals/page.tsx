"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiJson } from "../../../lib/clientApi";
import { errorMessage } from "../../../lib/errorMessage";
import ErrorAlert from "../../../components/ErrorAlert";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [issnPrint, setIssnPrint] = useState("");
  const [issnOnline, setIssnOnline] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [brandingJsonText, setBrandingJsonText] = useState("{}");
  const [requiredPolicyKeysText, setRequiredPolicyKeysText] = useState("");
  const [roleAssignments, setRoleAssignments] = useState<JournalRoleAssignment[]>([]);
  const [roleEmail, setRoleEmail] = useState("");
  const [roleName, setRoleName] = useState<(typeof ROLE_OPTIONS)[number]>("SUBSCRIBER");
  const [subscriberStartAt, setSubscriberStartAt] = useState("");
  const [subscriberEndAt, setSubscriberEndAt] = useState("");

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
  const issnPrintError =
    normalizedIssnPrint && !issnPattern.test(normalizedIssnPrint)
      ? "ISSN format must be 1234-5678 (last character can be X)."
      : null;
  const issnOnlineError =
    normalizedIssnOnline && !issnPattern.test(normalizedIssnOnline)
      ? "ISSN format must be 1234-5678 (last character can be X)."
      : null;
  const brandingJsonError = useMemo(() => {
    try {
      JSON.parse(brandingJsonText || "{}");
      return null;
    } catch (err: unknown) {
      return errorMessage(err) || "Invalid JSON";
    }
  }, [brandingJsonText]);
  const requiredPolicyKeysError =
    normalizedRequiredPolicyKeys.length === 0 ? "Provide at least one required policy key." : null;
  const titleError = !title.trim() ? "Title is required." : null;
  const timezoneError = !timezone.trim() ? "Timezone is required." : null;
  const canSave =
    !saving &&
    !titleError &&
    !timezoneError &&
    !issnPrintError &&
    !issnOnlineError &&
    !brandingJsonError &&
    !requiredPolicyKeysError;

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
    const roleRes = await apiJson<{ items: JournalRoleAssignment[] }>(`/journals/${encodeURIComponent(slug)}/roles`, { method: "GET" });
    setRoleAssignments(roleRes.items);
  }

  useEffect(() => {
    let mounted = true;
    async function boot() {
      setLoading(true);
      setError(null);
      try {
        await apiJson("/auth/session", { method: "GET" });
        const response = await apiJson<{ items: Journal[] }>("/journals", { method: "GET" });
        if (!mounted) return;
        setJournals(response.items);
        const first = response.items[0]?.slug ?? "";
        setJournalSlug(first);
        if (first) await loadJournal(first);
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
    setMessage(null);
    try {
      await loadJournal(nextSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to load selected journal");
    }
  }

  async function save() {
    if (!journalSlug) return;
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setMessage(null);
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
      setMessage("Journal settings saved.");
      await loadJournal(journalSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to save journal settings");
    } finally {
      setSaving(false);
    }
  }

  async function assignRole() {
    if (!journalSlug || !roleEmail.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiJson(`/journals/${encodeURIComponent(journalSlug)}/roles`, {
        method: "POST",
        body: JSON.stringify({
          email: roleEmail.trim(),
          role: roleName,
          subscriptionStartAt:
            roleName === "SUBSCRIBER" && subscriberStartAt
              ? new Date(subscriberStartAt).toISOString()
              : undefined,
          subscriptionEndAt:
            roleName === "SUBSCRIBER" && subscriberEndAt
              ? new Date(subscriberEndAt).toISOString()
              : undefined,
        }),
      });
      setMessage(`Assigned ${roleName} to ${roleEmail.trim()}.`);
      setRoleEmail("");
      setSubscriberStartAt("");
      setSubscriberEndAt("");
      await loadJournal(journalSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to assign role");
    } finally {
      setSaving(false);
    }
  }

  async function removeRole(email: string, role: string) {
    if (!journalSlug) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiJson(`/journals/${encodeURIComponent(journalSlug)}/roles/remove`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
      setMessage(`Removed ${role} from ${email}.`);
      await loadJournal(journalSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to remove role");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading journal settings...</p>;

  return (
    <main className="main-stack">
      <section className="hero">
        <h1>Journal Settings</h1>
        <p>Edit your journal profile, ISSN details, branding JSON, and required policy keys.</p>
        <div className="meta-row">
          <span className="chip">{selectedJournal?.title ?? "Select journal"}</span>
          <Link href="/dashboard/publishing" className="button button-ghost compact">
            Back to Publishing
          </Link>
        </div>
      </section>

      {message ? <p style={{ color: "var(--accent-2)", fontWeight: 700 }}>{message}</p> : null}
      {error ? <ErrorAlert message={error} /> : null}

      <section className="card">
        <p className="eyebrow">Target Journal</p>
        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="journal-slug">Journal</label>
          <select
            id="journal-slug"
            className="select"
            value={journalSlug}
            onChange={(event) => handleJournalSwitch(event.target.value)}
            disabled={saving}
          >
            {journals.map((journal) => (
              <option key={journal.id} value={journal.slug}>
                {journal.title}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Profile</p>
        <div className="grid" style={{ marginTop: 8 }}>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
            {titleError ? <p className="alert">{titleError}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="timezone">Timezone</label>
            <input
              id="timezone"
              className="input"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
            {timezoneError ? <p className="alert">{timezoneError}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="issn-print">ISSN (Print)</label>
            <input
              id="issn-print"
              className="input"
              value={issnPrint}
              onChange={(event) => setIssnPrint(formatIssnInput(event.target.value))}
            />
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              Expected format: 1234-5678 (last character may be X).
            </p>
            {issnPrintError ? <p className="alert">{issnPrintError}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="issn-online">ISSN (Online)</label>
            <input
              id="issn-online"
              className="input"
              value={issnOnline}
              onChange={(event) => setIssnOnline(formatIssnInput(event.target.value))}
            />
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              Expected format: 1234-5678 (last character may be X).
            </p>
            {issnOnlineError ? <p className="alert">{issnOnlineError}</p> : null}
          </div>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            className="input"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Policies & Branding</p>
        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="required-policy-keys">Required Policy Keys (comma-separated)</label>
          <input
            id="required-policy-keys"
            className="input"
            value={requiredPolicyKeysText}
            onChange={(event) => setRequiredPolicyKeysText(event.target.value)}
            placeholder="peer-review, ethics, plagiarism"
          />
          {requiredPolicyKeysError ? <p className="alert">{requiredPolicyKeysError}</p> : null}
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label htmlFor="branding-json">Branding JSON</label>
          <textarea
            id="branding-json"
            className="input"
            rows={12}
            value={brandingJsonText}
            onChange={(event) => setBrandingJsonText(event.target.value)}
          />
          {brandingJsonError ? <p className="alert">Invalid JSON: {brandingJsonError}</p> : null}
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="button compact" type="button" disabled={!canSave} onClick={save}>
            {saving ? "Saving..." : "Save Journal Settings"}
          </button>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Access Entitlements</p>
        <p className="muted" style={{ marginTop: 6 }}>
          Assign journal-specific roles. Use <strong>SUBSCRIBER</strong> for restricted PDF entitlements.
        </p>
        <div className="grid" style={{ marginTop: 8, gridTemplateColumns: "minmax(220px,1fr) minmax(180px,220px) auto" }}>
          <div className="field">
            <label htmlFor="role-email">User Email</label>
            <input
              id="role-email"
              className="input"
              value={roleEmail}
              onChange={(event) => setRoleEmail(event.target.value)}
              placeholder="user@example.com"
              disabled={saving}
            />
          </div>
          <div className="field">
            <label htmlFor="role-name">Role</label>
            <select id="role-name" className="select" value={roleName} onChange={(event) => setRoleName(event.target.value as (typeof ROLE_OPTIONS)[number])} disabled={saving}>
              {ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div style={{ alignSelf: "end" }}>
            <button className="button compact" type="button" disabled={saving || !roleEmail.trim()} onClick={assignRole}>
              Assign Role
            </button>
          </div>
        </div>
        {roleName === "SUBSCRIBER" ? (
          <div className="grid" style={{ marginTop: 8, gridTemplateColumns: "minmax(220px,1fr) minmax(220px,1fr)" }}>
            <div className="field">
              <label htmlFor="subscriber-start-at">Subscription Start (optional)</label>
              <input
                id="subscriber-start-at"
                className="input"
                type="datetime-local"
                value={subscriberStartAt}
                onChange={(event) => setSubscriberStartAt(event.target.value)}
                disabled={saving}
              />
            </div>
            <div className="field">
              <label htmlFor="subscriber-end-at">Subscription End (optional)</label>
              <input
                id="subscriber-end-at"
                className="input"
                type="datetime-local"
                value={subscriberEndAt}
                onChange={(event) => setSubscriberEndAt(event.target.value)}
                disabled={saving}
              />
            </div>
          </div>
        ) : null}
        <ul className="list" style={{ marginTop: 12 }}>
          {roleAssignments.map((assignment) => (
            <li className="list-item" key={assignment.id}>
              <p style={{ fontWeight: 700 }}>{assignment.role}</p>
              <p className="muted">{assignment.user.name} • {assignment.user.email}</p>
              {assignment.role === "SUBSCRIBER" ? (
                <p className="muted">
                  {assignment.subscriptionStartAt ? `Start: ${new Date(assignment.subscriptionStartAt).toLocaleString()}` : "Start: immediate"}{" "}
                  •{" "}
                  {assignment.subscriptionEndAt ? `End: ${new Date(assignment.subscriptionEndAt).toLocaleString()}` : "End: none"}
                  {assignment.subscriptionEndAt && new Date(assignment.subscriptionEndAt) < new Date() ? " • Expired" : ""}
                </p>
              ) : null}
              <div>
                <button
                  className="button button-ghost compact"
                  type="button"
                  disabled={saving}
                  onClick={() => removeRole(assignment.user.email, assignment.role)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
          {roleAssignments.length === 0 ? <li className="list-item">No role assignments yet.</li> : null}
        </ul>
      </section>
    </main>
  );
}
