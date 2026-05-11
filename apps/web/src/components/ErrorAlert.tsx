"use client";

import { useMemo, useState } from "react";

type ErrorAlertProps = {
  message: string;
  className?: string;
};

export default function ErrorAlert({ message, className = "alert" }: ErrorAlertProps) {
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => {
    const match = message.match(/\s*\(Reference ID:\s*([^)]+)\)\s*$/i);
    if (!match) return { base: message, requestId: null as string | null };
    const matchIndex = match.index ?? message.length;
    return {
      base: message.slice(0, matchIndex).trim(),
      requestId: (match[1] ?? "").trim() || null,
    };
  }, [message]);

  async function copyRequestId() {
    if (!parsed.requestId) return;
    try {
      await navigator.clipboard.writeText(parsed.requestId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <div className={className} style={{ 
      background: "rgba(254, 226, 226, 0.5)", 
      border: "1px solid rgba(239, 68, 68, 0.2)", 
      padding: "16px", 
      borderRadius: "12px",
      color: "var(--danger)",
      backdropFilter: "blur(4px)"
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>⚠️</span>
        <div style={{ flexGrow: 1 }}>
          <p style={{ fontWeight: 600, color: "inherit", marginBottom: parsed.requestId ? "8px" : 0 }}>{parsed.base}</p>
          {parsed.requestId ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
              <small style={{ color: "rgba(185, 28, 28, 0.7)", fontWeight: 500 }}>
                Reference ID: <code style={{ background: "rgba(185, 28, 28, 0.1)", padding: "2px 6px", borderRadius: "4px" }}>{parsed.requestId}</code>
              </small>
              <button 
                type="button" 
                className="button button-ghost compact" 
                onClick={copyRequestId}
                style={{ fontSize: "0.7rem", padding: "2px 8px" }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
