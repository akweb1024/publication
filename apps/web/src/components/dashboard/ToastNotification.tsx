"use client";

import { useEffect } from "react";

type ToastTone = "success" | "error" | "info";

export default function ToastNotification({
  open,
  tone,
  message,
  onClose,
  durationMs = 2800,
}: {
  open: boolean;
  tone: ToastTone;
  message: string;
  onClose: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, durationMs);
    return () => clearTimeout(timer);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  return (
    <div className={`toast-notification ${tone}`} role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" className="button button-ghost compact" onClick={onClose} aria-label="Dismiss notification">
        Close
      </button>
    </div>
  );
}
