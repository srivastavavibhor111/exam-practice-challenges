import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as practiceService from '../../services/practiceService';
import './Bookmarks.css';

/* ─── Bookmarks — M15 ────────────────────────────────────────────────────────
   Every question the user has bookmarked, across all their tests. "Practice
   These" builds a real Test (testService.createPracticeTest, backend) from
   exactly the questions currently shown here, then routes into the SAME
   test-taking engine (M12) everything else in this app already uses —
   nothing new to build there.
────────────────────────────────────────────────────────────────────────────── */

export default function Bookmarks() {
  const navigate = useNavigate();

  const [status,    setStatus]    = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [questions, setQuestions] = useState([]);

  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await practiceService.getBookmarked();
        if (cancelled) return;
        setQuestions(data);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || 'Could not load your bookmarks.');
        setStatus('load-error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleRemoveBookmark(questionId) {
    setQuestions(prev => prev.filter(q => q.id !== questionId));
    try {
      await practiceService.toggleBookmark(questionId, false);
    } catch (err) {
      console.warn('Could not remove bookmark — reloading to stay in sync.', err);
      try {
        const data = await practiceService.getBookmarked();
        setQuestions(data);
      } catch {
        // Leave the optimistic removal in place — better than a broken retry loop.
      }
    }
  }

  async function handlePractice() {
    setIsStarting(true);
    setStartError('');
    try {
      const test = await practiceService.createPracticeTest(
        'Bookmarked Questions Practice',
        questions.map(q => q.id)
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
        <div className="bmk-load-wrap">
          <span className="bmk-load-spinner" aria-hidden="true"><SpinnerIcon /></span>
          <p className="bmk-load-text">Loading your bookmarks…</p>
        </div>
      </main>
    );
  }

  if (status === 'load-error') {
    return (
      <main className="page-wrapper">
        <div className="bmk-load-wrap">
          <span className="bmk-load-error-icon" aria-hidden="true"><ErrorBigIcon /></span>
          <h1 className="bmk-load-title">Couldn't load your bookmarks</h1>
          <p className="bmk-load-text">{loadError}</p>
          <Link to="/dashboard" className="btn btn--primary">Back to Dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-wrapper">
      <div className="bmk">

        <header className="bmk-header">
          <div>
            <h1 className="bmk-title">Bookmarked Questions</h1>
            <p className="bmk-subtitle">
              {questions.length} {questions.length === 1 ? 'question' : 'questions'} saved for later review.
            </p>
          </div>
          {questions.length > 0 && (
            <button className="btn btn--primary" onClick={handlePractice} disabled={isStarting}>
              {isStarting ? 'Starting…' : 'Practice These'} <ArrowRightIcon />
            </button>
          )}
        </header>

        {startError && (
          <p className="bmk-error" role="alert"><ErrorIcon /> {startError}</p>
        )}

        {questions.length === 0 ? (
          <div className="bmk-empty">
            <p className="bmk-empty__title">No bookmarks yet</p>
            <p className="bmk-empty__body">
              While reviewing a result, click the bookmark icon on any question to save it here.
            </p>
            <Link to="/dashboard" className="btn btn--ghost btn--sm">Back to Dashboard</Link>
          </div>
        ) : (
          <ol className="bmk-list">
            {questions.map((q, idx) => (
              <li key={q.id}>
                <BookmarkCard question={q} index={idx} onRemove={() => handleRemoveBookmark(q.id)} />
              </li>
            ))}
          </ol>
        )}

      </div>
    </main>
  );
}

/* ─── BookmarkCard ────────────────────────────────────────────────────────*/

function BookmarkCard({ question, index, onRemove }) {
  const visibleOptions = ['A', 'B', 'C', 'D'].filter(l => question.options[l]?.trim());

  return (
    <div className="bmk-card">
      <div className="bmk-card__header">
        <span className="bmk-card__num">Q{index + 1}</span>
        <button className="bmk-card__remove" onClick={onRemove}>
          <BookmarkFilledIcon /> Remove
        </button>
      </div>

      <p className="bmk-card__text">{question.text}</p>

      <div className="bmk-card__options">
        {visibleOptions.map(letter => (
          <div key={letter} className={`bmk-opt${question.correctAnswer === letter ? ' bmk-opt--correct' : ''}`}>
            <span className="bmk-opt__letter">{letter}</span>
            <span className="bmk-opt__text">{question.options[letter]}</span>
            {question.correctAnswer === letter && (
              <span className="bmk-opt__tag"><CheckIcon /> Correct</span>
            )}
          </div>
        ))}
      </div>

      {question.explanation && (
        <div className="bmk-card__explanation">
          <p className="bmk-card__explanation-label">Explanation</p>
          <p className="bmk-card__explanation-text">{question.explanation}</p>
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

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4 6.5l1.8 1.8L9.2 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
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

function BookmarkFilledIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 2.5h8a.5.5 0 01.5.5v10.5l-4.5-3-4.5 3V3a.5.5 0 01.5-.5z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="bmk-load-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" strokeOpacity="0.25"/>
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  );
}
