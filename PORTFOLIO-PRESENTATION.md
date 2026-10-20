# Portfolio Presentation Guide

How to talk about this project — an elevator pitch, resume-ready bullet
points, and the specific technical decisions worth highlighting to a
reviewer who wants to see real engineering judgment, not just a features list.

## Elevator Pitch (for a portfolio site intro or verbal pitch)

> Exam Practice Challenges is a full-stack app that turns MCQs you already
> have — pasted text, a ChatGPT conversation, study notes — into real,
> gradable practice tests. I built it incrementally across 20 milestones,
> from a static landing page through AI-powered extraction, full
> authentication, deployment, and a personalized practice system. The
> parts I'm most proud of aren't the features themselves but the
> decisions underneath them: the score you see is never trusted from the
> browser, correct answers are never exposed while a test is in progress,
> and every AI call is explicit and cost-bounded rather than automatic.

## One-liner (for a project card / grid on a portfolio homepage)

> AI-powered MCQ practice test generator — React, Node/Express, MongoDB,
> Google Gemini. Full auth, deployed, free-tier hosting.

## Resume Bullet Points

Pick 2-3 that fit the role you're applying for — don't use all of these,
it'll read as padded:

- Built a full-stack MERN application (React, Node/Express, MongoDB) from
  scratch across 20 planned milestones, including authentication, AI
  integration, and production deployment
- Designed a deterministic, server-authoritative scoring system that never
  trusts client-submitted results — the client's score is always
  independently recomputed and stored server-side
- Implemented JWT-based authentication using httpOnly cookies (not
  localStorage), with environment-aware cross-origin cookie handling for
  production deployment across separate frontend/backend domains
- Integrated Google Gemini for AI-powered content extraction and
  on-demand explanations, with strict architectural boundaries preventing
  AI from ever performing a calculation the application could do
  deterministically
- Deployed to a genuinely free hosting stack (Vercel, Render, MongoDB
  Atlas), including solving real cross-origin cookie and CORS
  configuration issues specific to a split frontend/backend deployment
- Added rate limiting, NoSQL injection sanitization, and security headers
  to harden the API against common attack vectors
- Wrote automated tests (Node's built-in test runner) covering the
  application's most critical deterministic logic — scoring and validation
- Implemented per-user API key management with AES-256-GCM encryption at
  rest, including a resolution layer that transparently falls back to a
  server default — keeping pre-existing accounts working without
  disruption when the feature was introduced
- Built a visual analytics dashboard with day/week/month data grouping and
  calendar-based date range filtering, using UTC-based date boundaries to
  keep grouping correct and consistent regardless of server deployment
  timezone
- Designed a cascading account-deletion flow with a typed confirmation
  safeguard, removing a user's data across five linked collections in a
  single atomic database transaction


## Technical Highlights Worth a Case-Study Callout

If you're writing a longer case-study page (common for portfolio sites),
these are the specific decisions worth a dedicated paragraph each — they
demonstrate judgment, not just "I used X library":

1. **The answer-stripping fix.** The obvious way to let someone take a
   test is to fetch the Test document and show its questions — but that
   document includes the correct answers. Fixed with a dedicated
   answer-stripped endpoint used only during an active attempt; the full
   data is only ever returned after submission. A good example of finding
   a security gap before it became a bug someone reported.

2. **Why scoring is computed twice.** The frontend computes a score
   immediately for instant user feedback; the backend independently
   recomputes the authoritative version from the real stored correct
   answers when an attempt is submitted, and that's the only version ever
   persisted. Demonstrates understanding that client-side state can never
   be trusted for anything that matters.

3. **The cross-origin cookie bug, caught before deployment.** `SameSite=Lax`
   cookies work fine in local development (frontend and backend share an
   origin via a dev proxy) but silently fail once frontend and backend are
   deployed to separate domains — login would appear to succeed with zero
   errors, then fail on the very next request with no clue why. Caught and
   fixed as part of planning the deployment milestone, not discovered
   after a broken production deploy.

4. **AI given a narrow, enforced boundary.** Every AI-touching feature
   follows one explicit rule: AI can write prose about facts, never
   calculate the facts themselves. The "AI Insights" feature is handed a
   finished set of already-computed statistics and explicitly instructed
   never to invent an additional one.

 5. **Per-user API keys, encrypted, with a safety-net fallback.** Rather
    than store a sensitive credential in plain text, API keys are
    encrypted with AES-256-GCM before hitting the database — a full
    database dump wouldn't expose usable keys without also having the
    separate server-side encryption secret. The resolution logic (a
    user's own key, falling back to a server default) meant existing
    accounts kept working the moment this feature shipped, with zero
    migration downtime.

6. **A timezone bug caught before it existed.** Grouping test attempts
    by "day," "week," or "month" sounds simple until you consider that
    JavaScript's local-timezone Date methods depend on whatever timezone
    the server process happens to be running in — which can silently
    differ between a local dev machine and a deployed host, shifting
    which calendar day a test lands in. Every date boundary in the
    analytics feature uses UTC explicitly, making results deterministic
    regardless of where the server actually runs.

## Suggested Portfolio Page Structure

1. Hero: project name, one-liner, live demo link, screenshot
2. The problem / pitch (2-3 sentences — why this app exists)
3. Screenshot gallery (see SCREENSHOTS-GUIDE.md)
4. Tech stack badges/icons
5. "Technical Highlights" section (pick 2-3 from above)
6. Architecture diagram (the System Overview Mermaid diagram from
   ARCHITECTURE.md renders cleanly as an image if you export it)
7. Link to GitHub repo + live demo
