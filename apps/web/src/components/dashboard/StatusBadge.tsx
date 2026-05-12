type StatusTone = "ok" | "warn" | "danger" | "info" | "neutral";

export default function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return <span className={`status-badge ${tone}`}>{label}</span>;
}
