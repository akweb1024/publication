"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { apiJson } from "../../lib/clientApi";
import { errorMessage } from "../../lib/errorMessage";
import ErrorAlert from "../../components/ErrorAlert";

type LoginApiResult = {
  mfaRequired?: boolean;
  mfaEnrollmentRequired?: boolean;
  mfaToken?: string;
};

type MfaEnrollInitResponse = {
  mfaToken: string;
  secret: string;
  otpauthUri: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: string | number;
            }
          ) => void;
        };
      };
    };
  }
}

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
  const [googleReady, setGoogleReady] = useState(false);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  const isLocalOrDev =
    process.env.NODE_ENV !== "production" ||
    (process.env.NEXT_PUBLIC_API_BASE ?? "").includes("localhost") ||
    (process.env.NEXT_PUBLIC_API_BASE ?? "").includes("127.0.0.1");

  useEffect(() => {
    if (!googleClientId || mfaRequired) return;
    let cancelled = false;
    const scriptId = "google-identity-services";
    const initialize = () => {
      if (cancelled || !window.google?.accounts?.id) return;
      const target = document.getElementById("google-signin-button");
      if (!target) return;
      target.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          if (!credential) return;
          setLoading(true);
          setError(null);
          try {
            const result = await apiJson<LoginApiResult>("/auth/google", {
              method: "POST",
              body: JSON.stringify({ credential }),
            });
            if (result?.mfaRequired) {
              const token = result.mfaToken;
              if (!token) {
                setError("MFA is required but the server did not return a verification token.");
                return;
              }
              setMfaRequired(true);
              setMfaEnrollmentRequired(!!result.mfaEnrollmentRequired);
              setMfaToken(token);
              if (result.mfaEnrollmentRequired) {
                const enroll = await apiJson<MfaEnrollInitResponse>("/auth/mfa/enroll-init", {
                  method: "POST",
                  body: JSON.stringify({ mfaToken: token }),
                });
                setMfaToken(enroll.mfaToken);
                setMfaSecret(enroll.secret);
                setMfaUri(enroll.otpauthUri);
              }
              return;
            }
            router.push("/dashboard");
          } catch (err: unknown) {
            setError(errorMessage(err) || "Google login failed");
          } finally {
            setLoading(false);
          }
        },
      });
      window.google.accounts.id.renderButton(target, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
        width: 280,
      });
      setGoogleReady(true);
    };

    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      if (window.google) initialize();
      else existing.addEventListener("load", initialize, { once: true });
      return () => {
        cancelled = true;
        existing.removeEventListener("load", initialize);
      };
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initialize;
    document.head.appendChild(script);
    return () => {
      cancelled = true;
      script.onload = null;
    };
  }, [googleClientId, mfaRequired, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await apiJson<LoginApiResult>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      if (result?.mfaRequired) {
        const token = result.mfaToken;
        if (!token) {
          setError("MFA is required but the server did not return a verification token.");
          return;
        }
        setMfaRequired(true);
        setMfaEnrollmentRequired(!!result.mfaEnrollmentRequired);
        setMfaToken(token);
        if (result.mfaEnrollmentRequired) {
          const enroll = await apiJson<MfaEnrollInitResponse>("/auth/mfa/enroll-init", {
            method: "POST",
            body: JSON.stringify({ mfaToken: token }),
          });
          setMfaToken(enroll.mfaToken);
          setMfaSecret(enroll.secret);
          setMfaUri(enroll.otpauthUri);
        }
        return;
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      const raw = errorMessage(err) || "Login failed";
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
    } catch (err: unknown) {
      setError(errorMessage(err) || "MFA verification failed");
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
                  <Image
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
              {googleClientId ? (
                <div style={{ display: "grid", gap: 10, marginBottom: 8 }}>
                  <div id="google-signin-button" />
                  {!googleReady ? <small className="muted">Loading Google sign-in...</small> : null}
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    Or sign in with email and password
                  </div>
                </div>
              ) : null}
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
            <Link href="/register" style={{ color: "var(--accent)", fontWeight: 700 }}>
              Create account
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
