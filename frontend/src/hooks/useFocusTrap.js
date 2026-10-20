import { useEffect, useRef } from 'react';

/**
 * useFocusTrap — NEW for M17
 * ─────────────────────────────────────────────────────────────────────────────
 * REAL GAP THIS CLOSES: every modal in this app (Test.jsx's SubmitModal,
 * Dashboard.jsx's DeleteConfirmModal, and any future one) could be Tab'd
 * straight out of into the page behind it — a keyboard-only or screen-reader
 * user had no way to know they'd left the dialog. This keeps Tab/Shift+Tab
 * cycling within the modal while it's open, moves focus into it the moment
 * it opens, and restores focus to whatever was focused before it opened,
 * once it closes — standard modal accessibility behavior that was simply
 * never built until now.
 *
 * Usage:
 *   const trapRef = useFocusTrap(isOpen, onClose);
 *   return <div ref={trapRef} className="modal-backdrop">...</div>;
 *
 * Pass `null` as onClose if the modal already has its own Escape-key
 * handling, to avoid firing the close logic twice.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useFocusTrap(isActive, onClose) {
  const containerRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    previouslyFocused.current = document.activeElement;

    const container = containerRef.current;
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    function getFocusable() {
      if (!container) return [];
      return Array.from(container.querySelectorAll(focusableSelector)).filter(el => !el.disabled);
    }

    const focusable = getFocusable();
    if (focusable.length > 0) focusable[0].focus();

    function handleKeyDown(e) {
      if (e.key === 'Escape' && onClose) {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = getFocusable();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [isActive, onClose]);

  return containerRef;
}
