import { useState } from 'react';
import { ORDER_MODE_OPTIONS, ORDER_MODES } from '../../utils/questionOrder';
import ThemeToggle from '../../components/ThemeToggle/ThemeToggle';
import Footer from '../../components/Footer/Footer';
import './QuestionOrderSelector.css';


/* ─── QuestionOrderSelector — NEW ──────────────────────────────────────────────
   A genuinely new, standalone component (not tied to Test.jsx or
   SharedTestTaking.jsx specifically) — both pages import and use the
   exact same component, reused rather than duplicated.

   Implemented as a PHASE within the existing test-taking flow, not a
   separate route — this exactly matches how the existing "Timer/Settings"
   step (Test.jsx's own 'setup' phase) already works: it's "a page" from
   the user's perspective without being a distinct URL. Inserting this as
   a new phase (loading → order-selection → setup → active) is the
   consistent architectural choice, and avoids the real fragility of a
   separate route needing to either refetch the test or pass it through
   router state across a navigation.

   Visual pattern deliberately mirrors the Scoring Rules page's negative-
   marking rule cards (radio + label + description) — same design
   language, not a new one introduced for this one page.
────────────────────────────────────────────────────────────────────────────── */

export default function QuestionOrderSelector({ questionCount, onContinue }) {
  const [selected, setSelected] = useState(ORDER_MODES.ORIGINAL);

  return (
    <div className="order-select-page">

      {/* Header — matches Set Your Test Timer */}
      <header className="tsetup-header">
        <div className="test-header__logo">
          <span className="test-header__logo-mark">EPC</span>
          <span className="test-header__logo-name">Exam Practice</span>
        </div>

        <ThemeToggle />
      </header>

      {/* Main content */}
      <main className="order-select-wrap">
        <div className="order-select-card">
          <h1 className="order-select-title">
            Question &amp; Option Order
          </h1>

          <p className="order-select-subtitle">
            Choose how the {questionCount}{' '}
            {questionCount === 1 ? 'question' : 'questions'} in
            this test should be ordered for this attempt. This only
            affects what you see this time — the saved test itself
            is never changed.
          </p>

          <div
            className="order-select-options"
            role="radiogroup"
            aria-label="Question and option order"
          >
            {ORDER_MODE_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={`order-select-card-item${
                  selected === opt.value
                    ? ' order-select-card-item--active'
                    : ''
                }`}
              >
                <input
                  type="radio"
                  name="question-order-mode"
                  value={opt.value}
                  checked={selected === opt.value}
                  onChange={() => setSelected(opt.value)}
                  className="order-select-radio"
                />

                <span className="order-select-card-body">
                  <span className="order-select-card-label">
                    {opt.label}
                  </span>

                  <span className="order-select-card-desc">
                    {opt.description}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <button
            type="button"
            className="btn btn--primary btn--lg order-select-continue"
            onClick={() => onContinue(selected)}
          >
            Continue <ArrowRightIcon />
          </button>
        </div>
      </main>

      {/* Shared site footer */}
      <Footer />

    </div>
  );
}


function ArrowRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M3 7.5h9M8.5 4l3.5 3.5L8.5 11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}