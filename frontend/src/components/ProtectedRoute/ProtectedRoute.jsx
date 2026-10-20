import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * ProtectedRoute
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps any route that requires a logged-in user: /create, /review,
 * /test/preview, /result. While the initial auth check (GET /api/auth/me)
 * is still in flight, this shows a brief loading state rather than
 * redirecting prematurely — otherwise a logged-in user refreshing the page
 * would see a flash of the login screen before their session is confirmed.
 *
 * The attempted path is passed along in navigation state, so Login.jsx can
 * send the user back to wherever they were actually headed after they sign in.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export default function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
