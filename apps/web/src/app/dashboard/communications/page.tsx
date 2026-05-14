"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ErrorAlert from "../../../components/ErrorAlert";
import AppShell from "../../../components/dashboard/AppShell";
import SkeletonBlock from "../../../components/dashboard/SkeletonBlock";
import StatusBadge from "../../../components/dashboard/StatusBadge";
import ToastNotification from "../../../components/dashboard/ToastNotification";
import { apiJson } from "../../../lib/clientApi";
import { errorMessage } from "../../../lib/errorMessage";

type Journal = { id: string; slug: string; title: string };
type TabKey = "threads" | "templates" | "events" | "preferences";
type Template = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  bodyHtml: string;
  variables: string[];
  active: boolean;
  updatedAt: string;
};
type Message = {
  id: string;
  createdAt: string;
  toEmails: string[];
  subjectOverride: string | null;
  templateKey: string | null;
  deliveryStatus: "QUEUED" | "SENT" | "FAILED";
  bodyHtml: string;
};
type Thread = {
  id: string;
  subject: string;
  createdAt: string;
  updatedAt: string;
  submission: { id: string; trackingNumber: string | null; manuscriptTitle: string | null } | null;
  createdBy: { id: string; email: string; name: string } | null;
  messages: Message[];
  _count: { messages: number };
};
type NotificationEvent = {
  id: string;
  eventKey: string;
  templateKey: string | null;
  recipientEmail: string;
  subject: string;
  status: "PENDING" | "QUEUED" | "SENT" | "FAILED" | "SKIPPED";
  createdAt: string;
  queuedAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
};
type Preference = {
  id: string;
  eventKey: string;
  emailEnabled: boolean;
  journal: Journal;
};

const EVENT_KEYS = [
  "submission.decision",
  "reviewer.invite",
  "submission.confirmation",
  "revision.request",
  "article.published",
  "manual.message",
  "template.test",
];

function statusTone(status: NotificationEvent["status"] | Message["deliveryStatus"]) {
  if (status === "FAILED") return "danger" as const;
  if (status === "SKIPPED") return "warn" as const;
  if (status === "SENT") return "ok" as const;
  return "info" as const;
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

function variablesText(template: Template | null) {
  return template?.variables.join(", ") ?? "";
}

function CommunicationsPageContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabKey | null) ?? "threads";
  const [tab, setTab] = useState<TabKey>(["threads", "templates", "events", "preferences"].includes(initialTab) ? initialTab : "threads");
  const [journals, setJournals] = useState<Journal[]>([]);
  const [journalSlug, setJournalSlug] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);

  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [templateVariables, setTemplateVariables] = useState("");
  const [templateActive, setTemplateActive] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [messageToEmails, setMessageToEmails] = useState("");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null,
    [templates, selectedTemplateId]
  );
  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? threads[0] ?? null,
    [threads, selectedThreadId]
  );
  const selectedJournalTitle = useMemo(
    () => journals.find((journal) => journal.slug === journalSlug)?.title ?? "",
    [journals, journalSlug]
  );
  const queuedEvents = useMemo(() => events.filter((event) => event.status === "QUEUED").length, [events]);
  const failedEvents = useMemo(() => events.filter((event) => event.status === "FAILED").length, [events]);

  const loadJournalData = useCallback(async (slug: string) => {
    const [templateRes, commsRes, prefRes] = await Promise.all([
      apiJson<{ items: Template[] }>(`/journals/${encodeURIComponent(slug)}/email-templates`, { method: "GET" }),
      apiJson<{ threads: Thread[]; events: NotificationEvent[] }>(`/journals/${encodeURIComponent(slug)}/communications?limit=100`, { method: "GET" }),
      apiJson<{ items: Preference[] }>(`/me/notification-preferences?journalSlug=${encodeURIComponent(slug)}`, { method: "GET" }),
    ]);
    setTemplates(templateRes.items);
    setThreads(commsRes.threads);
    setEvents(commsRes.events);
    setPreferences(prefRes.items);
    setSelectedTemplateId((current) => templateRes.items.some((template) => template.id === current) ? current : templateRes.items[0]?.id ?? "");
    setSelectedThreadId((current) => commsRes.threads.some((thread) => thread.id === current) ? current : commsRes.threads[0]?.id ?? "");
  }, []);

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
        if (first) await loadJournalData(first);
      } catch (err: unknown) {
        if (mounted) setError(errorMessage(err) || "Failed to load communications center");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();
    return () => {
      mounted = false;
    };
  }, [loadJournalData]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setTemplateName(selectedTemplate.name);
    setTemplateDescription(selectedTemplate.description ?? "");
    setTemplateSubject(selectedTemplate.subject);
    setTemplateBody(selectedTemplate.bodyHtml);
    setTemplateVariables(variablesText(selectedTemplate));
    setTemplateActive(selectedTemplate.active);
  }, [selectedTemplate]);

  useEffect(() => {
    if (!selectedThread) return;
    setMessageSubject(selectedThread.subject);
  }, [selectedThread]);

  async function onJournalChange(nextSlug: string) {
    setJournalSlug(nextSlug);
    setError(null);
    try {
      await loadJournalData(nextSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to load communication data");
      setToast({ tone: "error", message: "Failed to load communication data." });
    }
  }

  async function saveSelectedTemplate() {
    if (!selectedTemplate) return;
    setSaving(true);
    setError(null);
    try {
      await apiJson(`/email-templates/${encodeURIComponent(selectedTemplate.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          subject: templateSubject.trim(),
          bodyHtml: templateBody,
          variables: templateVariables.split(",").map((item) => item.trim()).filter(Boolean),
          active: templateActive,
        }),
      });
      setToast({ tone: "success", message: "Email template saved." });
      await loadJournalData(journalSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to save email template");
      setToast({ tone: "error", message: "Failed to save email template." });
    } finally {
      setSaving(false);
    }
  }

  async function sendTemplateTest() {
    if (!selectedTemplate) return;
    setTesting(true);
    setError(null);
    try {
      await apiJson(`/email-templates/${encodeURIComponent(selectedTemplate.id)}/test`, {
        method: "POST",
        body: JSON.stringify({ toEmail: testEmail.trim() || undefined, variables: {} }),
      });
      setToast({ tone: "success", message: "Test email queued." });
      await loadJournalData(journalSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to queue test email");
      setToast({ tone: "error", message: "Failed to queue test email." });
    } finally {
      setTesting(false);
    }
  }

  async function sendManualMessage() {
    if (!selectedThread) return;
    const toEmails = messageToEmails.split(",").map((item) => item.trim()).filter(Boolean);
    if (toEmails.length === 0) {
      setError("Enter at least one recipient email.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await apiJson(`/communications/${encodeURIComponent(selectedThread.id)}/messages`, {
        method: "POST",
        body: JSON.stringify({
          toEmails,
          subjectOverride: messageSubject.trim() || undefined,
          bodyHtml: messageBody,
        }),
      });
      setMessageToEmails("");
      setMessageBody("");
      setToast({ tone: "success", message: "Message queued." });
      await loadJournalData(journalSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to queue message");
      setToast({ tone: "error", message: "Failed to queue message." });
    } finally {
      setSending(false);
    }
  }

  async function togglePreference(eventKey: string, emailEnabled: boolean) {
    if (!journalSlug) return;
    try {
      await apiJson("/me/notification-preferences", {
        method: "PATCH",
        body: JSON.stringify({ journalSlug, eventKey, emailEnabled }),
      });
      setToast({ tone: "success", message: "Notification preference updated." });
      await loadJournalData(journalSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to update notification preference");
      setToast({ tone: "error", message: "Failed to update notification preference." });
    }
  }

  if (loading) {
    return (
      <AppShell title="Loading..." sectionLabel="Communications" breadcrumbItems={[{ label: "Dashboard", href: "/dashboard" }, { label: "Communications", href: "/dashboard/communications" }]} helpTopic="Communications">
        <SkeletonBlock height={44} />
        <SkeletonBlock height={140} />
        <SkeletonBlock height={220} />
      </AppShell>
    );
  }

  const preferenceMap = new Map(preferences.map((preference) => [preference.eventKey, preference.emailEnabled]));

  return (
    <AppShell
      title="Communications Center"
      sectionLabel="Communications"
      description="Manage journal email templates, outbound message history, notification events, and personal delivery preferences."
      selectedJournalLabel={selectedJournalTitle}
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Communications", href: "/dashboard/communications" },
      ]}
      journals={journals}
      selectedJournalSlug={journalSlug}
      onJournalChange={onJournalChange}
      quickActions={[
        { label: "Templates", onClick: () => setTab("templates"), variant: tab === "templates" ? "primary" : "ghost" },
        { label: "Events", onClick: () => setTab("events"), variant: tab === "events" ? "primary" : "ghost" },
        { label: "Preferences", onClick: () => setTab("preferences"), variant: tab === "preferences" ? "primary" : "ghost" },
      ]}
      helpTopic="Communications"
    >
      {error ? <ErrorAlert message={error} /> : null}

      <div className="shell-stats-grid">
        <div className="shell-stat-card">
          <p className="shell-stat-label">Templates</p>
          <p className="shell-stat-value">{templates.length}</p>
          <p className="shell-stat-hint">{templates.filter((template) => template.active).length} active</p>
        </div>
        <div className="shell-stat-card">
          <p className="shell-stat-label">Threads</p>
          <p className="shell-stat-value">{threads.length}</p>
          <p className="shell-stat-hint">Latest journal conversations</p>
        </div>
        <div className="shell-stat-card">
          <p className="shell-stat-label">Queued Events</p>
          <p className="shell-stat-value">{queuedEvents}</p>
          <p className="shell-stat-hint">Awaiting worker delivery</p>
        </div>
        <div className="shell-stat-card">
          <p className="shell-stat-label">Failures</p>
          <p className="shell-stat-value">{failedEvents}</p>
          <p className="shell-stat-hint">Needs operator review</p>
        </div>
      </div>

      <div className="shell-tab-row" role="tablist" aria-label="Communications sections">
        {[
          ["threads", "Message Center"],
          ["templates", "Email Templates"],
          ["events", "Notification Events"],
          ["preferences", "My Preferences"],
        ].map(([key, label]) => (
          <button key={key} type="button" className={`shell-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key as TabKey)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "templates" ? (
        <div className="dashboard-grid-two">
          <div className="shell-table-wrap">
            <div className="shell-table-toolbar">
              <div className="shell-table-toolbar-left">
                <strong>Email Templates</strong>
                <StatusBadge label={`${templates.length}`} tone="info" />
              </div>
            </div>
            <table className="shell-table">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Key</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} className="shell-table-row-link" onClick={() => setSelectedTemplateId(template.id)}>
                    <td style={{ fontWeight: template.id === selectedTemplate?.id ? 700 : 500 }}>{template.name}</td>
                    <td className="muted">{template.key}</td>
                    <td><StatusBadge label={template.active ? "Active" : "Inactive"} tone={template.active ? "ok" : "warn"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="shell-form-section">
            <div className="shell-form-section-header">
              <h3>{selectedTemplate?.name ?? "Template"}</h3>
              {selectedTemplate ? <StatusBadge label={selectedTemplate.key} tone="info" /> : null}
            </div>
            {selectedTemplate ? (
              <div className="shell-step-form">
                <div className="field">
                  <label htmlFor="template-name">Name</label>
                  <input id="template-name" className="input" value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="template-description">Description</label>
                  <input id="template-description" className="input" value={templateDescription} onChange={(event) => setTemplateDescription(event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="template-subject">Subject</label>
                  <input id="template-subject" className="input" value={templateSubject} onChange={(event) => setTemplateSubject(event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="template-body">Body HTML</label>
                  <textarea id="template-body" rows={10} value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="template-variables">Variables</label>
                  <input id="template-variables" className="input" value={templateVariables} onChange={(event) => setTemplateVariables(event.target.value)} />
                  <p className="shell-field-hint">Comma-separated variable keys used in the subject or body.</p>
                </div>
                <label className="shell-toggle-row">
                  <input type="checkbox" checked={templateActive} onChange={(event) => setTemplateActive(event.target.checked)} />
                  <span>Template active</span>
                </label>
                <div className="shell-form-actions">
                  <input className="input" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="Optional test recipient" style={{ maxWidth: 260 }} />
                  <button type="button" className="button button-ghost compact" onClick={sendTemplateTest} disabled={testing}>{testing ? "Queueing..." : "Send Test"}</button>
                  <button type="button" className="button button-primary compact" onClick={saveSelectedTemplate} disabled={saving}>{saving ? "Saving..." : "Save Template"}</button>
                </div>
              </div>
            ) : <p className="muted">No template selected.</p>}
          </div>
        </div>
      ) : null}

      {tab === "threads" ? (
        <div className="dashboard-grid-two">
          <div className="shell-table-wrap">
            <div className="shell-table-toolbar">
              <div className="shell-table-toolbar-left">
                <strong>Message Threads</strong>
                <StatusBadge label={`${threads.length}`} tone="info" />
              </div>
            </div>
            <table className="shell-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Submission</th>
                  <th>Messages</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {threads.map((thread) => (
                  <tr key={thread.id} className="shell-table-row-link" onClick={() => setSelectedThreadId(thread.id)}>
                    <td style={{ fontWeight: thread.id === selectedThread?.id ? 700 : 500 }}>{thread.subject}</td>
                    <td>{thread.submission?.trackingNumber ?? "General"}</td>
                    <td>{thread._count.messages}</td>
                    <td className="muted">{formatDate(thread.updatedAt)}</td>
                  </tr>
                ))}
                {threads.length === 0 ? <tr><td colSpan={4} className="shell-table-empty">No communication threads found.</td></tr> : null}
              </tbody>
            </table>
          </div>

          <div className="shell-form-section">
            <div className="shell-form-section-header">
              <h3>{selectedThread?.subject ?? "Thread Detail"}</h3>
              {selectedThread ? <StatusBadge label={`${selectedThread._count.messages} messages`} tone="info" /> : null}
            </div>
            {selectedThread ? (
              <div className="shell-step-form">
                <div className="shell-activity-list">
                  {selectedThread.messages.map((message) => (
                    <div key={message.id} className="shell-activity-item">
                      <span className="shell-activity-dot" style={{ background: "#4f46e5" }} />
                      <div>
                        <strong>{message.subjectOverride ?? selectedThread.subject}</strong>
                        <p className="muted" style={{ margin: "4px 0" }}>{message.toEmails.join(", ")}</p>
                        <StatusBadge label={message.deliveryStatus} tone={statusTone(message.deliveryStatus)} />
                        <span className="shell-activity-time"> {formatDate(message.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="field">
                  <label htmlFor="manual-recipients">Recipients</label>
                  <input id="manual-recipients" className="input" value={messageToEmails} onChange={(event) => setMessageToEmails(event.target.value)} placeholder="name@example.com, editor@example.com" />
                </div>
                <div className="field">
                  <label htmlFor="manual-subject">Subject</label>
                  <input id="manual-subject" className="input" value={messageSubject} onChange={(event) => setMessageSubject(event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="manual-body">Body HTML</label>
                  <textarea id="manual-body" rows={6} value={messageBody} onChange={(event) => setMessageBody(event.target.value)} />
                </div>
                <div className="shell-form-actions">
                  <button type="button" className="button button-primary compact" onClick={sendManualMessage} disabled={sending}>{sending ? "Queueing..." : "Queue Message"}</button>
                </div>
              </div>
            ) : <p className="muted">Select a thread to view messages.</p>}
          </div>
        </div>
      ) : null}

      {tab === "events" ? (
        <div className="shell-table-wrap">
          <div className="shell-table-toolbar">
            <div className="shell-table-toolbar-left">
              <strong>Notification Events</strong>
              <StatusBadge label={`${events.length}`} tone="info" />
            </div>
          </div>
          <table className="shell-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Recipient</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>
                    <strong>{event.eventKey}</strong>
                    <br />
                    <span className="muted">{event.templateKey ?? "manual"}</span>
                  </td>
                  <td>{event.recipientEmail}</td>
                  <td>{event.subject}</td>
                  <td>
                    <StatusBadge label={event.status} tone={statusTone(event.status)} />
                    {event.errorMessage ? <p className="shell-field-error">{event.errorMessage}</p> : null}
                  </td>
                  <td className="muted">{formatDate(event.createdAt)}</td>
                </tr>
              ))}
              {events.length === 0 ? <tr><td colSpan={5} className="shell-table-empty">No notification events found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "preferences" ? (
        <div className="shell-form-section">
          <div className="shell-form-section-header">
            <h3>My Email Preferences</h3>
            <StatusBadge label={selectedJournalTitle || "Journal"} tone="info" />
          </div>
          <div className="shell-preference-list">
            {EVENT_KEYS.map((eventKey) => {
              const enabled = preferenceMap.get(eventKey) ?? true;
              return (
                <label key={eventKey} className="shell-toggle-row">
                  <input type="checkbox" checked={enabled} onChange={(event) => togglePreference(eventKey, event.target.checked)} />
                  <span>{eventKey}</span>
                  <StatusBadge label={enabled ? "Email on" : "Email off"} tone={enabled ? "ok" : "warn"} />
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      <ToastNotification open={!!toast} tone={toast?.tone ?? "info"} message={toast?.message ?? ""} onClose={() => setToast(null)} />
    </AppShell>
  );
}

export default function CommunicationsPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Loading..." sectionLabel="Communications" breadcrumbItems={[{ label: "Dashboard", href: "/dashboard" }, { label: "Communications", href: "/dashboard/communications" }]} helpTopic="Communications">
          <SkeletonBlock height={44} />
          <SkeletonBlock height={140} />
          <SkeletonBlock height={220} />
        </AppShell>
      }
    >
      <CommunicationsPageContent />
    </Suspense>
  );
}
