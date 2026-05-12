"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { apiJson } from "../../lib/clientApi";
import { errorMessage } from "../../lib/errorMessage";
import ErrorAlert from "../../components/ErrorAlert";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiJson("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(errorMessage(err) || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="main-stack">
      <section className="auth-wrap">
        <div className="card">
          <p className="eyebrow">Onboarding</p>
          <h1 style={{ marginTop: 6 }}>Create your account</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Join your publication house workspace.
          </p>
        </div>
        <form className="card auth-card" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
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
            <label htmlFor="password">Password (min 8 chars)</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <button className="button" disabled={loading} type="submit">
            {loading ? "Creating..." : "Create account"}
          </button>
          {error ? <ErrorAlert message={error} /> : null}
          <p className="muted">
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--accent)", fontWeight: 700 }}>
              Back to login
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
