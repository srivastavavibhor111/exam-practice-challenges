import { useState } from 'react';
import * as extractionService from '../../services/extractionService';
import './CreateTest.css';
import { useNavigate, useLocation } from 'react-router-dom';

/* ─── CreateTest ──────────────────────────────────────────────────────────────
   M3 UI, M10 wiring — Create Test now calls the real extraction API.

   Two input methods (toggled via tab selector):
     A. Paste Text  — textarea accepting raw MCQ content from any source
     B. ChatGPT Link — URL input for a public ChatGPT shared conversation

   On "Generate Test":
     1. Client-side validation runs (unchanged from M3).
     2. Calls extractionService.extractFromText/extractFromLink (M9's real
        AI extraction, via the backend) — this replaces M3's simulated delay.
     3a. Success → navigate to /review with the extracted questions already
         in hand. Review no longer needs to do its own extraction — that
         already happened here.
     3b. Failure, link method → per architecture rule #3's required
         fallback, automatically switch to the Paste Text tab with a clear
         explanation, rather than leaving the user stuck on a dead link.
     3c. Failure, text method → show the error inline, exactly like any
         other validation error. The user's typed content is never lost.
────────────────────────────────────────────────────────────────────────────── */

const METHOD_TEXT = 'text';
const METHOD_LINK = 'link';

const TEXT_MIN_CHARS  = 50;
const CHAR_WARN_AT    = 40_000;
const CHAR_LIMIT      = 50_000;

export default function CreateTest() {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = location.state?.mode === 'shared' ? 'shared' : 'personal';


  // ── Form state ─────────────────────────────────────────────────────────────
  const [method,       setMethod]       = useState(METHOD_TEXT);
  const [textValue,    setTextValue]    = useState('');
  const [linkValue,    setLinkValue]    = useState('');
  const [errors,       setErrors]       = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [showExample,  setShowExample]  = useState(false);

  // ── Derived values ─────────────────────────────────────────────────────────
  const charCount    = textValue.length;
  const charOver     = charCount > CHAR_LIMIT;
  const charWarning  = charCount >= CHAR_WARN_AT && !charOver;

  const hasContent =
    method === METHOD_TEXT
      ? textValue.trim().length >= TEXT_MIN_CHARS && !charOver
      : linkValue.trim().length > 0;

  // ── Method change ──────────────────────────────────────────────────────────
  function handleMethodChange(newMethod) {
    setMethod(newMethod);
    setErrors({});
    setShowExample(false);
  }

  // ── Input handlers ─────────────────────────────────────────────────────────
  function handleTextChange(e) {
    setTextValue(e.target.value);
    if (errors.text) setErrors(prev => ({ ...prev, text: null }));
  }

  function handleLinkChange(e) {
    setLinkValue(e.target.value);
    if (errors.link) setErrors(prev => ({ ...prev, link: null }));
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate() {
    if (method === METHOD_TEXT) {
      if (!textValue.trim())
        return { text: 'Please paste your MCQ content before continuing.' };
      if (textValue.trim().length < TEXT_MIN_CHARS)
        return { text: 'Content is too short — paste at least a few questions.' };
      if (charOver)
        return { text: `Content exceeds the ${CHAR_LIMIT.toLocaleString()}-character limit.` };
    }

    if (method === METHOD_LINK) {
      if (!linkValue.trim())
        return { link: 'Please enter a ChatGPT conversation link.' };
      try {
        const url = new URL(linkValue.trim());
        const validHosts = ['chat.openai.com', 'chatgpt.com'];
        const isValid    = validHosts.some(h => url.hostname.includes(h));
        if (!isValid)
          return { link: 'Please enter a link from chat.openai.com or chatgpt.com.' };
      } catch {
        return { link: 'Please enter a valid URL (e.g. https://chatgpt.com/share/…).' };
      }
    }

    return {};
  }

  // ── Generate ───────────────────────────────────────────────────────────────
  async function handleGenerate() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    setIsGenerating(true);

    try {
      const result = method === METHOD_TEXT
        ? await extractionService.extractFromText(textValue.trim())
        : await extractionService.extractFromLink(linkValue.trim());

      setIsGenerating(false);

      if (!result.success) {
        // Per architecture rule #3: if a link genuinely can't be read,
        // fall back to asking the user to paste the text instead — don't
        // just leave them stuck on a method that's not going to work.
        if (result.fallbackToPaste && method === METHOD_LINK) {
          setMethod(METHOD_TEXT);
          setErrors({ text: `${result.message} Please paste the conversation text below instead.` });
        } else {
          setErrors({ [method === METHOD_TEXT ? 'text' : 'link']: result.message });
        }
        return;
      }

      // Extraction already happened — Review just displays and lets the
      // user edit what came back. No more work for it to simulate.
      navigate('/review', {
        state: {
          method,
          content: result.content,
          sourceUrl: method === METHOD_LINK ? linkValue.trim() : undefined,
          questions: result.questions,
          mode, // 'shared' or 'personal' — see Review.jsx/ScoringRules.jsx
        },
      });
    } catch (err) {
      setIsGenerating(false);
      setErrors({
        [method === METHOD_TEXT ? 'text' : 'link']:
          err.message || 'Something went wrong while extracting your questions. Please try again.',
      });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="page-wrapper">
      <div className="ct">

        {/* ── Page header ── */}
        <header className="ct__header">
          <h1 className="ct__title">Create Your Test</h1>
          <p className="ct__subtitle">
            Paste MCQ content from any source, or share a public ChatGPT
            conversation. We'll extract the questions and build a test for you.
          </p>
        </header>

        {/* ── Main card ── */}
        <div className="ct__card">

          {/* Method selector (tab row) */}
          <div className="ct__method-selector" role="tablist" aria-label="Choose input method">
            <button
              role="tab"
              aria-selected={method === METHOD_TEXT}
              className={`ct__method-btn${method === METHOD_TEXT ? ' ct__method-btn--active' : ''}`}
              onClick={() => handleMethodChange(METHOD_TEXT)}
            >
              <PasteIcon />
              Paste Text
            </button>
            <button
              role="tab"
              aria-selected={method === METHOD_LINK}
              className={`ct__method-btn${method === METHOD_LINK ? ' ct__method-btn--active' : ''}`}
              onClick={() => handleMethodChange(METHOD_LINK)}
            >
              <LinkIcon />
              ChatGPT Link
            </button>
          </div>

          {/* Conditional input panel */}
          {method === METHOD_TEXT ? (
            <TextPanel
              value={textValue}
              onChange={handleTextChange}
              error={errors.text}
              charCount={charCount}
              charLimit={CHAR_LIMIT}
              charWarning={charWarning}
              charOver={charOver}
              showExample={showExample}
              onToggleExample={() => setShowExample(s => !s)}
            />
          ) : (
            <LinkPanel
              value={linkValue}
              onChange={handleLinkChange}
              error={errors.link}
            />
          )}

          {/* Generate button */}
          <button
            className={`btn btn--primary btn--lg ct__generate-btn${isGenerating ? ' ct__generate-btn--loading' : ''}`}
            onClick={handleGenerate}
            disabled={!hasContent || isGenerating}
            aria-busy={isGenerating}
          >
            {isGenerating ? (
              <>
                <SpinnerIcon />
                Extracting questions…
              </>
            ) : (
              <>
                Generate Test
                <ArrowRightIcon />
              </>
            )}
          </button>

        </div>

        {/* What happens next (sets expectations, reduces anxiety) */}
        <WhatHappensNext />

      </div>
    </main>
  );
}

/* ─── Text Panel ──────────────────────────────────────────────────────────────
   Large textarea for pasting raw MCQ content.
────────────────────────────────────────────────────────────────────────────── */

function TextPanel({ value, onChange, error, charCount, charLimit, charWarning, charOver, showExample, onToggleExample }) {
  const counterClass = charOver
    ? 'ct__char-counter--over'
    : charWarning
    ? 'ct__char-counter--warn'
    : '';

  return (
    <div className="ct__input-panel">
      <div className="ct__input-group">
        <label className="ct__label" htmlFor="ct-text-input">
          MCQ Content
        </label>
        <textarea
          id="ct-text-input"
          className={`ct__textarea${error ? ' ct__field--error' : ''}`}
          value={value}
          onChange={onChange}
          placeholder={TEXTAREA_PLACEHOLDER}
          rows={10}
          aria-describedby={error ? 'ct-text-error' : 'ct-text-hint'}
          aria-invalid={!!error}
          spellCheck={false}
        />
        <div className="ct__input-footer">
          {error ? (
            <p id="ct-text-error" className="ct__error-msg" role="alert">
              <ErrorIcon /> {error}
            </p>
          ) : (
            <p id="ct-text-hint" className="ct__hint">
              Supports ChatGPT output, numbered lists, and most common MCQ formats.
            </p>
          )}
          <span className={`ct__char-counter ${counterClass}`} aria-live="polite">
            {charCount.toLocaleString()} / {charLimit.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="ct__example-section">
        <button
          className="ct__example-toggle"
          type="button"
          onClick={onToggleExample}
          aria-expanded={showExample}
        >
          <ChevronIcon open={showExample} />
          {showExample ? 'Hide example format' : 'See example format'}
        </button>

        {showExample && (
          <div className="ct__example-block" aria-live="polite">
            <p className="ct__example-label">Accepted format example</p>
            <pre className="ct__example-code">{EXAMPLE_MCQ}</pre>
            <p className="ct__example-note">
              Explanations are optional. Questions don't need to be numbered.
              Most ChatGPT MCQ output will work directly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Link Panel ──────────────────────────────────────────────────────────────*/

function LinkPanel({ value, onChange, error }) {
  return (
    <div className="ct__input-panel">
      <div className="ct__input-group">
        <label className="ct__label" htmlFor="ct-link-input">
          Conversation Link
        </label>
        <div className={`ct__url-wrapper${error ? ' ct__field--error' : ''}`}>
          <span className="ct__url-icon" aria-hidden="true">
            <LinkIcon />
          </span>
          <input
            id="ct-link-input"
            type="url"
            className="ct__url-input"
            value={value}
            onChange={onChange}
            placeholder="https://chatgpt.com/share/…"
            aria-describedby={error ? 'ct-link-error' : 'ct-link-hint'}
            aria-invalid={!!error}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {error ? (
          <p id="ct-link-error" className="ct__error-msg" role="alert">
            <ErrorIcon /> {error}
          </p>
        ) : (
          <p id="ct-link-hint" className="ct__hint">
            Paste the share link from a ChatGPT conversation that contains MCQs.
          </p>
        )}
      </div>

      <div className="ct__notice" role="note">
        <InfoIcon />
        <p>
          <strong>Public links only.</strong> The conversation must be shared via
          ChatGPT's Share button. If the link is private or inaccessible, we'll
          ask you to paste the text instead.
        </p>
      </div>
    </div>
  );
}

/* ─── What Happens Next ───────────────────────────────────────────────────────*/

const NEXT_STEPS = [
  {
    num: '1',
    title: 'Questions are extracted',
    desc: 'Our AI identifies every question, option, and answer from your content.',
  },
  {
    num: '2',
    title: 'You review before the test',
    desc: "Edit questions, fix options, or remove anything that doesn't look right.",
  },
  {
    num: '3',
    title: 'Take the test and see results',
    desc: 'Answer at your own pace and get a full performance breakdown.',
  },
];

function WhatHappensNext() {
  return (
    <section className="ct__what-next" aria-label="What happens after you generate">
      <p className="ct__what-next-heading">What happens next</p>
      <ol className="ct__next-steps">
        {NEXT_STEPS.map(step => (
          <li key={step.num} className="ct__next-step">
            <span className="ct__next-num" aria-hidden="true">{step.num}</span>
            <div>
              <p className="ct__next-title">{step.title}</p>
              <p className="ct__next-desc">{step.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ─── Constants ───────────────────────────────────────────────────────────────*/

const TEXTAREA_PLACEHOLDER =
  `Paste your MCQs here…\n\nWorks with:\n• ChatGPT output\n• Numbered question lists\n• Most common MCQ formats`;

const EXAMPLE_MCQ =
`Q1. Which of the following is NOT found in animal cells?

A) Mitochondria
B) Nucleus
C) Cell wall
D) Ribosome

Answer: C
Explanation: Cell walls are found in plant cells, not animal cells.

Q2. What is the powerhouse of the cell?

A) Nucleus
B) Ribosome
C) Mitochondria
D) Vacuole

Answer: C`;

/* ─── SVG Icons ───────────────────────────────────────────────────────────────*/

function PasteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="2.5" y="1.5" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 5.5h5M5 8h5M5 10.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M6 9a3.3 3.3 0 004.7 0l1.9-1.9a3.3 3.3 0 00-4.7-4.7L6.6 3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 6a3.3 3.3 0 00-4.7 0L2.4 7.9a3.3 3.3 0 004.7 4.7l1.3-1.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="ct__spinner" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.5 3.5V7M6.5 9v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }}>
      <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7.5 5v.5M7.5 7v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 13 13" fill="none"
      aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}
    >
      <path d="M2.5 4.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
