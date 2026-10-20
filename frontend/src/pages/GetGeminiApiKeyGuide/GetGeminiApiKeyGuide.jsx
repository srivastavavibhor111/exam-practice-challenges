import { Link } from 'react-router-dom';
import ScreenshotPlaceholder from '../../components/ScreenshotPlaceholder/ScreenshotPlaceholder';
import './GetGeminiApiKeyGuide.css';
import img1 from './1.png';
import img2 from './2.png';
import img3 from './3.png';
import img4 from './4.png';
import img5 from './5.png';

/* ─── GetGeminiApiKeyGuide — NEW ──────────────────────────────────────────────
   A PUBLIC page (no login required — someone filling out the registration
   form isn't authenticated yet). Linked from Register.jsx, opened in a
   new tab so the person doesn't lose their in-progress form.

   Every step below has a <ScreenshotPlaceholder> — see that component's
   own file header for exactly how to swap each one for a real screenshot
   once you have it.

   Steps are accurate as of when this was written, but Google's own UI
   can change over time — if anything here looks different from what you
   see on the actual site, trust the live page at ai.google.dev over this
   guide, and consider updating the text/screenshots here to match.
────────────────────────────────────────────────────────────────────────────── */

const STEPS = [
  {
    number: 1,
    title: 'Go to Google AI Studio',
    body: (
      <>
        Visit{' '}
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
          aistudio.google.com/app/apikey
        </a>{' '}
        in a new tab. This is Google's official site for managing Gemini
        API keys — free to use, no credit card required for the free tier.
      </>
    ),
    caption: 'The Google AI Studio API keys page before signing in',
    image: img1,
  },
  {
    number: 2,
    title: 'Sign in with your Google account',
    body: 'Use any Google account (a personal Gmail account works fine — you don\u2019t need a separate Google Cloud account set up in advance).',
    caption: 'The Google sign-in prompt',
    image: img2,
  },
  {
    number: 3,
    title: 'Click "Create API key"',
    body: 'You\u2019ll see a button to create a new key, usually near the top of the page.',
    caption: 'The "Create API key" button on the AI Studio dashboard',
    image: img3,
  },
  {
    number: 4,
    title: 'Choose a project',
    body: 'You can create the key in a new project (the simplest option if this is your first time) or select an existing Google Cloud project if you already have one.',
    caption: 'The project selection dialog when creating a new key',
    image: img4,
  },
  {
    number: 5,
    title: 'Copy your API key',
    body: (
      <>
        Your key will be generated and shown on screen — it\u2019s a long
        string starting with something like <code>AIza...</code>. Click
        the copy icon next to it.
        <br /><br />
        <strong>Keep this private</strong> — treat it like a password. Don't
        share it publicly, post it anywhere, or commit it to a public
        GitHub repository.
      </>
    ),
    caption: 'The generated API key, ready to copy',
    image: img5,
  },
  {
    number: 6,
    title: 'Paste it into your registration form',
    body: 'Head back to the registration tab and paste the key into the Gemini API Key field.',
    caption: null, // no screenshot needed for this step — it's this app, not AI Studio
    image: null,
  },
];

export default function GetGeminiApiKeyGuide() {
  return (
    <main className="page-wrapper">
      <div className="apikey-guide">

        <header className="apikey-guide__header">
          <h1 className="apikey-guide__title">How to Get a Gemini API Key</h1>
          <p className="apikey-guide__subtitle">
            Free, takes about a minute, no credit card required. Follow these
            steps, then come back to finish creating your account.
          </p>
        </header>

        <ol className="apikey-guide__steps">
          {STEPS.map(step => (
            <li key={step.number} className="apikey-guide__step">
              <div className="apikey-guide__step-header">
                <span className="apikey-guide__step-num">{step.number}</span>
                <h2 className="apikey-guide__step-title">{step.title}</h2>
              </div>
              <p className="apikey-guide__step-body">{step.body}</p>
              {step.caption && (
                step.image ? (
                  <img
                    src={step.image}
                    alt={step.caption}
                    className="apikey-guide__screenshot"
                  />
                ) :(
                  <ScreenshotPlaceholder caption={step.caption} />
                )
              )}
            </li>
          ))}
        </ol>

        <div className="apikey-guide__note">
          <InfoIcon />
          <p>
            Google's free tier has generous usage limits for personal use.
            If anything on this page looks different from what you actually
            see on Google's site, their live page is always the source of
            truth — this guide may be slightly out of date.
          </p>
        </div>

        <div className="apikey-guide__actions">
          <Link to="/register" className="btn btn--primary btn--lg">
            Back to Registration
          </Link>
        </div>

      </div>
    </main>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 6v.5M9 8v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
