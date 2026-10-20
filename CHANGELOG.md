# Changelog

All notable changes to this project, organized by release. The original
20-milestone build (M1–M20) shipped as v1.0; everything below documents
what's been added since.

## [Unreleased] — Post-v1.0 Additions

### Added

**My Tests page** (`/tests`)
- A complete, searchable list of every test the user has created —
  distinct from the Dashboard's "Recent Tests" section, which
  deliberately caps at 6. Reuses existing `dashboardService` functions;
  no new backend endpoints were needed.

**User Profile & Account Management**
- A click-triggered dropdown menu (`UserMenu`) next to the user's name in
  the Navbar — opens only on click, closes on outside click or Escape.
- A new **About My Profile** page (`/profile`) showing account details.
- Inline profile editing: update name and/or password from the same
  form. Changing the password requires re-entering the current one, even
  though the session is already authenticated — closes a real gap where
  a hijacked or unattended session could otherwise let an attacker
  silently lock out the real account owner.
- Full account deletion, cascading through every collection tied to the
  user (Attempts, Questions, Tests, Sources) plus the User document
  itself, in one atomic transaction. Requires typing "DELETE" to confirm
  — a stronger safeguard than the standard single-item delete
  confirmation used elsewhere, since this action is irreversible and
  destroys everything, not one record.

**Per-User Gemini API Keys**
- Every new account now provides its own Gemini API key at registration
  (mandatory, validated). Stored encrypted (AES-256-GCM via Node's
  built-in `crypto` — no new dependency), never in plain text.
- Viewable and editable from the Profile page only, with a show/hide
  toggle.
- Every AI-calling code path (extraction, on-demand explanations, AI
  Insights) now resolves which key to use through one shared function —
  the user's own key first, falling back to the server's configured key
  only if the user's is missing or fails to decrypt. This fallback is
  what keeps every account created *before* this change working
  seamlessly, with no visible disruption.
- A new public onboarding page (`/get-gemini-api-key`) walks through
  getting a free key from Google AI Studio, linked from the registration
  form (opens in a new tab, so an in-progress signup isn't lost).

**Progress Analytics page** (`/progress`)
- A dedicated visual analytics page, independent of the existing AI
  Insights feature (Dashboard) — different endpoint, different data
  requirements, no shared minimum-attempts gate. AI Insights' own 3-test
  minimum is untouched.
- Day / Week / Month grouping, a calendar-based date range selector
  (native `<input type="date">` — no new date-picker dependency), and
  Previous/Next period navigation that can't navigate into a meaningless
  future period.
- Summary cards (Tests Taken, Average Performance, Best Performance,
  Performance Trend) and two charts: a performance-over-time line chart
  and a per-test comparison bar chart.
- Every value is computed server-side from real, already-stored attempt
  data — nothing on this page is AI-generated. Date bucketing is
  implemented with UTC-based boundaries specifically to avoid a subtle
  bug: local-timezone date math would make grouping depend on whichever
  timezone the Node server happens to run in, which can silently differ
  between local development and a deployed host.
- Introduces this project's first charting dependency, **Recharts** — no
  charting library existed before (Result's donut chart and Dashboard's
  trend sparkline are both hand-rolled SVG).

### Changed
- Registration now requires a Gemini API key in addition to name, email,
  and password.
- `authService.js`, `aiClient.js`, and every AI-calling service
  (`aiExtractionService`, `explanationService`, `insightsService`) were
  updated to thread a resolved API key through instead of always reading
  a single server-wide environment variable.

### Security
- Gemini API keys are encrypted at rest (AES-256-GCM), not stored in
  plain text.
- Password changes require current-password verification.
- Account deletion requires explicit typed confirmation before the
  action is even enabled.

---

## [1.0.0] — Original Milestone Build (M1–M20)

Initial release. Built incrementally across 20 planned milestones: static
foundation → AI-powered MCQ extraction → full authentication → test-taking
engine → results & analytics → bookmarks/mistakes practice tools → AI
enhancements → security hardening → deployment → final polish →
documentation. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the complete
technical breakdown of this release.
