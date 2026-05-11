"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:4000/api/v1";

type HealthState = "checking" | "healthy" | "degraded" | "offline";

export default function ApiHealthBadge() {
  const [state, setState] = useState<HealthState>("checking");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const started = performance.now();
      try {
        const res = await fetch(`${API_BASE}/health/ready`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { ok?: boolean; status?: "ok" | "degraded" };
        if (cancelled) return;
        const nextLatency = Math.round(performance.now() - started);
        setLatencyMs(nextLatency);
        if (!data?.ok || data.status === "degraded") {
          setState("degraded");
          return;
        }
        setState(nextLatency > 1200 ? "degraded" : "healthy");
      } catch {
        if (cancelled) return;
        setState("offline");
        setLatencyMs(null);
      }
    };

    check();
    const timer = window.setInterval(check, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const meta = useMemo(() => {
    if (state === "healthy") return { label: "API healthy", color: "var(--accent-2)" };
    if (state === "degraded") return { label: "API degraded", color: "#b45309" };
    if (state === "offline") return { label: "API offline", color: "var(--danger)" };
    return { label: "Checking API", color: "var(--ink-600)" };
  }, [state]);

  return (
    <span className="health-badge" title={latencyMs ? `${latencyMs}ms` : meta.label} style={{ background: "rgba(255, 255, 255, 0.4)", border: "1px solid var(--line)" }}>
      <span className="health-dot" style={{ 
        background: meta.color,
        boxShadow: `0 0 8px ${meta.color}`,
        animation: state === "healthy" ? "pulse 2s infinite" : "none"
      }} />
      <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{meta.label}</span>
      {latencyMs !== null ? <small style={{ marginLeft: "4px", opacity: 0.6 }}>({latencyMs}ms)</small> : null}
      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </span>
  );
}
