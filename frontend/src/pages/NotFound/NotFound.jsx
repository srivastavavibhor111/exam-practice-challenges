import { Link } from 'react-router-dom';
import './NotFound.css';

export default function NotFound() {
  return (
    <main className="page-wrapper">
      <div className="not-found container">
        <span className="not-found__code">404</span>
        <h1 className="not-found__title">Page not found</h1>
        <p className="not-found__desc">
          This page doesn't exist. Head back to the home page.
        </p>
        <Link to="/" className="btn btn--primary not-found__btn">
          <ArrowLeftIcon />
          Back to home
        </Link>
      </div>
    </main>
  );
}

/* ─── SVG Icons ───────────────────────────────────────────────────────────────*/

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}