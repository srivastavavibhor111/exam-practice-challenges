import './ScreenshotPlaceholder.css';

/* ─── ScreenshotPlaceholder — NEW ─────────────────────────────────────────────
   A dashed-border placeholder box standing in for a real screenshot.
   Used throughout GetGeminiApiKeyGuide.jsx. Replace with a real <img>
   tag once you have the actual screenshot:

     BEFORE:
       <ScreenshotPlaceholder caption="The AI Studio homepage after signing in" />

     AFTER:
       <img
         src="/screenshots/api-key-guide/01-homepage.png"
         alt="The AI Studio homepage after signing in"
         className="guide-screenshot"
       />

   (className="guide-screenshot" is already styled in
   GetGeminiApiKeyGuide.css — reuse it so real screenshots match this
   placeholder's sizing/border-radius/spacing exactly.)
────────────────────────────────────────────────────────────────────────────── */

export default function ScreenshotPlaceholder({ caption }) {
  return (
    <div className="screenshot-placeholder" role="img" aria-label={caption}>
      <CameraIcon />
      <p className="screenshot-placeholder__caption">{caption}</p>
      <p className="screenshot-placeholder__hint">Screenshot goes here</p>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="4" y="9" width="24" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 9l1.6-3h6.8L21 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="17.5" r="5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
