import { Link } from 'react-router-dom';
import './Home.css';

/* ─── Home ────────────────────────────────────────────────────────────────────
   M2 — Landing Page

   Sections:
     1. Hero         — headline, CTA, and input→test visual mockup
     2. How It Works — three-step process
     3. Why Different — three feature cards
     4. CTA Banner   — conversion section

   The CTA buttons link to /create. That page doesn't exist until M3,
   so clicking them will show the NotFound page for now — which is correct.
────────────────────────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <main className="page-wrapper">
      <HeroSection />
      <HowItWorksSection />
      <WhyDifferentSection />
      <CTABannerSection />
    </main>
  );
}

/* ─── 1. Hero ─────────────────────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="hero">
      <div className="container hero__inner">

        {/* Left column: text content */}
        <div className="hero__text">

          <span className="hero__eyebrow">
            <span className="hero__eyebrow-dot" aria-hidden="true" />
            Built for your study material
          </span>

          <h1 className="hero__headline">
            Turn your MCQs into<br />a proper practice test.
          </h1>

          <p className="hero__body">
            Already have questions? Paste them in — from ChatGPT or any source.
            We extract, structure, and build a focused test with scoring,
            review, and analysis.
          </p>

          <div className="hero__actions">
            <Link to="/create" className="btn btn--primary btn--md">
              Create Your Test
              <ArrowRightIcon />
            </Link>
            <a href="#how-it-works" className="hero__scroll-link">
              See how it works
              <ChevronDownIcon />
            </a>
          </div>

          {/* Three quick proof points */}
          <div className="hero__proof">
            <div className="hero__proof-item">
              <span className="hero__proof-title">Works with any MCQs</span>
              <span className="hero__proof-sub">Paste from ChatGPT, notes, or PDFs</span>
            </div>
            <div className="hero__proof-divider" aria-hidden="true" />
            <div className="hero__proof-item">
              <span className="hero__proof-title">AI extraction</span>
              <span className="hero__proof-sub">Questions auto-identified</span>
            </div>
            <div className="hero__proof-divider" aria-hidden="true" />
            <div className="hero__proof-item">
              <span className="hero__proof-title">Full analysis</span>
              <span className="hero__proof-sub">Know exactly what you got wrong</span>
            </div>
          </div>
        </div>

        {/* Right column: visual mockup (hidden on mobile) */}
        <div className="hero__visual" aria-hidden="true">
          <HeroVisualMockup />
        </div>

      </div>
    </section>
  );
}

/* ─── Hero Visual Mockup ──────────────────────────────────────────────────────
   Illustrates the core product workflow: raw MCQ text → clean test card.
   This is purely decorative (aria-hidden on parent). No JS needed.
────────────────────────────────────────────────────────────────────────────── */

function HeroVisualMockup() {
  const options = [
    { letter: 'A', text: 'Mitochondria', selected: false },
    { letter: 'B', text: 'Nucleus',       selected: false },
    { letter: 'C', text: 'Cell wall',     selected: true  },
    { letter: 'D', text: 'Ribosome',      selected: false },
  ];

  return (
    <div className="mockup-card">

      {/* Input panel */}
      <p className="mockup-label">Your input</p>
      <div className="mockup-raw-text">
        <span className="mockup-raw-line">Q1. Which is NOT found in animal cells?</span>
        <span className="mockup-raw-line mockup-raw-gap">A) Mitochondria</span>
        <span className="mockup-raw-line">B) Nucleus</span>
        <span className="mockup-raw-line">C) Cell wall</span>
        <span className="mockup-raw-line">D) Ribosome</span>
        <span className="mockup-raw-line mockup-raw-gap mockup-raw-answer">Answer: C</span>
      </div>

      {/* Arrow connector */}
      <div className="mockup-arrow">
        <span className="mockup-arrow-label">extracted &amp; structured</span>
        <DownArrowIcon />
      </div>

      {/* Output: clean question card */}
      <p className="mockup-label">Your test</p>
      <div className="mockup-question-card">
        <span className="mockup-q-meta">Question 1 of 10</span>
        <p className="mockup-q-text">
          Which of the following is NOT found in animal cells?
        </p>
        <div className="mockup-options">
          {options.map((opt) => (
            <div
              key={opt.letter}
              className={`mockup-option${opt.selected ? ' mockup-option--selected' : ''}`}
            >
              <span className={`mockup-option__radio${opt.selected ? ' mockup-option__radio--checked' : ''}`}>
                {opt.selected && <span className="mockup-option__radio-dot" />}
              </span>
              <span className="mockup-option__text">
                <span className="mockup-option__letter">{opt.letter}</span>
                {opt.text}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

/* ─── 2. How It Works ─────────────────────────────────────────────────────── */

const STEPS = [
  {
    num: '01',
    icon: <PasteIcon />,
    title: 'Paste your questions',
    desc: 'Copy MCQs from ChatGPT, study notes, or any source. Paste the text directly, or share a ChatGPT conversation link.',
  },
  {
    num: '02',
    icon: <ReviewIcon />,
    title: 'Review what we found',
    desc: 'We identify every question, option, and answer. Edit, add, or remove anything before your test is created.',
  },
  {
    num: '03',
    icon: <AnalysisIcon />,
    title: 'Test yourself',
    desc: 'Answer in a clean, distraction-free interface. Submit to get a full score breakdown and question-level review.',
  },
];

function HowItWorksSection() {
  return (
    <section className="how-it-works" id="how-it-works">
      <div className="container">

        <div className="section-header">
          <p className="section-eyebrow">How it works</p>
          <h2 className="section-heading">Three steps from MCQs to insights.</h2>
        </div>

        <div className="steps-grid">
          {STEPS.map((step) => (
            <div key={step.num} className="step-card">
              <div className="step-card__icon">{step.icon}</div>
              <span className="step-card__num" aria-hidden="true">{step.num}</span>
              <h3 className="step-card__title">{step.title}</h3>
              <p className="step-card__desc">{step.desc}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

/* ─── 3. Why Different ────────────────────────────────────────────────────── */

const FEATURES = [
  {
    emoji: '📝',
    title: 'Your content. Your test.',
    body: 'Not a question bank to browse through. Bring the MCQs you already have — from ChatGPT, textbooks, or any notes — and we build the test from them.',
  },
  {
    emoji: '🎯',
    title: 'Nothing between you and the question.',
    body: 'A minimal test interface designed purely for focus. No sidebars, no pop-ups, no distractions. Just you and the question in front of you.',
  },
  {
    emoji: '🔍',
    title: 'Know exactly what to revisit.',
    body: 'After every attempt, see each question you got wrong, the correct answer, and any available explanation — all clearly laid out.',
  },
];

function WhyDifferentSection() {
  return (
    <section className="why-different">
      <div className="container">

        <div className="section-header">
          <p className="section-eyebrow">Built differently</p>
          <h2 className="section-heading">Designed around your study material.</h2>
        </div>

        <div className="features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-card">
              <span className="feature-card__emoji" aria-hidden="true">{f.emoji}</span>
              <h3 className="feature-card__title">{f.title}</h3>
              <p className="feature-card__body">{f.body}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

/* ─── 4. CTA Banner ───────────────────────────────────────────────────────── */

function CTABannerSection() {
  return (
    <section className="cta-banner">
      <div className="container container--sm cta-banner__inner">
        <h2 className="cta-banner__heading">
          Have MCQs somewhere?<br />Build your test.
        </h2>
        <p className="cta-banner__body">
          Paste your questions and generate a proper practice test in under a minute.
        </p>
        <Link to="/create" className="btn btn--primary btn--lg">
          Create Your Test
          <ArrowRightIcon />
        </Link>
      </div>
    </section>
  );
}

/* ─── Inline SVG Icons ────────────────────────────────────────────────────────
   No icon library dependency. Self-contained SVGs keep the bundle small
   and eliminate a third-party dependency for simple shapes.
────────────────────────────────────────────────────────────────────────────── */

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M3 5l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownArrowIcon() {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden="true">
      <path
        d="M8 2v14M2 11l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PasteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="3" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 8h6M7 11h6M7 14h3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 6h7M4 10h5M4 14h3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M12 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AnalysisIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3"   y="11" width="3" height="5" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="8.5" y="7"  width="3" height="9" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="14"  y="4"  width="3" height="12" rx="1" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}
