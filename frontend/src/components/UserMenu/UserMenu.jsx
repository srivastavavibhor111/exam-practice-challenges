import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './UserMenu.css';

/* ─── UserMenu ────────────────────────────────────────────────────────────────
   A self-contained dropdown, meant to be dropped into Navbar.jsx in place of
   wherever the user's name / logout button currently render. Renders
   nothing if no one is logged in (Navbar can render this unconditionally
   without its own extra `{user && ...}` check).

   Opens only on click (not hover), closes on: clicking outside, pressing
   Escape, or clicking any item inside it. Both requirements from the
   original request are satisfied by this + how it's wrapped in App.jsx's
   routing: "About My Profile" is a real page, and since /profile is
   wrapped in <ProtectedRoute> (same as every other personal page), a
   logged-out visitor who somehow lands there gets sent to /login
   automatically — no separate logic needed here for that case.

   Log Out is included in this dropdown too, alongside "About My Profile"
   — the standard pattern for a name/avatar-triggered menu. If you'd
   rather keep a separate, always-visible Log Out button next to the name
   instead, just remove the <button className="user-menu__item--danger">
   block below and keep your existing logout button in Navbar as-is.
────────────────────────────────────────────────────────────────────────────── */

export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  async function handleLogout() {
    setIsOpen(false);
    await logout();
    navigate('/');
  }

  if (!user) return null;

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="user-menu__trigger"
        onClick={() => setIsOpen(o => !o)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="navbar__username"> 
          {user.name.length > 10
              ? `${user.name.slice(0, 10)}...`
              : user.name}
        </span>
        <ChevronIcon isOpen={isOpen} />
      </button>

      {isOpen && (
        <div className="user-menu__dropdown" role="menu">
          <Link
            to="/profile"
            className="user-menu__item"
            role="menuitem"
            onClick={() => setIsOpen(false)}
          >
            <ProfileIcon /> About My Profile
          </Link>
          <button
            type="button"
            className="user-menu__item user-menu__item--danger"
            role="menuitem"
            onClick={handleLogout}
          >
            <LogoutIcon /> Log Out
          </button>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ isOpen }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
      style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
    >
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 12c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5.5 12.5H3a1 1 0 01-1-1v-9a1 1 0 011-1h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 9.5L12.5 6.5L9.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 6.5H5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
