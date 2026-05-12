"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import ErrorAlert from "../../../components/ErrorAlert";
import { apiJson } from "../../../lib/clientApi";
import { errorMessage } from "../../../lib/errorMessage";

export default function SecuritySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupUri, setSetupUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "setup" | "enable" | "disable">(null);

  const loadStatus = useCallback(async () => {
    const result = await apiJson<{ mfaEnabled: boolean }>("/auth/mfa/status", { method: "GET" });
    setMfaEnabled(result.mfaEnabled);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      setLoading(true);
      setError(null);
      try {
        await apiJson("/auth/session", { method: "GET" });
        if (!mounted) return;
        await loadStatus();
      } catch (err: unknown) {
        if (!mounted) return;
        setError(errorMessage(err) || "Failed to load security settings");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();
    return () => {
      mounted = false;
    };
  }, [loadStatus]);

  async function setupMfa() {
    setBusy("setup");
    setError(null);
    setMessage(null);
    try {
      const setup = await apiJson<{ secret: string; otpauthUri: string }>("/auth/mfa/setup", { method: "POST", body: "{}" });
      setSetupSecret(setup.secret);
      setSetupUri(setup.otpauthUri);
      setMessage("MFA secret generated. Add it to your authenticator app.");
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to start MFA setup");
    } finally {
      setBusy(null);
    }
  }

  async function enableMfa() {
    if (!code.trim()) return;
    setBusy("enable");
    setError(null);
    setMessage(null);
    try {
      await apiJson("/auth/mfa/enable", {
        method: "POST",
        body: JSON.stringify({ code: code.trim() }),
      });
      setCode("");
      setSetupSecret(null);
      setSetupUri(null);
      await loadStatus();
      setMessage("MFA enabled successfully.");
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to enable MFA");
    } finally {
      setBusy(null);
    }
  }

  async function disableMfa() {
    if (!disableCode.trim()) return;
    setBusy("disable");
    setError(null);
    setMessage(null);
    try {
      await apiJson("/auth/mfa/disable", {
        method: "POST",
        body: JSON.stringify({ code: disableCode.trim() }),
      });
      setDisableCode("");
      await loadStatus();
      setMessage("MFA disabled.");
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to disable MFA");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p>Loading security settings...</p>;

  return (
    <main className="main-stack">
      <section className="hero">
        <h1>Security Settings</h1>
        <p>Manage multi-factor authentication for your account.</p>
      </section>

      {message ? <p style={{ color: "var(--accent-2)", fontWeight: 700 }}>{message}</p> : null}
      {error ? <ErrorAlert message={error} /> : null}

      <section className="card">
        <p className="eyebrow">MFA Status</p>
        <p style={{ fontWeight: 700 }}>{mfaEnabled ? "Enabled" : "Not enabled"}</p>
        {!mfaEnabled ? (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <button className="button compact" onClick={setupMfa} disabled={busy !== null} type="button">
              {busy === "setup" ? "Preparing..." : "Start MFA Setup"}
            </button>
            {setupSecret ? (
              <div className="field">
                <label>Authenticator Secret</label>
                <input className="input" value={setupSecret} readOnly />
                {setupUri ? <small className="muted">OTP URI: {setupUri}</small> : null}
              </div>
            ) : null}
            {setupUri ? (
              <div style={{ display: "grid", justifyItems: "start", gap: 8 }}>
                <Image
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(setupUri)}`}
                  alt="MFA QR code for authenticator setup"
                  width={180}
                  height={180}
                  style={{ borderRadius: 10, border: "1px solid var(--line)", background: "#fff" }}
                />
                <small className="muted">Scan this QR code with your authenticator app.</small>
              </div>
            ) : null}
            {setupSecret ? (
              <div className="field">
                <label htmlFor="enable-code">Enter 6-digit code</label>
                <input
                  id="enable-code"
                  className="input"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
                <button className="button compact" onClick={enableMfa} disabled={busy !== null || code.trim().length < 6} type="button">
                  {busy === "enable" ? "Enabling..." : "Enable MFA"}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <div className="field">
              <label htmlFor="disable-code">Enter current 6-digit code to disable MFA</label>
              <input
                id="disable-code"
                className="input"
                inputMode="numeric"
                maxLength={6}
                value={disableCode}
                onChange={(event) => setDisableCode(event.target.value)}
              />
            </div>
            <button className="button button-ghost compact" onClick={disableMfa} disabled={busy !== null || disableCode.trim().length < 6} type="button">
              {busy === "disable" ? "Disabling..." : "Disable MFA"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
