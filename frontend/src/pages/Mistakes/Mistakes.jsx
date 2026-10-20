import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as practiceService from '../../services/practiceService';
import './Mistakes.css';

/* ─── Mistakes — M15 ──────────────────────────────────────────────────────────
   A "mistake" here means: answered incorrectly in the MOST RECENT completed
   attempt of whichever test it belongs to (see attemptService.getMistakes,
   backend, for the exact reasoning). If you retook a test and got something
   right the second time, it won't show up here anymore — this always
   reflects where things actually stand right now, not stale history.

   "Practice My Mistakes" builds a real Test from exactly what's shown here
   and routes into the same test-taking engine everything else uses.
────────────────────────────────────────────────────────────────────────────── */

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Mistakes() {
  const navigate = useNavigate();

  const [status,    setStatus]    = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [mistakes,  setMistakes]  = useState([]);

  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await practiceService.getMistakes();
        if (cancelled) return;
        setMistakes(data);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || 'Could not load your mistakes.');
        setStatus('load-error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handlePractice() {
    setIsStarting(true);
    setStartError('');
    try {
      const questionIds = [...new Set(mistakes.map(m => m.id))];

      const test = await practiceService.createPracticeTest(
        'Mistakes Practice',
        questionIds
      );
      navigate(`/test/${test.id}`);
    } catch (err) {
      setIsStarting(false);
      setStartError(err.message || 'Could not start a practice session. Please try again.');
    }
  }

  if (status === 'loading') {
    return (
      <main className="page-wrapper">
        <div className="mst-load-wrap">
          <span className="mst-load-spinner" aria-hidden="true"><SpinnerIcon /></span>
          <p className="mst-load-text">Loading your mistakes…</p>
        </div>
      </main>
    );
  }

  if (status === 'load-error') {
    return (
      <main className="page-wrapper">
        <div className="mst-load-wrap">
          <span className="mst-load-error-icon" aria-hidden="true"><ErrorBigIcon /></span>
          <h1 className="mst-load-title">Couldn't load your mistakes</h1>
          <p className="mst-load-text">{loadError}</p>
          <Link to="/dashboard" className="btn btn--primary">Back to Dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-wrapper">
      <div className="mst">

        <header className="mst-header">
          <div>
            <h1 className="mst-title">Recent Mistakes</h1>
            <p className="mst-subtitle">
              {mistakes.length} {mistakes.length === 1 ? 'question' : 'questions'} you got wrong, most recently.
            </p>
          </div>
          {mistakes.length > 0 && (
            <button className="btn btn--primary" onClick={handlePractice} disabled={isStarting}>
              {isStarting ? 'Starting…' : 'Practice My Mistakes'} <ArrowRightIcon />
            </button>
          )}
        </header>

        {startError && (
          <p className="mst-error" role="alert"><ErrorIcon /> {startError}</p>
        )}

        {mistakes.length === 0 ? (
          <div className="mst-empty">
            <p className="mst-empty__title">No current mistakes</p>
            <p className="mst-empty__body">
              Questions you get wrong on your most recent attempt of each test will show up here.
            </p>
            <Link to="/dashboard" className="btn btn--ghost btn--sm">Back to Dashboard</Link>
          </div>
        ) : (
          <ol className="mst-list">
            {mistakes.map((m, idx) => (
              <li key={m.id}>
                <MistakeCard mistake={m} index={idx} />
              </li>
            ))}
          </ol>
        )}

      </div>
    </main>
  );
}

/* ─── MistakeCard ─────────────────────────────────────────────────────────*/

function MistakeCard({ mistake, index }) {
  const visibleOptions = ['A', 'B', 'C', 'D'].filter(l => mistake.options[l]?.trim());

  return (
    <div className="mst-card">
      <div className="mst-card__header">
        <span className="mst-card__num">Q{index + 1}</span>
        <span className="mst-card__source">
          {mistake.testTitle} · {formatDate(mistake.lastAttemptedAt)}
        </span>
      </div>

      <p className="mst-card__text">{mistake.text}</p>

      <div className="mst-card__options">
        {visibleOptions.map(letter => {
          const isUser    = mistake.yourAnswer === letter;
          const isCorrect = mistake.correctAnswer === letter;

          const cls = [
            'mst-opt',
            isCorrect ? 'mst-opt--correct' : '',
            isUser && !isCorrect ? 'mst-opt--wrong' : '',
          ].filter(Boolean).join(' ');

          return (
            <div key={letter} className={cls}>
              <span className="mst-opt__letter">{letter}</span>
              <span className="mst-opt__text">{mistake.options[letter]}</span>
              {isUser && <span className="mst-opt__tag mst-opt__tag--user">Your answer</span>}
              {isCorrect && !isUser && <span className="mst-opt__tag mst-opt__tag--correct">Correct answer</span>}
            </div>
          );
        })}
      </div>

      {mistake.explanation && (
        <div className="mst-card__explanation">
          <p className="mst-card__explanation-label">Explanation</p>
          <p className="mst-card__explanation-text">{mistake.explanation}</p>
        </div>
      )}
    </div>
  );
}

/* ─── SVG Icons ───────────────────────────────────────────────────────────*/

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 4v4M7 10v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function ErrorBigIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2"/>
      <path d="M20 12v10M20 26v1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="mst-load-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" strokeOpacity="0.25"/>
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  );
}
