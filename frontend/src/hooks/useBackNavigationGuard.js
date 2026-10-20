import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * useBackNavigationGuard — NEW
 * ─────────────────────────────────────────────────────────────────────────────
 * Stops an accidental Back press / Android Back / mobile back-gesture from
 * silently abandoning an ACTIVE test, and gives the page one shared
 * "Leave this test?" dialog for both Back presses and the Exit button.
 *
 * WHY THE HISTORY API AND NOT useBlocker:
 *   App.jsx uses <BrowserRouter>. React Router's useBlocker only works under
 *   a *data router* (createBrowserRouter + <RouterProvider>), so it would
 *   throw here. Migrating the router is far outside this feature's scope, so
 *   the guard uses the browser History API directly.
 *
 * HOW IT WORKS (the "sentinel entry" technique):
 *
 *   Before:   [ ...previous page ] [ /test/abc ]  ← user is here
 *   Guarded:  [ ...previous page ] [ /test/abc ] [ /test/abc + marker ]  ← here
 *
 *   1. When the guard turns on we push ONE extra history entry with the same
 *      URL, tagged with a marker in history.state. The user is now sitting on
 *      this "sentinel".
 *   2. Pressing Back pops the sentinel, so the browser lands on the real
 *      /test/abc entry. Same URL → React Router renders the same page; the
 *      test is not unmounted and nothing is lost. A `popstate` event fires.
 *   3. Our popstate handler immediately pushes the sentinel back (so the NEXT
 *      Back press is also caught) and opens the dialog.
 *
 *   pushState() itself never fires popstate — only real navigation (Back /
 *   Forward / history.go) does — so re-pushing inside the handler cannot loop.
 *
 * IDEMPOTENCE (React Strict Mode, re-renders, enabled toggling):
 *   Setup only pushes when the CURRENT entry doesn't already carry the marker,
 *   so a double-run of the effect never creates two sentinels.
 *
 * LEAVING:
 *   • confirmExit()   — drops the sentinel with history.back() and then
 *                       navigate(exitTo, { replace: true }), so the history
 *                       ends up as [previous page][exitTo] with no leftover
 *                       /test/abc entries to Back-button into.
 *   • navigateAway()  — use for the post-submit redirect. If the sentinel is
 *                       on top it REPLACES it, which leaves history in the
 *                       same shape it had before this feature existed.
 *
 * NOT stored in history.state: only a boolean marker (plus whatever React
 * Router already keeps there). No answers, no test data.
 *
 * LIMITS (a website cannot do better than this):
 *   • Chrome's "history manipulation intervention" may skip entries that were
 *     pushed without a user gesture. The sentinel is pushed right after the
 *     user taps "Start Test", which is a gesture, so this normally holds.
 *   • Long-press-Back "jump to an older entry", closing the tab, swiping the
 *     browser away, an OS-level app switch/kill, and page refresh are not
 *     interceptable as a normal Back press. A tab refresh also restarts the
 *     page, exactly as it always did.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @param {object}  opts
 * @param {boolean} opts.enabled  true ONLY while the test is actively being attempted
 * @param {string}  opts.exitTo   route to go to when the user confirms leaving
 */

const GUARD_KEY = '__epcTestGuard';
const EXIT_FALLBACK_MS = 300;

function sentinelIsCurrent() {
  return window.history.state?.[GUARD_KEY] === true;
}

function pushSentinel() {
  // Spread the existing state so React Router's own bookkeeping
  // (key / idx / usr) is carried along untouched.
  window.history.pushState({ ...window.history.state, [GUARD_KEY]: true }, '');
}

function currentUrl() {
  return window.location.pathname + window.location.search;
}

export function useBackNavigationGuard({ enabled, exitTo }) {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const exitingRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setDialogOpen(false);
      return undefined;
    }

    exitingRef.current = false;
    const guardedUrl = currentUrl();

    if (!sentinelIsCurrent()) pushSentinel();

    function onPopState() {
      // A confirmed exit is walking the history itself — stay out of its way.
      if (exitingRef.current) return;
      // Back/Forward moved us to a different page (e.g. a multi-step jump):
      // that is not ours to intercept, and we must NOT push entries there.
      if (currentUrl() !== guardedUrl) return;
      // We landed on the sentinel (e.g. via Forward): nothing was left behind.
      if (sentinelIsCurrent()) return;

      // We landed on the real test entry, i.e. the user pressed Back.
      // Put the sentinel back so the next Back press is caught too…
      pushSentinel();
      // …and ask. Setting `true` when already `true` is a no-op, which is
      // exactly what keeps repeated Back presses to ONE visible dialog.
      setDialogOpen(true);
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [enabled]);

  // Exit button → same dialog as a Back press.
  const requestExit = useCallback(() => {
    if (!exitingRef.current) setDialogOpen(true);
  }, []);

  // "Continue Test": just close. The sentinel is already back in place (it
  // was re-pushed when the dialog opened), so the next Back is caught again.
  const continueTest = useCallback(() => {
    setDialogOpen(false);
  }, []);

  // "Exit Test": runs the app's exit navigation exactly once.
  const confirmExit = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setDialogOpen(false);

    const leave = () => navigate(exitTo, { replace: true });

    if (!sentinelIsCurrent()) {
      leave();
      return;
    }

    // Step off the sentinel first, then replace the real test entry.
    let finished = false;
    let fallbackTimer;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener('popstate', finish);
      clearTimeout(fallbackTimer);
      leave();
    };
    window.addEventListener('popstate', finish);
    fallbackTimer = setTimeout(finish, EXIT_FALLBACK_MS); // belt and braces
    window.history.back();
  }, [navigate, exitTo]);

  // For the post-submit redirect — see header comment.
  const navigateAway = useCallback((to, options) => {
    navigate(to, {
      ...options,
      replace: sentinelIsCurrent() ? true : options?.replace,
    });
  }, [navigate]);

  return {
    // Derived, so a dialog can never outlive the active phase
    // (e.g. the timer expiring while the dialog is open).
    isDialogOpen: dialogOpen && enabled,
    requestExit,
    continueTest,
    confirmExit,
    navigateAway,
  };
}
