import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  danger = false, busy = false,
  onConfirm, onCancel,
}) {
  const cancelRef = useRef(null);
  const cancelFn = useRef(onCancel);
  cancelFn.current = onCancel;

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && !busy) cancelFn.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy]);

  if (!open) return null;

  /* portal to <body>: the page wrappers are fading layers, which would
     otherwise keep the popup underneath the logo, links and dial */
  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title" className="dialog-title">{title}</h2>
        <p className="dialog-text">{message}</p>
        <div className="dialog-actions">
          <button ref={cancelRef} className="upload-btn ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button className={`upload-btn ${danger ? 'danger' : 'solid'}`} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}