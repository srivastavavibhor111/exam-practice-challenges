import { useEffect, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
// The dialog reuses the existing .tmodal-* card styles, and adds its own small
// section (.tmodal-actions--exit, .tmodal-btn--danger) at the end of Test.css.
// Both pages that render this dialog already import Test.css; importing it here
// too (Vite de-duplicates) keeps the dependency explicit.
import '../../pages/Test/Test.css';

/* ─── ExitTestDialog — NEW ──────────────────────────────────────────────────
   The ONE "Leave this test?" dialog, shared by:
     • the browser/Android Back button and mobile back gestures
     • the Exit button in TestHeader
   on BOTH Test.jsx and SharedTestTaking.jsx.

   Safe by default: initial focus lands on "Continue Test", and Escape or a
   click on the backdrop also means "Continue Test" — only an explicit click
   on "Exit Test" leaves.

   `onContinue` MUST be a stable (useCallback) function — useFocusTrap re-runs
   its effect when the callback identity changes, which would steal focus.
────────────────────────────────────────────────────────────────────────────── */

export default function ExitTestDialog({ onContinue, onExit }) {
  const trapRef = useFocusTrap(true, onContinue); // Tab-cycling + Escape
  const continueRef = useRef(null);

  // Declared AFTER useFocusTrap so it runs after the trap's "focus first
  // button" step and wins: the safe action gets the initial focus.
  useEffect(() => {
    continueRef.current?.focus();
  }, []);

  // Lock page scroll behind the dialog (same approach as SubmitModal).
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      ref={trapRef}
      className="tmodal-backdrop"
      onClick={e => e.target === e.currentTarget && onContinue()}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="exit-test-title"
      aria-describedby="exit-test-desc"
    >
      <div className="tmodal-card tmodal-card--exit">
        <h2 className="tmodal-title" id="exit-test-title">Leave this test?</h2>
        <p className="tmodal-subtitle" id="exit-test-desc">
          Are you sure you want to leave this test? Your progress may be lost
          if your answers haven&rsquo;t been saved.
        </p>

        <div className="tmodal-actions tmodal-actions--exit">
          <button
            ref={continueRef}
            type="button"
            className="btn btn--primary"
            onClick={onContinue}
          >
            Continue Test
          </button>
          <button
            type="button"
            className="btn tmodal-btn--danger"
            onClick={onExit}
          >
            Exit Test
          </button>
        </div>
      </div>
    </div>
  );
}
