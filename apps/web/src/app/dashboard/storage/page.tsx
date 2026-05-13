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

type Journal = { id: string; slug: string; title: string };
type StorageConfig = {
  localPathPrefix: string;
  externalPathPrefixes: string[];
  defaultTarget: "LOCAL" | "EXTERNAL";
  externalProvider: "MINIO" | "S3" | "R2" | "GCS";
  externalEndpoint: string | null;
  externalRegion: string | null;
  externalBucket: string | null;
  externalForcePathStyle: boolean;
  hasExternalSecrets: boolean;
  secretUpdatedAt: string | null;
};
type SimulationResult = {
  key: string;
  simulation: {
    source: "default-env" | "journal-config";
    journalSlug: string | null;
    target: "LOCAL" | "EXTERNAL";
    provider: "DEFAULT_ENV" | "EXTERNAL_CONFIGURED" | "EXTERNAL_FALLBACK_DEFAULT";
    bucket: string;
    endpoint: string;
    region: string;
    reason: string;
  };
};
type DataSyncConfig = {
  enabled: boolean;
  autoSyncEnabled: boolean;
  hasValidatedConnection: boolean;
  hasExternalDatabaseUrl: boolean;
  lastTestedAt: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: "SUCCESS" | "FAILED" | null;
  lastSyncMessage: string | null;
};
type DataSyncRun = {
  id: string;
  status: "SUCCESS" | "FAILED";
  recordsSynced: number;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
};

const PROVIDERS: StorageConfig["externalProvider"][] = ["MINIO", "S3", "R2", "GCS"];

export default function StorageSettingsPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [journalSlug, setJournalSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const [confirmSyncOpen, setConfirmSyncOpen] = useState(false);

  const [localPathPrefix, setLocalPathPrefix] = useState("system");
  const [externalPathPrefixes, setExternalPathPrefixes] = useState("submissions, uploads, manuscripts, exports");
  const [defaultTarget, setDefaultTarget] = useState<"LOCAL" | "EXTERNAL">("EXTERNAL");
  const [externalProvider, setExternalProvider] = useState<StorageConfig["externalProvider"]>("MINIO");
  const [externalEndpoint, setExternalEndpoint] = useState("");
  const [externalRegion, setExternalRegion] = useState("");
  const [externalBucket, setExternalBucket] = useState("");
  const [externalForcePathStyle, setExternalForcePathStyle] = useState(true);
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [hasSecrets, setHasSecrets] = useState(false);
  const [secretUpdatedAt, setSecretUpdatedAt] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulationKey, setSimulationKey] = useState("");
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);

  const [dataSyncEnabled, setDataSyncEnabled] = useState(false);
  const [dataSyncAuto, setDataSyncAuto] = useState(false);
  const [externalDbUrl, setExternalDbUrl] = useState("");
  const [hasExternalDbUrl, setHasExternalDbUrl] = useState(false);
  const [dataSyncValidated, setDataSyncValidated] = useState(false);
  const [dataSyncLastTestedAt, setDataSyncLastTestedAt] = useState<string | null>(null);
  const [dataSyncLastSyncAt, setDataSyncLastSyncAt] = useState<string | null>(null);
  const [dataSyncLastSyncStatus, setDataSyncLastSyncStatus] = useState<"SUCCESS" | "FAILED" | null>(null);
  const [dataSyncLastSyncMessage, setDataSyncLastSyncMessage] = useState<string | null>(null);
  const [dataSyncRuns, setDataSyncRuns] = useState<DataSyncRun[]>([]);
  const [savingDataSync, setSavingDataSync] = useState(false);
  const [testingDataSync, setTestingDataSync] = useState(false);
  const [runningDataSync, setRunningDataSync] = useState(false);

  const externalPrefixes = useMemo(
    () => externalPathPrefixes.split(",").map((item) => item.trim()).filter(Boolean),
    [externalPathPrefixes]
  );

  const selectedJournalTitle = useMemo(
    () => journals.find((journal) => journal.slug === journalSlug)?.title ?? "No journal selected",
    [journals, journalSlug]
  );

  async function loadJournalConfig(slug: string) {
    const cfg = await apiJson<StorageConfig>(`/journals/${encodeURIComponent(slug)}/storage-config`, { method: "GET" });
    setLocalPathPrefix(cfg.localPathPrefix);
    setExternalPathPrefixes(cfg.externalPathPrefixes.join(", "));
    setDefaultTarget(cfg.defaultTarget);
    setExternalProvider(cfg.externalProvider);
    setExternalEndpoint(cfg.externalEndpoint ?? "");
    setExternalRegion(cfg.externalRegion ?? "");
    setExternalBucket(cfg.externalBucket ?? "");
    setExternalForcePathStyle(cfg.externalForcePathStyle);
    setHasSecrets(cfg.hasExternalSecrets);
    setSecretUpdatedAt(cfg.secretUpdatedAt);
    setAccessKeyId("");
    setSecretAccessKey("");
    setSimulationKey(`${slug}/submissions/example-file.pdf`);
    setSimulation(null);

    const syncCfg = await apiJson<DataSyncConfig>(`/journals/${encodeURIComponent(slug)}/data-sync-config`, { method: "GET" });
    setDataSyncEnabled(syncCfg.enabled);
    setDataSyncAuto(syncCfg.autoSyncEnabled);
    setHasExternalDbUrl(syncCfg.hasExternalDatabaseUrl);
    setDataSyncValidated(syncCfg.hasValidatedConnection);
    setDataSyncLastTestedAt(syncCfg.lastTestedAt);
    setDataSyncLastSyncAt(syncCfg.lastSyncAt);
    setDataSyncLastSyncStatus(syncCfg.lastSyncStatus);
    setDataSyncLastSyncMessage(syncCfg.lastSyncMessage);
    setExternalDbUrl("");

    const syncRuns = await apiJson<{ items: DataSyncRun[] }>(`/journals/${encodeURIComponent(slug)}/data-sync/runs?limit=20`, { method: "GET" });
    setDataSyncRuns(syncRuns.items);
  }

  useEffect(() => {
    let mounted = true;
    async function boot() {
      setLoading(true);
      setError(null);
      try {
        await apiJson("/auth/session", { method: "GET" });
        const list = await apiJson<{ items: Journal[] }>("/journals", { method: "GET" });
        if (!mounted) return;
        setJournals(list.items);
        const first = list.items[0]?.slug ?? "";
        setJournalSlug(first);
        if (first) await loadJournalConfig(first);
      } catch (err: unknown) {
        if (!mounted) return;
        setError(errorMessage(err) || "Failed to load storage settings");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();
    return () => {
      mounted = false;
    };
  }, []);

  async function onJournalChange(nextSlug: string) {
    setJournalSlug(nextSlug);
        setError(null);
    try {
      await loadJournalConfig(nextSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to load journal storage config");
    }
  }

  async function saveConfig() {
    if (!journalSlug) return;
    setSaving(true);
    setError(null);
        try {
      await apiJson(`/journals/${encodeURIComponent(journalSlug)}/storage-config`, {
        method: "PATCH",
        body: JSON.stringify({
          localPathPrefix: localPathPrefix.trim(),
          externalPathPrefixes: externalPrefixes,
          defaultTarget,
          externalProvider,
          externalEndpoint: externalEndpoint.trim() || null,
          externalRegion: externalRegion.trim() || null,
          externalBucket: externalBucket.trim() || null,
          externalForcePathStyle,
          externalSecrets:
            accessKeyId.trim() && secretAccessKey.trim()
              ? { accessKeyId: accessKeyId.trim(), secretAccessKey: secretAccessKey.trim() }
              : undefined,
        }),
      });
      setToast({ tone: "success", message: "Storage configuration saved." });
      await loadJournalConfig(journalSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to save storage configuration");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    if (!journalSlug) return;
    if (!externalEndpoint.trim() || !externalRegion.trim() || !externalBucket.trim() || !accessKeyId.trim() || !secretAccessKey.trim()) {
      setError("To test connection, provide endpoint, region, bucket, access key, and secret key.");
      return;
    }
    setTesting(true);
    setError(null);
        try {
      await apiJson(`/journals/${encodeURIComponent(journalSlug)}/storage-config/test`, {
        method: "POST",
        body: JSON.stringify({
          externalProvider,
          externalEndpoint: externalEndpoint.trim(),
          externalRegion: externalRegion.trim(),
          externalBucket: externalBucket.trim(),
          externalForcePathStyle,
          externalSecrets: {
            accessKeyId: accessKeyId.trim(),
            secretAccessKey: secretAccessKey.trim(),
          },
        }),
      });
      setToast({ tone: "success", message: "External storage connection test succeeded." });
    } catch (err: unknown) {
      setError(errorMessage(err) || "External storage connection test failed");
    } finally {
      setTesting(false);
    }
  }

  async function simulateRoute() {
    if (!journalSlug || !simulationKey.trim()) return;
    setSimulating(true);
    setError(null);
        try {
      const result = await apiJson<SimulationResult>(`/journals/${encodeURIComponent(journalSlug)}/storage-config/simulate`, {
        method: "POST",
        body: JSON.stringify({ key: simulationKey.trim() }),
      });
      setSimulation(result);
      setToast({ tone: "info", message: "Routing simulation completed." });
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to simulate storage routing");
    } finally {
      setSimulating(false);
    }
  }

  async function saveDataSyncConfig() {
    if (!journalSlug) return;
    setSavingDataSync(true);
    setError(null);
        try {
      await apiJson(`/journals/${encodeURIComponent(journalSlug)}/data-sync-config`, {
        method: "PATCH",
        body: JSON.stringify({
          enabled: dataSyncEnabled,
          autoSyncEnabled: dataSyncAuto,
          externalDatabaseUrl: externalDbUrl.trim() || undefined,
        }),
      });
      setToast({ tone: "success", message: "External database sync settings saved." });
      await loadJournalConfig(journalSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to save external database sync settings");
    } finally {
      setSavingDataSync(false);
    }
  }

  async function testDataSyncConnection() {
    if (!journalSlug) return;
    setTestingDataSync(true);
    setError(null);
        try {
      await apiJson(`/journals/${encodeURIComponent(journalSlug)}/data-sync-config/test`, {
        method: "POST",
        body: JSON.stringify({ externalDatabaseUrl: externalDbUrl.trim() || undefined }),
      });
      setToast({ tone: "success", message: "External database connection test succeeded." });
      await loadJournalConfig(journalSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "External database connection test failed");
    } finally {
      setTestingDataSync(false);
    }
  }

  async function runDataSyncNow() {
    if (!journalSlug) return;
    setRunningDataSync(true);
    setError(null);
        try {
      const result = await apiJson<{ ok: true; runId: string; recordsSynced: number }>(
        `/journals/${encodeURIComponent(journalSlug)}/data-sync/sync-now`,
        {
          method: "POST",
          body: JSON.stringify({ externalDatabaseUrl: externalDbUrl.trim() || undefined }),
        }
      );
      setToast({ tone: "success", message: `Data sync completed. Synced ${result.recordsSynced} records.` });
      await loadJournalConfig(journalSlug);
    } catch (err: unknown) {
      setError(errorMessage(err) || "Data sync failed");
      setToast({ tone: "error", message: "Data sync failed." });
    } finally {
      setRunningDataSync(false);
      setConfirmSyncOpen(false);
    }
  }

  function syncStatusTone() {
    if (runningDataSync) return "info" as const;
    if (dataSyncLastSyncStatus === "SUCCESS") return "ok" as const;
    if (dataSyncLastSyncStatus === "FAILED") return "danger" as const;
    if (dataSyncValidated) return "info" as const;
    if (hasExternalDbUrl) return "warn" as const;
    return "neutral" as const;
  }

  function syncStatusLabel() {
    if (runningDataSync) return "Syncing";
    if (dataSyncLastSyncStatus === "SUCCESS") return "Connected";
    if (dataSyncLastSyncStatus === "FAILED") return "Failed";
    if (dataSyncValidated) return "Connected";
    if (hasExternalDbUrl) return "Not Tested";
    return "Not Configured";
  }

  if (loading) {
    return (
      <main className="dashboard-page-content">
        <SkeletonBlock height={42} />
        <SkeletonBlock height={150} />
        <SkeletonBlock height={240} />
      </main>
    );
  }

  return (
    <AppShell
      title="Storage Settings"
      sectionLabel="Storage"
      description="Manage routing policy, external object storage credentials, and external database sync operations."
      selectedJournalLabel={selectedJournalTitle}
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Publishing", href: "/dashboard/publishing" },
        { label: "Storage Settings", href: "/dashboard/storage" },
      ]}
      journals={journals}
      selectedJournalSlug={journalSlug}
      onJournalChange={onJournalChange}
      quickActions={[
        { label: "Save Settings", onClick: saveConfig, variant: "primary" },
        { label: "Test Connection", onClick: testConnection, variant: "secondary" },
        { label: "Run Sync Now", onClick: () => setConfirmSyncOpen(true), variant: "ghost" },
      ]}
      workflowSteps={[
        { label: "Select Journal", state: "complete" },
        { label: "Configure Storage Method", state: "current" },
        { label: "Configure External Database", state: "current" },
        { label: "Test Connection", state: "upcoming" },
        { label: "Run Sync", state: "upcoming" },
        { label: "Review Sync History", state: "upcoming" },
      ]}
      actions={<StatusBadge label={syncStatusLabel()} tone={syncStatusTone()} />}
    >
      {error ? <ErrorAlert message={error} /> : null}

      <section className="card">
        <p className="eyebrow">External Database Sync</p>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <StatusBadge label={syncStatusLabel()} tone={syncStatusTone()} />
          <StatusBadge label={dataSyncValidated ? "Validated" : "Unvalidated"} tone={dataSyncValidated ? "ok" : "warn"} />
          <StatusBadge label={hasExternalDbUrl ? "URL Configured" : "URL Missing"} tone={hasExternalDbUrl ? "info" : "warn"} />
        </div>

        <div className="dashboard-grid-three" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="data-sync-enabled">Sync Enabled</label>
            <select id="data-sync-enabled" className="select" value={dataSyncEnabled ? "true" : "false"} onChange={(e) => setDataSyncEnabled(e.target.value === "true")}>
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="data-sync-auto">Auto Sync</label>
            <select id="data-sync-auto" className="select" value={dataSyncAuto ? "true" : "false"} onChange={(e) => setDataSyncAuto(e.target.value === "true")}>
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="external-db-url">External Postgres URL</label>
            <input
              id="external-db-url"
              className="input"
              type="password"
              value={externalDbUrl}
              onChange={(e) => setExternalDbUrl(e.target.value)}
              placeholder="postgresql://user:pass@host:5432/dbname?schema=public"
            />
            <p className="muted">Use full Postgres URL including database name and optional schema query.</p>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 8 }}>
          Last Tested: {dataSyncLastTestedAt ? new Date(dataSyncLastTestedAt).toLocaleString() : "Never"} | Last Synced: {dataSyncLastSyncAt ? new Date(dataSyncLastSyncAt).toLocaleString() : "Never"}
        </p>
        {dataSyncLastSyncMessage ? <p className="muted">Last Message: {dataSyncLastSyncMessage}</p> : null}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button className="button button-primary compact" disabled={savingDataSync} onClick={saveDataSyncConfig}>
            {savingDataSync ? "Saving..." : "Save Settings"}
          </button>
          <button className="button compact" disabled={testingDataSync} onClick={testDataSyncConnection}>
            {testingDataSync ? "Testing..." : "Test Connection"}
          </button>
          <button className="button button-ghost compact" disabled={runningDataSync} onClick={() => setConfirmSyncOpen(true)}>
            {runningDataSync ? "Syncing..." : "Run Sync Now"}
          </button>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Sync History</p>
        {dataSyncRuns.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 12 }}>
            <p>No sync runs yet. Save configuration and run your first sync.</p>
          </div>
        ) : (
          <div style={{ marginTop: 10, overflowX: "auto" }}>
            <table className="sync-history-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Status</th>
                  <th>Records Synced</th>
                  <th>Error Message</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {dataSyncRuns.map((run) => {
                  const duration = run.finishedAt ? `${Math.max(1, Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000))}s` : "Running";
                  return (
                    <tr key={run.id}>
                      <td>{new Date(run.startedAt).toLocaleString()}</td>
                      <td><StatusBadge label={run.status} tone={run.status === "SUCCESS" ? "ok" : "danger"} /></td>
                      <td>{run.recordsSynced}</td>
                      <td>{run.errorMessage ?? "-"}</td>
                      <td>{duration}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <p className="eyebrow">Storage Routing Policy</p>
        <div className="dashboard-grid-three" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="local-prefix">Local Prefix</label>
            <input id="local-prefix" className="input" value={localPathPrefix} onChange={(e) => setLocalPathPrefix(e.target.value)} placeholder="system" />
          </div>
          <div className="field">
            <label htmlFor="external-prefixes">External Prefixes</label>
            <input id="external-prefixes" className="input" value={externalPathPrefixes} onChange={(e) => setExternalPathPrefixes(e.target.value)} placeholder="submissions, uploads" />
          </div>
          <div className="field">
            <label htmlFor="default-target">Default Target</label>
            <select id="default-target" className="select" value={defaultTarget} onChange={(e) => setDefaultTarget(e.target.value as "LOCAL" | "EXTERNAL")}>
              <option value="LOCAL">LOCAL</option>
              <option value="EXTERNAL">EXTERNAL</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">External Provider Configuration</p>
        <div className="dashboard-grid-three" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="external-provider">Provider</label>
            <select id="external-provider" className="select" value={externalProvider} onChange={(e) => setExternalProvider(e.target.value as StorageConfig["externalProvider"])}>
              {PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="external-endpoint">Endpoint</label>
            <input id="external-endpoint" className="input" value={externalEndpoint} onChange={(e) => setExternalEndpoint(e.target.value)} placeholder="https://s3.amazonaws.com" />
          </div>
          <div className="field">
            <label htmlFor="external-region">Region</label>
            <input id="external-region" className="input" value={externalRegion} onChange={(e) => setExternalRegion(e.target.value)} placeholder="us-east-1" />
          </div>
          <div className="field">
            <label htmlFor="external-bucket">Bucket</label>
            <input id="external-bucket" className="input" value={externalBucket} onChange={(e) => setExternalBucket(e.target.value)} placeholder="publication" />
          </div>
          <div className="field">
            <label htmlFor="force-path-style">Force Path Style</label>
            <select id="force-path-style" className="select" value={externalForcePathStyle ? "true" : "false"} onChange={(e) => setExternalForcePathStyle(e.target.value === "true")}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="access-key">Access Key ID</label>
            <input id="access-key" className="input" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} placeholder={hasSecrets ? "Configured (enter to rotate)" : "AKIA..."} />
          </div>
          <div className="field">
            <label htmlFor="secret-key">Secret Access Key</label>
            <input id="secret-key" className="input" type="password" value={secretAccessKey} onChange={(e) => setSecretAccessKey(e.target.value)} placeholder={hasSecrets ? "Configured (enter to rotate)" : "Secret key"} />
          </div>
        </div>

        <p className="muted" style={{ marginTop: 8 }}>
          Secrets are encrypted at rest. {hasSecrets ? `Last updated: ${secretUpdatedAt ?? "unknown"}.` : "No external secrets saved yet."}
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button className="button button-primary compact" onClick={saveConfig} disabled={saving || testing || !journalSlug || !localPathPrefix.trim()}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
          <button className="button compact" onClick={testConnection} disabled={saving || testing || !journalSlug}>
            {testing ? "Testing..." : "Test Connection"}
          </button>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Routing Simulation</p>
        <div className="field" style={{ marginTop: 10 }}>
          <label htmlFor="simulation-key">File Key</label>
          <input id="simulation-key" className="input" value={simulationKey} onChange={(e) => setSimulationKey(e.target.value)} placeholder={`${journalSlug || "journal-slug"}/submissions/example.pdf`} />
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="button button-ghost compact" onClick={simulateRoute} disabled={simulating || !simulationKey.trim() || !journalSlug}>
            {simulating ? "Simulating..." : "Simulate Route"}
          </button>
        </div>
        {simulation ? (
          <div className="form-section" style={{ marginTop: 10 }}>
            <p><strong>Target:</strong> {simulation.simulation.target}</p>
            <p><strong>Provider:</strong> {simulation.simulation.provider}</p>
            <p><strong>Reason:</strong> {simulation.simulation.reason}</p>
            <p><strong>Endpoint:</strong> {simulation.simulation.endpoint}</p>
            <p><strong>Bucket:</strong> {simulation.simulation.bucket}</p>
          </div>
        ) : null}
      </section>
      <ToastNotification open={!!toast} tone={toast?.tone ?? "info"} message={toast?.message ?? ""} onClose={() => setToast(null)} />
      <ConfirmationModal
        open={confirmSyncOpen}
        title="Run External Database Sync"
        description="This will run sync immediately for the active journal. Continue?"
        confirmLabel="Run Sync"
        busy={runningDataSync}
        onCancel={() => setConfirmSyncOpen(false)}
        onConfirm={() => void runDataSyncNow()}
      />
    </AppShell>
  );
}
