import { Link } from 'react-router-dom';
import './Footer.css';

/* ─── Footer ──────────────────────────────────────────────────────────────────
   Expanded in M2 to show brand identity on the landing page.
   Appears on every page (rendered in App.jsx), so it stays minimal enough
   not to feel out of place on future authenticated pages either.
────────────────────────────────────────────────────────────────────────────── */

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer__inner">

        {/* Brand: logo mark + name + tagline */}
        <div className="footer__brand">
          <Link to="/" className="footer__logo">
            <span className="footer__logo-mark" aria-hidden="true">EPC</span>
            <span className="footer__logo-name">Exam Practice Challenges</span>
          </Link>
          <p className="footer__tagline">
            Your study material, turned into a real practice test.
          </p>
        </div>

        {/* Copyright */}
        <p className="footer__copy">
          © {year} Exam Practice Challenges
        </p>

      </div>
    </footer>
  );
}
