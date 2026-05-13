"use client";

import { useEffect, useMemo, useState } from "react";
import ErrorAlert from "../../../components/ErrorAlert";
import AppShell from "../../../components/dashboard/AppShell";
import StatusBadge from "../../../components/dashboard/StatusBadge";
import ToastNotification from "../../../components/dashboard/ToastNotification";
import SkeletonBlock from "../../../components/dashboard/SkeletonBlock";
import { apiJson } from "../../../lib/clientApi";
import { errorMessage } from "../../../lib/errorMessage";

type Journal = { id: string; slug: string; title: string };
type AuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  actor?: { id: string; email: string; name: string } | null;
  metadataJson?: Record<string, unknown> | null;
};

export default function AuditDashboardPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [journalSlug, setJournalSlug] = useState("");
  const [items, setItems] = useState<AuditItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) =>
      item.action.toLowerCase().includes(q) ||
      item.entityType.toLowerCase().includes(q) ||
      item.entityId.toLowerCase().includes(q) ||
      (item.actor?.email?.toLowerCase().includes(q) ?? false) ||
      (item.actor?.name?.toLowerCase().includes(q) ?? false)
    );
  }, [items, searchQuery]);

  async function loadAudit(slug: string) {
    const res = await apiJson<{ items: AuditItem[] }>(`/journals/${encodeURIComponent(slug)}/audit-logs?limit=100`, {
      method: "GET",
    });
    setItems(res.items);
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
        setJournalSlug(first);
        if (first) await loadAudit(first);
      } catch (err: unknown) {
        if (!mounted) return;
        setError(errorMessage(err) || "Failed to load audit dashboard");
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
    if (!journalSlug) return;
    loadAudit(journalSlug).catch((err: unknown) => {
      setError(errorMessage(err) || "Failed to load audit logs");
      setToast({ tone: "error", message: "Failed to load audit logs." });
    });
  }, [journalSlug]);

  if (loading) {
    return (
      <AppShell
        title="Loading..."
        sectionLabel="Audit"
        breadcrumbItems={[{ label: "Dashboard", href: "/dashboard" }, { label: "Audit", href: "/dashboard/audit" }]}
        helpTopic="Audit Logs"
      >
        <SkeletonBlock height={44} />
        <SkeletonBlock height={120} />
        <SkeletonBlock height={180} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Audit Logs"
      sectionLabel="Audit & Reports"
      description="Trace sensitive editorial and policy actions for compliance and incident review."
      selectedJournalLabel={journals.find((j) => j.slug === journalSlug)?.title ?? ""}
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Audit", href: "/dashboard/audit" },
        { label: "Activity Logs", href: "/dashboard/audit" },
      ]}
      journals={journals}
      selectedJournalSlug={journalSlug}
      onJournalChange={setJournalSlug}
      quickActions={[
        { label: "Journal Settings", href: "/dashboard/journals", variant: "ghost" },
        { label: "Storage", href: "/dashboard/storage", variant: "ghost" },
      ]}
      helpTopic="Audit Logs"
    >
      {error ? <ErrorAlert message={error} /> : null}

      {/* Stats */}
      <div className="shell-stats-grid">
        <div className="shell-stat-card">
          <span className="shell-stat-icon">📋</span>
          <p className="shell-stat-label">Total Events</p>
          <p className="shell-stat-value">{items.length}</p>
        </div>
        <div className="shell-stat-card">
          <span className="shell-stat-icon">🔍</span>
          <p className="shell-stat-label">Filtered</p>
          <p className="shell-stat-value">{filteredItems.length}</p>
          {searchQuery.trim() ? <p className="shell-stat-hint">Search results</p> : null}
        </div>
      </div>

      {/* Search */}
      <div className="shell-form-section">
        <div className="shell-form-section-header">
          <h3>🔍 Search & Filter <StatusBadge label={`${filteredItems.length} results`} tone="info" /></h3>
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="audit-search">Search audit events</label>
          <input id="audit-search" className="input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by action, entity type, actor name or email..." />
          <p className="shell-field-hint">Filter events by action name, entity type, entity ID, or actor details.</p>
        </div>
      </div>

      {/* Audit table */}
      <div className="shell-table-wrap">
        <table className="shell-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Entity</th>
              <th>Actor</th>
              <th>Time</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td style={{ fontWeight: 600 }}>{item.action}</td>
                <td>
                  <span>{item.entityType}</span>
                  <br />
                  <span className="muted" style={{ fontSize: "0.82rem" }}>{item.entityId}</span>
                </td>
                <td>{item.actor?.name ?? "Unknown"}<br /><span className="muted" style={{ fontSize: "0.82rem" }}>{item.actor?.email ?? ""}</span></td>
                <td className="muted" style={{ fontSize: "0.86rem" }}>{new Date(item.occurredAt).toLocaleString()}</td>
                <td>
                  {item.metadataJson ? (
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "0.82rem", maxWidth: 300 }}>{JSON.stringify(item.metadataJson, null, 2)}</pre>
                  ) : (
                    <span className="muted">No details</span>
                  )}
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 ? (
              <tr><td colSpan={5} className="shell-table-empty">
                {searchQuery.trim() ? "No events matching your search." : "No audit events found for this journal."}
              </td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ToastNotification open={!!toast} tone={toast?.tone ?? "info"} message={toast?.message ?? ""} onClose={() => setToast(null)} />
    </AppShell>
  );
}
