import { useEffect } from 'react';

/* ─── FolderNotice — NEW ──────────────────────────────────────────────────────
   The feedback banner for folder actions ("Folder created", "2 tests could not
   be added…", errors). Not colour-only: every notice has an icon AND a hidden
   (screen-reader) prefix word, and errors use role="alert" so they are
   announced immediately.

   Success notices dismiss themselves after a few seconds. Warnings and errors
   stay until the user closes them — they contain information that should not
   vanish before it is read.

   `notice` is { type: 'success' | 'warning' | 'error', text }.
   `onDismiss` must be a stable function (MyTests wraps it in useCallback).
────────────────────────────────────────────────────────────────────────────── */

const SUCCESS_AUTO_DISMISS_MS = 6000;

const LABELS = { success: 'Success', warning: 'Warning', error: 'Error' };

export default function FolderNotice({ notice, onDismiss }) {
  useEffect(() => {
    if (!notice || notice.type !== 'success') return undefined;
    const timer = setTimeout(onDismiss, SUCCESS_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) return null;

  return (
    <div
      className={`mtf-notice mtf-notice--${notice.type}`}
      role={notice.type === 'error' ? 'alert' : 'status'}
    >
      <span className="mtf-notice__icon" aria-hidden="true">
        {notice.type === 'success' ? <CheckIcon /> : <AlertIcon />}
      </span>
      <p className="mtf-notice__text">
        <span className="mtf-sr-only">{LABELS[notice.type]}: </span>
        {notice.text}
      </p>
      <button type="button" className="mtf-notice__close" onClick={onDismiss} aria-label="Dismiss message">
        <CloseIcon />
      </button>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 8.2l2 2 4-4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.8v4M8 11v.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
