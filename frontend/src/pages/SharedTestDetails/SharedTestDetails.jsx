import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as sharedTestService from '../../services/sharedTestService';
import '../SharedTests/SharedTests.css';
import './SharedTestDetails.css';

/* ─── SharedTestDetails — "/shared-tests/details/:sharedTestId" ───────────────
   The landing page for a Shared Test the user already belongs to — most
   importantly an EXPIRED one. Shows the test's facts, an unmistakable
   expired notice, the user's own attempt history, and a Reattempt button.

   Who decides access? The BACKEND. This page only asks
   GET /shared-tests/:testId/details; if the test is expired and the user
   never took part, the server answers 410 and we show its message. Nothing
   here (a flag, a hidden button) is a security control — it's presentation.

   Reattempt simply navigates to the existing taking flow, which starts a
   fresh attempt; every attempt is its own stored record, so earlier
   results are never overwritten.
────────────────────────────────────────────────────────────────────────────── */

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function formatDuration(totalSeconds) {
  if (!totalSeconds) return 'No limit';
  const m = Math.round(totalSeconds / 60);
  return `${m} min`;
}

function negativeMarkingLabel(scoring) {
  const neg = scoring?.negativeMarksPerIncorrect || 0;
  if (!neg) return 'None';
  return scoring.negativeMarkingRule === 'full_marks_plus_penalty'
    ? `−${(scoring.marksPerCorrect || 1) + neg} per incorrect (lost marks + penalty)`
    : `−${neg} per incorrect`;
}

export default function SharedTestDetails() {
  const { sharedTestId } = useParams();
  const navigate = useNavigate();

  const [state, setState] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [details, setDetails] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    (async () => {
      try {
        const data = await sharedTestService.getSharedTestDetails(sharedTestId);
        if (cancelled) return;
        setDetails(data);
        setState('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Could not load this Shared Test.');
        setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [sharedTestId]);

  if (state === 'loading') {
    return (
      <main className="page-wrapper">
        <div className="std-center">
          <p className="std-center__text" role="status">Loading Shared Test…</p>
        </div>
      </main>
    );
  }

  if (state === 'error') {
    return (
      <main className="page-wrapper">
        <div className="std-center">
          <h1 className="std-center__title">Can't open this Shared Test</h1>
          <p className="std-center__text" role="alert">{error}</p>
          <Link to="/shared-tests" className="btn btn--primary">
            <ArrowLeftIcon />
            Back to Shared Tests
          </Link>
        </div>
      </main>
    );
  }

  const { sharedTest, isCreator, attempts } = details;
  const isExpired = sharedTest.status === 'expired';

  return (
    <main className="page-wrapper">
      <div className="std">
        
          <Link to="/shared-tests" className="std-back">
            <ArrowLeftIcon />
            Back to Shared Tests
          </Link>
        

        <header className="std-header">
          <div>
            <h1 className="std-title">{sharedTest.title || 'Shared Test'}</h1>
            <p className="std-id">{sharedTest.testId}</p>
          </div>
          <span className={`shared-status-badge shared-status-badge--${sharedTest.status}`}>
            {isExpired ? 'Expired' : 'Active'}
          </span>
        </header>

        {isExpired && (
          <div className="std-notice" role="note">
            <strong>This Shared Test has expired.</strong>{' '}
            It no longer accepts new participants, but you can keep reattempting
            it as many times as you like, and your earlier results stay available.
          </div>
        )}

        <dl className="std-facts">
          <div><dt>Questions</dt><dd>{sharedTest.questionCount}</dd></div>
          <div><dt>Time limit</dt><dd>{formatDuration(sharedTest.durationSeconds)}</dd></div>
          <div><dt>Marks per correct</dt><dd>{sharedTest.scoring?.marksPerCorrect ?? 1}</dd></div>
          <div><dt>Negative marking</dt><dd>{negativeMarkingLabel(sharedTest.scoring)}</dd></div>
          <div><dt>Created At</dt><dd>{formatDateTime(sharedTest.createdAt)}</dd></div>
          <div><dt>{isExpired ? 'Expired At' : 'Expires At'}</dt><dd>{formatDateTime(sharedTest.expiresAt)}</dd></div>
          {isCreator && <div><dt>Your role</dt><dd>Creator</dd></div>}
        </dl>

        <div className="std-actions">
          <button
            className="btn btn--primary btn--lg"
            onClick={() => navigate(`/shared-tests/take/${sharedTest.testId}`)}
          >
            {attempts.length > 0 ? 'Reattempt' : 'Start attempt'}
          </button>
        </div>

        <section className="std-history" aria-labelledby="std-history-title">
          <h2 className="std-history__title" id="std-history-title">Your attempts</h2>
          {attempts.length === 0 ? (
            <div className="shared-empty">
              <p className="shared-empty__title">You haven't completed an attempt yet.</p>
              <p className="shared-empty__body">Your results will appear here after you submit one.</p>
            </div>
          ) : (
            <ol className="std-attempts">
              {attempts.map((a, i) => {
                const score = `${a.results?.rawScore ?? a.results?.correct ?? 0}/${a.results?.maxPossibleScore ?? a.results?.gradedCount ?? 0}`;
                return (
                  <li key={a.id}>
                    <Link to={`/shared-tests/result/${a.id}`} className="shared-result-card">
                      <div>
                        <p className="shared-result-card__title">Attempt {attempts.length - i}</p>
                        <p className="shared-result-card__meta">{formatDateTime(a.submittedAt)}</p>
                      </div>
                      <span className="shared-result-card__score">{score}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

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