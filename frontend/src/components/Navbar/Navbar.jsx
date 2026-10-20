import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import './Navbar.css';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import UserMenu from '../UserMenu/UserMenu';

/* ─── Navbar ─────────────────────────────────────────────────────────────────
   Fixed top navigation bar.
   Collapses to hamburger on mobile.
   ThemeToggle is embedded here so it's always accessible.
──────────────────────────────────────────────────────────────────────────── */

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }


  return (
    <header className="navbar">
      <div className="container navbar__inner">

        {/* Logo */}
        <Link to="/" className="navbar__logo" onClick={closeMenu}>
          <span className="navbar__logo-mark">EPC</span>
          <span className="navbar__logo-text">Exam Practice</span>
        </Link>

        {/* Desktop nav links */}
        <nav className="navbar__links" aria-label="Main navigation">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive ? 'navbar__link navbar__link--active' : 'navbar__link'
            }
            end
          >
            Home
          </NavLink>
            {/*Button to create a new test  */}
          <NavLink
            to="/create"
            className={({ isActive }) =>
              isActive ? 'navbar__link navbar__link--active' : 'navbar__link'
            }
          >
            Create Test
          </NavLink>
          {/* Placeholder links — pages added in later milestones */}
          {user && (
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                isActive ? 'navbar__link navbar__link--active' : 'navbar__link'
              }
            >
              Dashboard
            </NavLink>
          )}
          {/* MyTests page linked to navbar */}
          {user && (
            <NavLink
              to="/my-tests"
              className={({ isActive }) =>
                isActive ? 'navbar__link navbar__link--active' : 'navbar__link'
              }
            >
              My Tests
            </NavLink>
          )}
          {/* Progress page linked to navbar */}
          {user && (
            <NavLink
              to="/progress"
              className={({ isActive }) =>
                isActive ? 'navbar__link navbar__link--active' : 'navbar__link'
              }
            >
              Progress
            </NavLink>
          )}
          {/* Shared Tests page */}
          {user && (
            <NavLink
              to="/shared-tests"
              className={({ isActive }) =>
                isActive ? 'navbar__link navbar__link--active' : 'navbar__link'
              }
            >
              Shared Tests
          </NavLink>
          )}
        </nav>
        

        {/* Right side: user info + login/logout M11 navbar update
            (desktop only — hidden on mobile, equivalent controls live in the mobile menu) */}
        {user ? (
          <div className="navbar__desktop-only">
            <div className="navbar__user">
              {/* profile SVG */}
              <span className="navbar__profile-icon" aria-hidden="true">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 20a7 7 0 0 1 14 0H5z" />
                </svg>
              </span>
            </div>
            <UserMenu />
          </div>
        ) : (
          <Link to="/login" className="btn btn--primary btn--sm navbar__desktop-only">
            Log In
          </Link>
        )}


        {/* Right side: theme toggle + hamburger */}
        <div className="navbar__actions">
          <ThemeToggle />

          {/* Hamburger button (mobile only) */}
          <button
            className={`navbar__hamburger ${menuOpen ? 'navbar__hamburger--open' : ''}`}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`navbar__mobile-menu ${menuOpen ? 'navbar__mobile-menu--open' : ''}`}
        aria-hidden={!menuOpen}
      >
        {/* User info + theme toggle — mirrors the desktop-only block above,
            since that block is hidden on mobile via .navbar__desktop-only */}
        {user && (
          <div className="navbar__mobile-user">
            <div className="navbar__user">
              <span className="navbar__profile-icon" aria-hidden="true">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 20a7 7 0 0 1 14 0H5z" />
                </svg>
              </span>
              <UserMenu />
            </div>
            <ThemeToggle />
          </div>
        )}

        {!user && (
          <div className="navbar__mobile-user">
            <span className="navbar__username">Theme</span>
            <ThemeToggle />
          </div>
        )}

        <nav aria-label="Mobile navigation">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive ? 'navbar__mobile-link navbar__mobile-link--active' : 'navbar__mobile-link'
            }
            end
            onClick={closeMenu}
          >
            Home
          </NavLink>
          <NavLink
            to="/create"
            className={({ isActive }) =>
              isActive ? 'navbar__mobile-link navbar__mobile-link--active' : 'navbar__mobile-link'
            }
            onClick={closeMenu}
          >
            Create Test
          </NavLink>
          {/* Placeholder links — pages added in later milestones */}
          {user && (
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                isActive ? 'navbar__mobile-link navbar__mobile-link--active' : 'navbar__mobile-link'
              }
              onClick={closeMenu}
            >
              Dashboard
            </NavLink>
          )}
          {/* Fixed: was pointing to /tests, desktop link is /my-tests */}
          {user && (
            <NavLink
              to="/my-tests"
              className={({ isActive }) =>
                isActive ? 'navbar__mobile-link navbar__mobile-link--active' : 'navbar__mobile-link'
              }
              onClick={closeMenu}
            >
              My Tests
            </NavLink>
          )}
          {/* Progress page linked to navbar */}
          {user && (
            <NavLink
              to="/progress"
              className={({ isActive }) =>
                isActive ? 'navbar__mobile-link navbar__mobile-link--active' : 'navbar__mobile-link'
              }
              onClick={closeMenu}
            >
              Progress
            </NavLink>
          )}
          {user &&(
          <NavLink
            to="/shared-tests"
            className={({ isActive }) =>
              isActive ? 'navbar__mobile-link navbar__mobile-link--active' : 'navbar__mobile-link'
            }
          >
            Shared Tests
          </NavLink>
          )}
        </nav>
        

        {/* Login / Logout — desktop UserMenu equivalent for mobile */}
        <div className="navbar__mobile-auth">
          {user ? (
            <button
              className="btn btn--ghost btn--sm"
              style={{ width: '100%' }}
              onClick={() => {
                closeMenu();
                handleLogout();
              }}
            >
              Log Out
            </button>
          ) : (
            <Link
              to="/login"
              className="btn btn--ghost btn--sm navbar__mobile-login"
              onClick={closeMenu}
            >
              Log In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
