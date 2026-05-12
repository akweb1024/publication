"use client";

export default function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="confirm-modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="confirm-modal card">
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="confirm-modal-actions">
          <button type="button" className="button button-ghost compact" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className="button button-danger compact" onClick={onConfirm} disabled={busy}>
            {busy ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
