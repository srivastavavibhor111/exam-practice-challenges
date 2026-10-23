import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as sharedTestService from '../../services/sharedTestService';
import './SharedTests.css';

/* ─── SharedTests — "Shared Tests" ────────────────────────────────────────────
   A genuinely separate ecosystem — every piece of data on this page comes
   from the SharedTest/SharedAttempt/SharedTestBookmark collections, never
   from the personal Test/Question/Attempt models. Nothing here appears on
   Dashboard, My Tests, or Progress, and nothing from those pages appears
   here — by construction (separate collections), not by filtering.

   Six sections, per spec:
     A. Create a Shared Test   — entry point into the existing Create Test
                                   flow, in "shared" mode (see CreateTest.jsx's
                                   patch)
     B. Join a Shared Test      — Test ID input, validates format/existence/
                                   expiration via the backend before allowing
                                   a new attempt to start
     C. Shared Tests Created by Me
     D. My Shared Test Results  — both self-created-then-attempted AND
                                   joined-from-others, naturally (the backend
                                   query doesn't distinguish the two)
     E. Shared Test Bookmarks
     F. Shared Test Wrong Questions
────────────────────────────────────────────────────────────────────────────── */

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function SharedTests() {
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState('');

  const [createdByMe, setCreatedByMe] = useState([]);
  const [joined, setJoined] = useState([]);
  const [myResults, setMyResults] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [mistakes, setMistakes] = useState([]);

  const [joinTestId, setJoinTestId] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const [copiedId, setCopiedId] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [mine, joinedTests, results, bm, mis] = await Promise.all([
          sharedTestService.listMySharedTests(),
          sharedTestService.listJoinedSharedTests(),
          sharedTestService.listMySharedAttempts(),
          sharedTestService.getSharedBookmarks(),
          sharedTestService.getSharedMistakes(),
        ]);
        if (cancelled) return;
        setCreatedByMe(mine);
        setJoined(joinedTests);
        setMyResults(results);
        setBookmarks(bm);
        setMistakes(mis);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || 'Could not load your shared tests.');
        setStatus('load-error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function handleCreateClick() {
    // Reuses the EXISTING Create Test → Review → Scoring Rules pipeline,
    // in "shared" mode — see CreateTest.jsx's patch for how this flag
    // threads through.
    navigate('/create', { state: { mode: 'shared' } });
  }

  async function handleJoin(e) {
    e.preventDefault();
    setJoinError('');

    const trimmed = joinTestId.trim().toUpperCase();
    if (!trimmed) {
      setJoinError('Please enter a Test ID.');
      return;
    }

    setIsJoining(true);
    try {
      const sharedTest = await sharedTestService.lookupSharedTest(trimmed);
      // The backend already refused brand-new users on an expired test
      // (that error is shown below). If we got here:
      //   • active  → straight into the taking flow, as before
      //   • expired → an existing participant: open the details page first
      //               (results + history + Reattempt), not the test itself.
      if (sharedTest.status === 'expired') {
        navigate(`/shared-tests/details/${sharedTest.testId}`);
      } else {
        navigate(`/shared-tests/take/${sharedTest.testId}`);
      }
    } catch (err) {
      setIsJoining(false);
      setJoinError(err.message || 'Could not join this Shared Test. Please try again.');
    }
  }

  function handleCopyId(testId) {
    navigator.clipboard?.writeText(testId).then(() => {
      setCopiedId(testId);
      setTimeout(() => setCopiedId(''), 1500);
    });
  }

  if (status === 'loading') {
    return (
      <main className="page-wrapper">
        <div className="shared-load-wrap">
          <span className="shared-load-spinner" aria-hidden="true"><SpinnerIcon /></span>
          <p className="shared-load-text">Loading Shared Tests…</p>
        </div>
      </main>
    );
  }

  if (status === 'load-error') {
    return (
      <main className="page-wrapper">
        <div className="shared-load-wrap">
          <span className="shared-load-error-icon" aria-hidden="true"><ErrorBigIcon /></span>
          <h1 className="shared-load-title">Couldn't load Shared Tests</h1>
          <p className="shared-load-text">{loadError}</p>
          <Link to="/dashboard" className="btn btn--primary">Back to Dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-wrapper">
      <div className="shared-tests">

        <header className="shared-header">
          <h1 className="shared-title">Shared Tests</h1>
          <p className="shared-subtitle">
            Create a test and share it with others using a unique Test ID, or
            join a test someone shared with you.
          </p>
        </header>

        {/* ── A: Create ── */}
        <section className="shared-section">
          <div className="shared-create-card">
            <div>
              <h2 className="shared-create-card__title">Create a Shared Test</h2>
              <p className="shared-create-card__body">
                Build a test the same way as always — anyone with its Test ID
                can join it for the next 48 hours. After that, everyone who has
                attempted it — including you — can keep reattempting it.
              </p>
            </div>
            <button className="btn btn--primary btn--lg" onClick={handleCreateClick}>
              <PlusIcon /> Create a Shared Test
            </button>
          </div>
        </section>

        {/* ── B: Join ── */}
        <section className="shared-section">
          <h2 className="shared-section__title">Join a Shared Test</h2>
          <form className="shared-join-card" onSubmit={handleJoin}>
            <div className="shared-join-card__field">
              <label className="shared-join-card__label" htmlFor="join-test-id">
                Enter Test ID
              </label>
              <input
                id="join-test-id"
                type="text"
                className="shared-join-card__input"
                value={joinTestId}
                onChange={e => setJoinTestId(e.target.value)}
                placeholder="ST-4827-K9XM"
                autoComplete="off"
                aria-describedby={joinError ? 'join-test-id-error' : undefined}
                aria-invalid={!!joinError}
              />
            </div>
            <button className="btn btn--primary" type="submit" disabled={isJoining}>
              {isJoining ? 'Joining…' : 'Join'}
            </button>
          </form>
          {joinError && (
            <p className="shared-join-error" id="join-test-id-error" role="alert">
              <ErrorIcon /> {joinError}
            </p>
          )}
        </section>

        {/* ── C: Created by Me ── */}
        <section className="shared-section">
          <h2 className="shared-section__title">Shared Tests Created by Me</h2>
          {createdByMe.length === 0 ? (
            <div className="shared-empty">
              <p className="shared-empty__title">You haven't created any Shared Tests yet.</p>
            </div>
          ) : (
            <div className="shared-created-grid">
              {createdByMe.map(t => (
                <CreatedTestCard key={t.id} test={t} onCopy={handleCopyId} copiedId={copiedId} />
              ))}
            </div>
          )}
        </section>

        {/* ── C2: Joined (tests created by others that I've attempted) ── */}
        <section className="shared-section">
          <h2 className="shared-section__title">Shared Tests I've Joined</h2>
          {joined.length === 0 ? (
            <div className="shared-empty">
              <p className="shared-empty__title">You haven't joined anyone else's Shared Test yet.</p>
              <p className="shared-empty__body">
                Tests you attempt stay here, even after they expire, so you can keep practising.
              </p>
            </div>
          ) : (
            <div className="shared-results-list">
              {joined.map(t => (
                <Link key={t.id} to={`/shared-tests/details/${t.testId}`} className="shared-result-card">
                  <div>
                    <p className="shared-result-card__title">{t.title || 'Shared Test'}</p>
                    <p className="shared-result-card__meta">
                      {t.testId} · {t.attemptCount} {t.attemptCount === 1 ? 'attempt' : 'attempts'}
                    </p>
                  </div>
                  <span className={`shared-status-badge shared-status-badge--${t.status}`}>
                    {t.status === 'active' ? 'Active' : 'Expired'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── D: My Results ── */}
        <section className="shared-section">
          <h2 className="shared-section__title">My Shared Test Results</h2>
          {myResults.length === 0 ? (
            <div className="shared-empty">
              <p className="shared-empty__title">No completed Shared Test attempts yet.</p>
            </div>
          ) : (
            <div className="shared-results-list">
              {myResults.map(a => (
                <Link key={a.id} to={`/shared-tests/result/${a.id}`} className="shared-result-card">
                  <div>
                    <p className="shared-result-card__title">{a.sharedTestTitle || 'Shared Test'}</p>
                    <p className="shared-result-card__meta">
                      {a.sharedTestId} · {formatDateTime(a.submittedAt)}
                    </p>
                  </div>
                  <span className="shared-result-card__score">
                    {a.results?.rawScore ?? a.results?.correct ?? 0}/{a.results?.maxPossibleScore ?? a.results?.gradedCount ?? 0}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── E: Bookmarks ── */}
        <section className="shared-section">
          <h2 className="shared-section__title">Shared Test Bookmarks</h2>
          {bookmarks.length === 0 ? (
            <div className="shared-empty">
              <p className="shared-empty__title">No bookmarked questions from Shared Tests yet.</p>
              <p className="shared-empty__body">
                While reviewing a Shared Test result, click the bookmark icon on any question to save it here.
              </p>
            </div>
          ) : (
            <ol className="shared-question-list">
              {bookmarks.map((q, i) => (
                <li key={q.id}><SharedQuestionCard question={q} index={i} showCorrectAnswer /></li>
              ))}
            </ol>
          )}
        </section>

        {/* ── F: Wrong Questions ── */}
        <section className="shared-section">
          <h2 className="shared-section__title">Shared Test Wrong Questions</h2>
          {mistakes.length === 0 ? (
            <div className="shared-empty">
              <p className="shared-empty__title">No current mistakes from Shared Tests.</p>
              <p className="shared-empty__body">
                Questions you get wrong on your most recent attempt of each Shared Test show up here.
              </p>
            </div>
          ) : (
            <ol className="shared-question-list">
              {mistakes.map((m, i) => (
                <li key={m.id}><SharedQuestionCard question={m} index={i} showUserAnswer /></li>
              ))}
            </ol>
          )}
        </section>

      </div>
    </main>
  );
}

/* ─── CreatedTestCard ─────────────────────────────────────────────────────*/

function CreatedTestCard({ test, onCopy, copiedId }) {
  return (
    <div className="shared-created-card">
      <div className="shared-created-card__header">
        <span className="shared-created-card__id">{test.testId}</span>
        <button
          className="shared-created-card__copy"
          onClick={() => onCopy(test.testId)}
          aria-label={`Copy Test ID ${test.testId}`}
        >
          {copiedId === test.testId ? <CheckIcon /> : <CopyIcon />}
          {copiedId === test.testId ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="shared-created-card__row">
        <span className="shared-created-card__label">Created At</span>
        <span>{formatDateTime(test.createdAt)}</span>
      </div>
      <div className="shared-created-card__row">
        <span className="shared-created-card__label">Expires At</span>
        <span>{formatDateTime(test.expiresAt)}</span>
      </div>
      <div className="shared-created-card__row">
        <span className="shared-created-card__label">Status</span>
        <span className={`shared-status-badge shared-status-badge--${test.status}`}>
          {test.status === 'active' ? 'Active' : 'Expired'}
        </span>
      </div>
      <Link to={`/shared-tests/details/${test.testId}`} className="btn btn--primary shared-created-card__details">
        View details
      </Link>
    </div>
  );
}

/* ─── SharedQuestionCard — used by both Bookmarks and Wrong Questions ────*/

function SharedQuestionCard({ question, index, showCorrectAnswer, showUserAnswer }) {
  const visibleOptions = ['A', 'B', 'C', 'D'].filter(l => question.options?.[l]?.trim());

  return (
    <div className="shared-question-card">
      <div className="shared-question-card__header">
        <span className="shared-question-card__num">Q{index + 1}</span>
        <span className="shared-question-card__source">
          {question.sharedTestTitle} · {question.sharedTestId}
        </span>
      </div>

      <p className="shared-question-card__text">{question.text}</p>

      <div className="shared-question-card__options">
        {visibleOptions.map(letter => {
          const isCorrect = showCorrectAnswer && question.correctAnswer === letter;
          const isUser = showUserAnswer && question.yourAnswer === letter;
          const isWrongUser = isUser && question.correctAnswer !== letter;
          const isRightAnswer = showUserAnswer && question.correctAnswer === letter;

          const cls = [
            'shared-opt',
            (isCorrect || isRightAnswer) ? 'shared-opt--correct' : '',
            isWrongUser ? 'shared-opt--wrong' : '',
          ].filter(Boolean).join(' ');

          return (
            <div key={letter} className={cls}>
              <span className="shared-opt__letter">{letter}</span>
              <span className="shared-opt__text">{question.options[letter]}</span>
              {isUser && <span className="shared-opt__tag shared-opt__tag--user">Your answer</span>}
              {isRightAnswer && !isUser && <span className="shared-opt__tag shared-opt__tag--correct">Correct answer</span>}
              {isCorrect && !showUserAnswer && <span className="shared-opt__tag shared-opt__tag--correct">Correct</span>}
            </div>
          );
        })}
      </div>

      {question.explanation && (
        <div className="shared-question-card__explanation">
          <p className="shared-question-card__explanation-label">Explanation</p>
          <p className="shared-question-card__explanation-text">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}

/* ─── SVG Icons ───────────────────────────────────────────────────────────*/

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 8.5v-6a1 1 0 011-1h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M2.5 7l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 4v4M7 10v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ErrorBigIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2" />
      <path d="M20 12v10M20 26v1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="shared-load-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
