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
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
