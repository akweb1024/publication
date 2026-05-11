"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../../lib/clientApi";
import ErrorAlert from "../../../components/ErrorAlert";

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

const PROVIDERS: StorageConfig["externalProvider"][] = ["MINIO", "S3", "R2", "GCS"];

export default function StorageSettingsPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [journalSlug, setJournalSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  const externalPrefixes = useMemo(
    () => externalPathPrefixes.split(",").map((s) => s.trim()).filter(Boolean),
    [externalPathPrefixes]
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
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load storage settings");
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
    setMessage(null);
    setError(null);
    try {
      await loadJournalConfig(nextSlug);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load journal storage config");
    }
  }

  async function saveConfig() {
    if (!journalSlug) return;
    setSaving(true);
    setError(null);
    setMessage(null);
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
      setMessage("Storage configuration saved.");
      await loadJournalConfig(journalSlug);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save storage configuration");
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
    setMessage(null);
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
      setMessage("External storage connection test succeeded.");
    } catch (err: any) {
      setError(err?.message ?? "External storage connection test failed");
    } finally {
      setTesting(false);
    }
  }

  async function simulateRoute() {
    if (!journalSlug || !simulationKey.trim()) return;
    setSimulating(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiJson<SimulationResult>(`/journals/${encodeURIComponent(journalSlug)}/storage-config/simulate`, {
        method: "POST",
        body: JSON.stringify({ key: simulationKey.trim() }),
      });
      setSimulation(result);
      setMessage("Routing simulation completed.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to simulate storage routing");
    } finally {
      setSimulating(false);
    }
  }

  if (loading) return <p>Loading storage settings...</p>;

  return (
    <main className="main-stack">
      <section className="hero">
        <h1>Storage Settings</h1>
        <p>Configure hybrid storage policy and external provider for journal files.</p>
        <div className="meta-row">
          <a href="/dashboard/journals" className="button button-ghost compact">Back to Journal Settings</a>
        </div>
      </section>

      {message ? <p style={{ color: "var(--accent-2)", fontWeight: 700 }}>{message}</p> : null}
      {error ? <ErrorAlert message={error} /> : null}

      <section className="card">
        <p className="eyebrow">Target Journal</p>
        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="journal-storage-slug">Journal</label>
          <select id="journal-storage-slug" value={journalSlug} onChange={(e) => onJournalChange(e.target.value)}>
            {journals.map((journal) => (
              <option key={journal.id} value={journal.slug}>{journal.title} ({journal.slug})</option>
            ))}
          </select>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Policy Routing</p>
        <div className="grid" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="local-prefix">Local Prefix</label>
            <input id="local-prefix" value={localPathPrefix} onChange={(e) => setLocalPathPrefix(e.target.value)} placeholder="system" />
          </div>
          <div className="field">
            <label htmlFor="external-prefixes">External Prefixes (comma-separated)</label>
            <input id="external-prefixes" value={externalPathPrefixes} onChange={(e) => setExternalPathPrefixes(e.target.value)} placeholder="submissions, uploads" />
          </div>
          <div className="field">
            <label htmlFor="default-target">Default Target</label>
            <select id="default-target" value={defaultTarget} onChange={(e) => setDefaultTarget(e.target.value as "LOCAL" | "EXTERNAL")}>
              <option value="LOCAL">LOCAL</option>
              <option value="EXTERNAL">EXTERNAL</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">External Provider</p>
        <div className="grid" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="external-provider">Provider</label>
            <select id="external-provider" value={externalProvider} onChange={(e) => setExternalProvider(e.target.value as StorageConfig["externalProvider"])}>
              {PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="external-endpoint">Endpoint</label>
            <input id="external-endpoint" value={externalEndpoint} onChange={(e) => setExternalEndpoint(e.target.value)} placeholder="https://s3.amazonaws.com" />
          </div>
          <div className="field">
            <label htmlFor="external-region">Region</label>
            <input id="external-region" value={externalRegion} onChange={(e) => setExternalRegion(e.target.value)} placeholder="us-east-1" />
          </div>
          <div className="field">
            <label htmlFor="external-bucket">Bucket</label>
            <input id="external-bucket" value={externalBucket} onChange={(e) => setExternalBucket(e.target.value)} placeholder="publication" />
          </div>
          <div className="field">
            <label htmlFor="force-path-style">Force Path Style</label>
            <select id="force-path-style" value={externalForcePathStyle ? "true" : "false"} onChange={(e) => setExternalForcePathStyle(e.target.value === "true")}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="access-key">Access Key ID</label>
            <input id="access-key" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} placeholder={hasSecrets ? "Already configured (enter to rotate)" : "AKIA..."} />
          </div>
          <div className="field">
            <label htmlFor="secret-key">Secret Access Key</label>
            <input id="secret-key" type="password" value={secretAccessKey} onChange={(e) => setSecretAccessKey(e.target.value)} placeholder={hasSecrets ? "Already configured (enter to rotate)" : "Secret key"} />
          </div>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          Secrets are encrypted at rest and are never returned by this API. {hasSecrets ? `Last updated: ${secretUpdatedAt ?? "unknown"}.` : "No external secrets saved yet."}
        </p>
        <div className="meta-row" style={{ marginTop: 12 }}>
          <button className="button" onClick={saveConfig} disabled={saving || testing || !journalSlug || !localPathPrefix.trim()}> 
            {saving ? "Saving..." : "Save Storage Config"}
          </button>
          <button className="button button-ghost" onClick={testConnection} disabled={saving || testing || !journalSlug}>
            {testing ? "Testing..." : "Test External Connection"}
          </button>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Provider Simulation (Dry Run)</p>
        <div className="field" style={{ marginTop: 10 }}>
          <label htmlFor="simulation-key">File Key</label>
          <input
            id="simulation-key"
            value={simulationKey}
            onChange={(e) => setSimulationKey(e.target.value)}
            placeholder={`${journalSlug || "journal-slug"}/submissions/example.pdf`}
          />
        </div>
        <div className="meta-row" style={{ marginTop: 12 }}>
          <button className="button button-ghost" onClick={simulateRoute} disabled={simulating || !simulationKey.trim() || !journalSlug}>
            {simulating ? "Simulating..." : "Simulate Route"}
          </button>
        </div>
        {simulation ? (
          <pre style={{ marginTop: 12, overflowX: "auto", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(simulation, null, 2)}
          </pre>
        ) : null}
      </section>
    </main>
  );
}
