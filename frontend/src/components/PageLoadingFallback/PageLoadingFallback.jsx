import './PageLoadingFallback.css';

/* ─── PageLoadingFallback — NEW for M19 ──────────────────────────────────────
   The Suspense fallback shown while a lazy-loaded route's JS chunk is being
   downloaded (App.jsx). Deliberately brief and unobtrusive — on a fast
   connection this flashes for a fraction of a second between navigations;
   on a slow one it gives a clear, immediate signal that something is
   happening rather than a blank white page.
────────────────────────────────────────────────────────────────────────── */

export default function PageLoadingFallback() {
  return (
    <div className="page-loading-fallback" role="status" aria-live="polite">
      <span className="page-loading-fallback__spinner" aria-hidden="true">
        <SpinnerIcon />
      </span>
      <span className="page-loading-fallback__text">Loading…</span>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="10.5" stroke="currentColor" strokeWidth="2.6" strokeOpacity="0.25" />
      <path d="M24.5 14a10.5 10.5 0 00-10.5-10.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
