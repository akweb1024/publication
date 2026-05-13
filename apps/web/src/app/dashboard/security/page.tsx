"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import ErrorAlert from "../../../components/ErrorAlert";
import AppShell from "../../../components/dashboard/AppShell";
import StatusBadge from "../../../components/dashboard/StatusBadge";
import ToastNotification from "../../../components/dashboard/ToastNotification";
import SkeletonBlock from "../../../components/dashboard/SkeletonBlock";
import { apiJson } from "../../../lib/clientApi";
import { errorMessage } from "../../../lib/errorMessage";
import ContextualHelp from "../../../components/dashboard/ContextualHelp";

export default function SecuritySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupUri, setSetupUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
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
    setToast(null);
    try {
      const setup = await apiJson<{ secret: string; otpauthUri: string }>("/auth/mfa/setup", { method: "POST", body: "{}" });
      setSetupSecret(setup.secret);
      setSetupUri(setup.otpauthUri);
      setToast({ tone: "success", message: "MFA secret generated. Add it to your authenticator app." });
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to start MFA setup");
      setToast({ tone: "error", message: "Failed to start MFA setup." });
    } finally {
      setBusy(null);
    }
  }

  async function enableMfa() {
    if (!code.trim()) {
      setError("Enter the 6-digit code from your authenticator app.");
      setToast({ tone: "error", message: "Enter the 6-digit code." });
      return;
    }
    setBusy("enable");
    setError(null);
    setToast(null);
    try {
      await apiJson("/auth/mfa/enable", {
        method: "POST",
        body: JSON.stringify({ code: code.trim() }),
      });
      setCode("");
      setSetupSecret(null);
      setSetupUri(null);
      await loadStatus();
      setToast({ tone: "success", message: "MFA enabled successfully." });
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to enable MFA. Check the 6-digit code and try again.");
      setToast({ tone: "error", message: "Failed to enable MFA." });
    } finally {
      setBusy(null);
    }
  }

  async function disableMfa() {
    if (!disableCode.trim()) {
      setError("Enter your current 6-digit MFA code to disable.");
      setToast({ tone: "error", message: "Enter your current MFA code." });
      return;
    }
    setBusy("disable");
    setError(null);
    setToast(null);
    try {
      await apiJson("/auth/mfa/disable", {
        method: "POST",
        body: JSON.stringify({ code: disableCode.trim() }),
      });
      setDisableCode("");
      await loadStatus();
      setToast({ tone: "success", message: "MFA disabled." });
    } catch (err: unknown) {
      setError(errorMessage(err) || "Failed to disable MFA. Check the code and try again.");
      setToast({ tone: "error", message: "Failed to disable MFA." });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Loading..."
        sectionLabel="Security"
        breadcrumbItems={[{ label: "Dashboard", href: "/dashboard" }, { label: "Security", href: "/dashboard/security" }]}
        helpTopic="Security Settings"
      >
        <SkeletonBlock height={44} />
        <SkeletonBlock height={120} />
        <SkeletonBlock height={180} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Security Settings"
      sectionLabel="Admin"
      description="Manage multi-factor authentication (MFA) for your account and review security status."
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Admin", href: "/dashboard/security" },
        { label: "Security", href: "/dashboard/security" },
      ]}
      quickActions={[
        { label: "Journal Settings", href: "/dashboard/journals", variant: "ghost" },
        { label: "Audit Logs", href: "/dashboard/audit", variant: "ghost" },
      ]}
      actions={<StatusBadge label={mfaEnabled ? "MFA Enabled" : "MFA Not Enabled"} tone={mfaEnabled ? "ok" : "warn"} />}
      helpTopic="Security Settings"
    >
      {error ? <ErrorAlert message={error} /> : null}

      {/* Status overview */}
      <div className="shell-stats-grid">
        <div className="shell-stat-card">
          <span className="shell-stat-icon">🔒</span>
          <p className="shell-stat-label">MFA Status</p>
          <p className="shell-stat-value">{mfaEnabled ? "Enabled" : "Not Enabled"}</p>
          <StatusBadge label={mfaEnabled ? "Protected" : "Vulnerable"} tone={mfaEnabled ? "ok" : "danger"} />
          {!mfaEnabled ? <p className="shell-stat-hint" style={{ color: "var(--danger)" }}>Enable MFA for better security</p> : null}
        </div>
      </div>

      {/* MFA Configuration */}
      <div className="shell-form-section">
        <div className="shell-form-section-header">
          <h3>🔐 Multi-Factor Authentication <ContextualHelp text="MFA (Multi-Factor Authentication) adds a second layer of security to your account. After entering your password, you'll also need to enter a 6-digit code from your authenticator app (like Google Authenticator, Authy, or 1Password). This prevents unauthorized access even if your password is compromised." /></h3>
          <StatusBadge label={mfaEnabled ? "MFA Enabled" : "MFA Not Enabled"} tone={mfaEnabled ? "ok" : "warn"} />
        </div>

        {!mfaEnabled ? (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <p className="muted">
              MFA is not enabled for your account. We strongly recommend enabling it to protect against unauthorized access, especially for admin and editorial roles.
            </p>

            <button className="button compact button-primary" onClick={setupMfa} disabled={busy !== null} type="button">
              {busy === "setup" ? "Preparing..." : "Start MFA Setup"}
            </button>

            {setupSecret ? (
              <div className="shell-form-section" style={{ borderLeft: "3px solid var(--accent)" }}>
                <h3 style={{ fontSize: "0.95rem" }}>Step 1: Add to Authenticator App <ContextualHelp text="Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.) or manually enter the secret key. This will generate 6-digit codes you'll need when logging in." /></h3>
                <div className="field" style={{ marginTop: 8 }}>
                  <label>Authenticator Secret Key</label>
                  <input className="input" value={setupSecret} readOnly />
                  <p className="shell-field-hint">Copy this secret key if you can't scan the QR code. Enter it manually in your authenticator app.</p>
                </div>
                {setupUri ? (
                  <div style={{ display: "grid", justifyItems: "start", gap: 8, marginTop: 8 }}>
                    <Image
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(setupUri)}`}
                      alt="MFA QR code for authenticator setup"
                      width={180}
                      height={180}
                      unoptimized
                      style={{ borderRadius: 10, border: "1px solid var(--line)", background: "#fff" }}
                    />
                    <p className="shell-field-hint">Scan this QR code with your authenticator app.</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {setupSecret ? (
              <div className="shell-form-section" style={{ borderLeft: "3px solid #0d9488" }}>
                <h3 style={{ fontSize: "0.95rem" }}>Step 2: Verify with 6-digit Code <ContextualHelp text="Enter the 6-digit code currently shown in your authenticator app. This verifies that you've correctly added the account and enables MFA protection." /></h3>
                <div className="field" style={{ marginTop: 8 }}>
                  <label htmlFor="enable-code">Enter 6-digit code <span className="shell-field-required">*</span></label>
                  <input
                    id="enable-code"
                    className="input"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="000000"
                  />
                  <p className="shell-field-hint">Enter the current code from your authenticator app (6 digits).</p>
                </div>
                <button className="button button-primary compact" onClick={enableMfa} disabled={busy !== null || code.trim().length < 6} type="button">
                  {busy === "enable" ? "Enabling..." : "Enable MFA"}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <p style={{ color: "#166534", fontWeight: 600 }}>
              ✅ MFA is enabled for your account. Your account is protected with two-factor authentication.
            </p>
            <div className="shell-form-section" style={{ borderLeft: "3px solid var(--danger)" }}>
              <h3 style={{ fontSize: "0.95rem" }}>Disable MFA <ContextualHelp text="Disabling MFA removes the second layer of security from your account. You will only need your password to log in. We recommend keeping MFA enabled for all staff accounts." /></h3>
              <div className="field" style={{ marginTop: 8 }}>
                <label htmlFor="disable-code">Enter current 6-digit code to disable MFA <span className="shell-field-required">*</span></label>
                <input
                  id="disable-code"
                  className="input"
                  inputMode="numeric"
                  maxLength={6}
                  value={disableCode}
                  onChange={(event) => setDisableCode(event.target.value)}
                  placeholder="000000"
                />
                <p className="shell-field-hint">Enter the current code from your authenticator app to confirm disabling MFA.</p>
              </div>
              <button className="button button-danger compact" onClick={disableMfa} disabled={busy !== null || disableCode.trim().length < 6} type="button">
                {busy === "disable" ? "Disabling..." : "Disable MFA"}
              </button>
            </div>
          </div>
        )}
      </div>

      <ToastNotification open={!!toast} tone={toast?.tone ?? "info"} message={toast?.message ?? ""} onClose={() => setToast(null)} />
    </AppShell>
  );
}
