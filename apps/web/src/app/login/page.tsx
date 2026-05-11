"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiJson } from "../../lib/clientApi";
import ErrorAlert from "../../components/ErrorAlert";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaEnrollmentRequired, setMfaEnrollmentRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaUri, setMfaUri] = useState<string | null>(null);
  const isLocalOrDev =
    process.env.NODE_ENV !== "production" ||
    (process.env.NEXT_PUBLIC_API_BASE ?? "").includes("localhost") ||
    (process.env.NEXT_PUBLIC_API_BASE ?? "").includes("127.0.0.1");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await apiJson<any>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      if (result?.mfaRequired) {
        setMfaRequired(true);
        setMfaEnrollmentRequired(!!result.mfaEnrollmentRequired);
        setMfaToken(result.mfaToken);
        if (result.mfaEnrollmentRequired) {
          const enroll = await apiJson<any>("/auth/mfa/enroll-init", {
            method: "POST",
            body: JSON.stringify({ mfaToken: result.mfaToken }),
          });
          setMfaToken(enroll.mfaToken);
          setMfaSecret(enroll.secret);
          setMfaUri(enroll.otpauthUri);
        }
        return;
      }
      router.push("/dashboard");
    } catch (err: any) {
      const raw = err?.message ?? "Login failed";
      if (String(raw).toLowerCase().includes("failed to fetch")) {
        setError("Unable to reach API. Check NEXT_PUBLIC_API_BASE and ensure API server is running.");
      } else {
        setError(raw);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyMfa(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mfaEnrollmentRequired) {
        await apiJson("/auth/mfa/enroll-verify", {
          method: "POST",
          body: JSON.stringify({ mfaToken, code: mfaCode }),
        });
      } else {
        await apiJson("/auth/mfa/verify", {
          method: "POST",
          body: JSON.stringify({ mfaToken, code: mfaCode }),
        });
      }
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message ?? "MFA verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="main-stack">
      <section className="auth-wrap">
        <div className="card">
          <p className="eyebrow">Access</p>
          <h1 style={{ marginTop: 6 }}>Sign in</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Continue to your editorial dashboard.
          </p>
        </div>
        <form className="card auth-card" onSubmit={mfaRequired ? onVerifyMfa : onSubmit}>
          {isLocalOrDev && !mfaRequired ? (
            <div className="note-banner" role="note">
              <strong>Local seed access:</strong> use <code>admin@publisher.local</code> / <code>admin123</code>. MFA setup is required on first login.
            </div>
          ) : null}
          {mfaRequired ? (
            <>
              <p className="eyebrow">{mfaEnrollmentRequired ? "MFA Setup Required" : "MFA Verification"}</p>
              {mfaEnrollmentRequired ? (
                <p className="muted">
                  Add this secret in your authenticator app, then enter the 6-digit code.
                  {mfaSecret ? <><br />Secret: <code>{mfaSecret}</code></> : null}
                  {mfaUri ? <><br />OTP URI: <code>{mfaUri}</code></> : null}
                </p>
              ) : (
                <p className="muted">Enter your 6-digit authenticator code to continue.</p>
              )}
              {mfaUri ? (
                <div style={{ display: "grid", justifyItems: "start", gap: 8 }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(mfaUri)}`}
                    alt="MFA QR code for authenticator setup"
                    width={180}
                    height={180}
                    style={{ borderRadius: 10, border: "1px solid var(--line)", background: "#fff" }}
                  />
                  <small className="muted">Scan this QR code with your authenticator app.</small>
                </div>
              ) : null}
              <div className="field">
                <label htmlFor="mfa-code">Authenticator Code</label>
                <input
                  id="mfa-code"
                  className="input"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  required
                  maxLength={6}
                  inputMode="numeric"
                />
              </div>
            </>
          ) : null}
          {!mfaRequired ? (
            <>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </>
          ) : null}
          <button className="button" disabled={loading} type="submit">
            {loading ? "Processing..." : mfaRequired ? "Verify MFA" : "Sign in"}
          </button>
          {error ? <ErrorAlert message={error} /> : null}
          <p className="muted">
            New here?{" "}
            <a href="/register" style={{ color: "var(--accent)", fontWeight: 700 }}>
              Create account
            </a>
          </p>
        </form>
      </section>
    </main>
  );
}
