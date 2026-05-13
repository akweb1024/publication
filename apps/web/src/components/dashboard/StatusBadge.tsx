type StatusTone = "ok" | "warn" | "danger" | "info" | "neutral"
  | "submitted" | "under-review" | "accepted" | "rejected" | "revision" | "published" | "draft"
  | "sync-enabled" | "sync-failed" | "connected" | "not-configured" | "pending-upload";

export default function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return <span className={`status-badge ${tone}`}>{label}</span>;
}
