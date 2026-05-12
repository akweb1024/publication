"use client";

import { useEffect, useState } from "react";
import ErrorAlert from "../../../components/ErrorAlert";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    loadAudit(journalSlug).catch((err: unknown) => setError(errorMessage(err) || "Failed to load audit logs"));
  }, [journalSlug]);

  if (loading) return <p>Loading audit dashboard...</p>;

  return (
    <main className="main-stack">
      <section className="hero">
        <h1>Audit Logs</h1>
        <p>Trace sensitive editorial and policy actions for compliance and incident review.</p>
      </section>

      {error ? <ErrorAlert message={error} /> : null}

      <section className="card">
        <p className="eyebrow">Journal</p>
        <select className="select" value={journalSlug} onChange={(event) => setJournalSlug(event.target.value)}>
          {journals.map((journal) => (
            <option key={journal.id} value={journal.slug}>
              {journal.title}
            </option>
          ))}
        </select>
      </section>

      <section className="card">
        <p className="eyebrow">Recent Events</p>
        <ul className="list" style={{ marginTop: 8 }}>
          {items.map((item) => (
            <li className="list-item" key={item.id}>
              <p style={{ fontWeight: 700 }}>{item.action}</p>
              <p className="muted">
                {item.entityType} • {item.entityId}
              </p>
              <p className="muted">
                Actor: {item.actor?.email ?? "Unknown"} • {new Date(item.occurredAt).toLocaleString()}
              </p>
              {item.metadataJson ? <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(item.metadataJson)}</pre> : null}
            </li>
          ))}
          {items.length === 0 ? <li className="list-item">No audit events found.</li> : null}
        </ul>
      </section>
    </main>
  );
}
