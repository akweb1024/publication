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
      setToast({ tone: "error", message: "Failed to save storage configuration." });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    if (!journalSlug) return;
    if (!externalEndpoint.trim() || !externalRegion.trim() || !externalBucket.trim() || !accessKeyId.trim() || !secretAccessKey.trim()) {
      setError("To test connection, provide endpoint, region, bucket, access key, and secret key.");
      setToast({ tone: "error", message: "Provide all external storage fields before testing." });
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
      setToast({ tone: "error", message: "Connection test failed." });
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
      setToast({ tone: "error", message: "Failed to save sync settings." });
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
      setToast({ tone: "error", message: "Database connection test failed." });
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
        { method: "POST", body: JSON.stringify({ externalDatabaseUrl: externalDbUrl.trim() || undefined }) }
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
      <AppShell title="Loading..." sectionLabel="Storage" breadcrumbItems={[{ label: "Dashboard", href: "/dashboard" }, { label: "Storage", href: "/dashboard/storage" }]} helpTopic="Storage Settings">
        <SkeletonBlock height={42} />
        <SkeletonBlock height={150} />
        <SkeletonBlock height={240} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Storage Settings"
      sectionLabel="Storage & Sync"
      description="Manage routing policy, external object storage credentials, and external database sync operations."
      selectedJournalLabel={selectedJournalTitle}
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Storage & Sync", href: "/dashboard/storage" },
      ]}
      journals={journals}
      selectedJournalSlug={journalSlug}
      onJournalChange={onJournalChange}
      quickActions={[
        { label: "Save Storage", onClick: saveConfig, variant: "primary" },
        { label: "Test Connection", onClick: testConnection, variant: "secondary" },
        { label: "Run Sync", onClick: () => setConfirmSyncOpen(true), variant: "ghost" },
      ]}
      workflowSteps={[
        { label: "Select Journal", state: "complete" },
        { label: "Configure Storage", state: "current" },
        { label: "Configure External DB", state: "upcoming" },
        { label: "Test Connection", state: "upcoming" },
        { label: "Save & Run Sync", state: "upcoming" },
        { label: "Review History", state: "upcoming" },
      ]}
      actions={<StatusBadge label={syncStatusLabel()} tone={syncStatusTone()} />}
      helpTopic="Storage Settings"
    >
      {error ? <ErrorAlert message={error} /> : null}

      {/* Status overview */}
      <div className="shell-stats-grid">
        <div className="shell-stat-card">
          <span className="shell-stat-icon">💾</span>
          <p className="shell-stat-label">Default Target</p>
          <p className="shell-stat-value">{defaultTarget}</p>
        </div>
        <div className="shell-stat-card">
          <span className="shell-stat-icon">☁️</span>
          <p className="shell-stat-label">Provider</p>
          <p className="shell-stat-value">{externalProvider}</p>
        </div>
        <div className="shell-stat-card">
          <span className="shell-stat-icon">🔒</span>
          <p className="shell-stat-label">Secrets</p>
          <p className="shell-stat-value">{hasSecrets ? "Saved" : "Not Set"}</p>
          {hasSecrets ? <p className="shell-stat-hint">Updated: {secretUpdatedAt ?? "unknown"}</p> : null}
        </div>
        <div className="shell-stat-card">
          <span className="shell-stat-icon">🔄</span>
          <p className="shell-stat-label">Sync Status</p>
          <p className="shell-stat-value">{syncStatusLabel()}</p>
          <StatusBadge label={syncStatusLabel()} tone={syncStatusTone()} />
        </div>
        <div className="shell-stat-card">
          <span className="shell-stat-icon">📋</span>
          <p className="shell-stat-label">Sync Runs</p>
          <p className="shell-stat-value">{dataSyncRuns.length}</p>
        </div>
      </div>

      {/* External Database Sync */}
      <div className="shell-form-section">
        <div className="shell-form-section-header">
          <h3>🔄 External Database Sync <ContextualHelp text="External database sync allows you to push journal data to an external PostgreSQL database for integration with other systems. Enable sync, configure the connection URL, test the connection, then run manual or automatic syncs." /></h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <StatusBadge label={syncStatusLabel()} tone={syncStatusTone()} />
            <StatusBadge label={dataSyncValidated ? "Validated" : "Unvalidated"} tone={dataSyncValidated ? "ok" : "warn"} />
            <StatusBadge label={hasExternalDbUrl ? "URL Configured" : "URL Missing"} tone={hasExternalDbUrl ? "info" : "warn"} />
          </div>
        </div>

        <div className="shell-form-grid" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="data-sync-enabled">Sync Enabled</label>
            <select id="data-sync-enabled" className="select" value={dataSyncEnabled ? "true" : "false"} onChange={(e) => setDataSyncEnabled(e.target.value === "true")}>
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="data-sync-auto">Auto Sync <ContextualHelp text="When enabled, sync will run automatically on a schedule. Otherwise, you must run it manually." /></label>
            <select id="data-sync-auto" className="select" value={dataSyncAuto ? "true" : "false"} onChange={(e) => setDataSyncAuto(e.target.value === "true")}>
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </div>
          <div className="field shell-form-grid-full">
            <label htmlFor="external-db-url">External Postgres URL <ContextualHelp text="Full PostgreSQL connection string including database name and optional schema. Format: postgresql://user:password@host:5432/dbname?schema=public. Never share this URL — it contains credentials." /></label>
            <input
              id="external-db-url"
              className="input"
              type="password"
              value={externalDbUrl}
              onChange={(e) => setExternalDbUrl(e.target.value)}
              placeholder="postgresql://user:pass@host:5432/dbname?schema=public"
            />
            <p className="shell-field-hint">Secure format: postgresql://user:password@host:5432/dbname?schema=public</p>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 8 }}>
          Last Tested: {dataSyncLastTestedAt ? new Date(dataSyncLastTestedAt).toLocaleString() : "Never"} | Last Synced: {dataSyncLastSyncAt ? new Date(dataSyncLastSyncAt).toLocaleString() : "Never"}
        </p>
        {dataSyncLastSyncMessage ? <p className="muted">Last Message: {dataSyncLastSyncMessage}</p> : null}

        <div className="shell-form-actions">
          <button className="button button-primary compact" disabled={savingDataSync} onClick={saveDataSyncConfig}>
            {savingDataSync ? "Saving..." : "Save Sync Settings"}
          </button>
          <button className="button compact" disabled={testingDataSync} onClick={testDataSyncConnection}>
            {testingDataSync ? "Testing..." : "Test DB Connection"}
          </button>
          <button className="button button-ghost compact" disabled={runningDataSync} onClick={() => setConfirmSyncOpen(true)}>
            {runningDataSync ? "Syncing..." : "Run Sync Now"}
          </button>
        </div>
      </div>

      {/* Sync History */}
      <div className="shell-form-section">
        <div className="shell-form-section-header">
          <h3>📋 Sync History</h3>
          <span className="muted">{dataSyncRuns.length} runs</span>
        </div>

        {dataSyncRuns.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 12 }}>
            <h3>No sync runs yet</h3>
            <p className="muted">Save your sync configuration and run your first sync to see history here.</p>
          </div>
        ) : (
          <div className="shell-table-wrap" style={{ marginTop: 10 }}>
            <table className="shell-table">
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
      </div>

      {/* Storage Routing Policy */}
      <div className="shell-form-section">
        <div className="shell-form-section-header">
          <h3>🛣️ Storage Routing Policy <ContextualHelp text="The routing policy determines where files are stored. Files matching an external prefix go to the external provider; all others use local storage. The default target sets the fallback when no prefix matches." /></h3>
        </div>
        <div className="shell-form-grid" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="local-prefix">Local Prefix</label>
            <input id="local-prefix" className="input" value={localPathPrefix} onChange={(e) => setLocalPathPrefix(e.target.value)} placeholder="system" />
            <p className="shell-field-hint">Prefix for files stored on the local filesystem.</p>
          </div>
          <div className="field">
            <label htmlFor="external-prefixes">External Prefixes <ContextualHelp text="Comma-separated list of path prefixes that should route to external storage. Files with paths starting with these prefixes will be stored in the configured external provider." /></label>
            <input id="external-prefixes" className="input" value={externalPathPrefixes} onChange={(e) => setExternalPathPrefixes(e.target.value)} placeholder="submissions, uploads, manuscripts" />
            <p className="shell-field-hint">Comma-separated. Files matching these prefixes go to external storage.</p>
          </div>
          <div className="field">
            <label htmlFor="default-target">Default Target</label>
            <select id="default-target" className="select" value={defaultTarget} onChange={(e) => setDefaultTarget(e.target.value as "LOCAL" | "EXTERNAL")}>
              <option value="LOCAL">LOCAL</option>
              <option value="EXTERNAL">EXTERNAL</option>
            </select>
            <p className="shell-field-hint">Fallback storage target when no prefix matches.</p>
          </div>
        </div>
      </div>

      {/* External Provider Configuration */}
      <div className="shell-form-section">
        <div className="shell-form-section-header">
          <h3>☁️ External Provider Configuration <ContextualHelp text="Configure your external object storage provider (MinIO, S3, R2, or GCS). Provide the endpoint URL, region, bucket name, and access credentials. Secrets are encrypted at rest and never stored in plain text." /></h3>
        </div>
        <div className="shell-form-grid" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="external-provider">Provider</label>
            <select id="external-provider" className="select" value={externalProvider} onChange={(e) => setExternalProvider(e.target.value as StorageConfig["externalProvider"])}>
              {PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="external-endpoint">Endpoint <ContextualHelp text="The endpoint URL for your external storage. For S3: https://s3.amazonaws.com. For MinIO: http://localhost:9000. For R2: https://account-id.r2.cloudflarestorage.com." /></label>
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
              <option value="true">Yes (path-style)</option>
              <option value="false">No (virtual-hosted)</option>
            </select>
            <p className="shell-field-hint">Required for MinIO. Usually false for AWS S3.</p>
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

        <p className="shell-field-hint" style={{ marginTop: 8 }}>
          🔒 Secrets are encrypted at rest. {hasSecrets ? `Last updated: ${secretUpdatedAt ?? "unknown"}.` : "No external secrets saved yet."}
        </p>

        <div className="shell-form-actions">
          <button className="button button-primary compact" onClick={saveConfig} disabled={saving || testing || !journalSlug || !localPathPrefix.trim()}>
            {saving ? "Saving..." : "Save Storage Settings"}
          </button>
          <button className="button compact" onClick={testConnection} disabled={saving || testing || !journalSlug}>
            {testing ? "Testing..." : "Test Storage Connection"}
          </button>
        </div>
      </div>

      {/* Routing Simulation */}
      <div className="shell-form-section">
        <div className="shell-form-section-header">
          <h3>🧪 Routing Simulation <ContextualHelp text="Test where a specific file key would be stored based on current routing policy. Enter a file path like 'journal-slug/submissions/example.pdf' to see which storage target it would route to." /></h3>
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="simulation-key">File Key</label>
          <input id="simulation-key" className="input" value={simulationKey} onChange={(e) => setSimulationKey(e.target.value)} placeholder={`${journalSlug || "journal-slug"}/submissions/example.pdf`} />
          <p className="shell-field-hint">Enter a file path to simulate where it would be stored.</p>
        </div>
        <button className="button button-ghost compact" style={{ marginTop: 8 }} onClick={simulateRoute} disabled={simulating || !simulationKey.trim() || !journalSlug}>
          {simulating ? "Simulating..." : "Simulate Route"}
        </button>
        {simulation ? (
          <div className="shell-form-section" style={{ marginTop: 10, borderLeft: "3px solid #0d9488" }}>
            <h3 style={{ fontSize: "0.95rem" }}>Simulation Result</h3>
            <p><strong>Target:</strong> {simulation.simulation.target}</p>
            <p><strong>Provider:</strong> {simulation.simulation.provider}</p>
            <p><strong>Reason:</strong> {simulation.simulation.reason}</p>
            <p><strong>Endpoint:</strong> {simulation.simulation.endpoint}</p>
            <p><strong>Bucket:</strong> {simulation.simulation.bucket}</p>
          </div>
        ) : null}
      </div>

      <ToastNotification open={!!toast} tone={toast?.tone ?? "info"} message={toast?.message ?? ""} onClose={() => setToast(null)} />
      <ConfirmationModal
        open={confirmSyncOpen}
        title="Run External Database Sync"
        description="This will run sync immediately for the active journal. The sync will push journal data to the configured external PostgreSQL database. Continue?"
        confirmLabel="Run Sync"
        busy={runningDataSync}
        onCancel={() => setConfirmSyncOpen(false)}
        onConfirm={() => void runDataSyncNow()}
      />
    </AppShell>
  );
}
