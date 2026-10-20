# Screenshots Guide

I can't run this app or capture real screenshots myself — this is a shot
list so the screenshots you take actually tell the product's story, rather
than being six random pages. Capture each of these **in light mode**, then
repeat the top 2-3 in dark mode for a "supports both themes" callout.

Save them into a `screenshots/` folder at your repo root, named to match
the README's placeholders (`01-landing.png`, etc.) — or update the README
paths if you name them differently.

---

## The six that matter most (README's grid)

**01 — Landing page hero**
Full hero section, visible without scrolling. This is the very first thing
anyone evaluating the project sees — make sure the headline and the
input→test visual mockup are both in frame.

**02 — Create Test, mid-interaction**
Not the empty state — paste a real, small example MCQ block into the
textarea first, so the screenshot shows actual content and the character
counter with a real number. If you can time it right, capture the
"Extracting questions…" loading state instead — it more clearly signals
"this is doing something," which is more interesting to a reviewer than
an empty form.

**03 — Review screen, with a flagged issue visible**
Deliberately leave one question incomplete (missing an option, or no
correct answer selected) before screenshotting, so the warning badge and
inline issue list are visible. This shows off the validation feature,
which a "clean" screenshot wouldn't demonstrate at all.

**04 — Taking a test, timer in the warning or critical state**
Let the countdown run down to under 5 minutes (or start a short custom
duration) before capturing — shows the color/label escalation, which is a
detail worth highlighting since it's more thoughtful than a plain timer.

**05 — Results page, full hero + a mix of correct/incorrect cards**
Take a test and deliberately get a few questions right and a few wrong,
so the donut chart shows multiple colors and the review section shows
both a correct-answer card and an incorrect-answer card in the same shot
if possible (scroll to a section showing at least one of each).

**06 — Dashboard, with real data**
Complete at least 2-3 tests first so the stat cards, trend sparkline, and
Weak Areas section all show real, non-empty data. An empty-state dashboard
screenshot undersells the feature.

**07 — Progress page, with real multi-week data**
Complete several tests spread across at least 2-3 different weeks
before capturing this one — an empty or single-data-point chart
undersells the feature badly. Show the Performance Trend line chart
with a visible upward or downward slope, and scroll to include at
least part of the Test-by-Test comparison bar chart in the same shot
if possible.

**08 — Profile page, in edit mode**
Capture the edit form with the Name field and the API key field's
"Show" toggle both visible — this communicates "you're in control of
your own account and your own AI key" at a glance, which is a
meaningful differentiator worth showing, not just telling.

**09 — My Tests page, with search in use**
Type a partial title into the search box before capturing, so the
filtered result list is visible — shows the search actually works,
rather than just looking like a static list.


---

## Bonus shots (optional, for a fuller case-study page or demo video)

- **Bookmarks or Mistakes page** — with at least 2-3 items, showing the
  "Practice These" / "Practice My Mistakes" button
- **AI Insights card, in its "ready" state** — after clicking "Get My
  Insights" — shows off a feature a static screenshot elsewhere wouldn't reveal
- **Dark mode versions** of shots 01, 05, and 06 — side-by-side with their
  light-mode counterparts is a compelling way to demonstrate full theme support
- **Mobile viewport** version of the Test-taking screen (narrow browser
  window or real phone) — demonstrates the responsive navigator-below-panel
  layout

## Technical tips
- Use your browser's device toolbar (or just resize the window) for a
  clean, consistent aspect ratio across all screenshots — 1280x800 or
  similar works well for a README grid.
- Hide bookmarks bars / browser chrome if capturing full-window shots —
  most browsers have a "capture screenshot" DevTools feature that captures
  just the page content, no browser UI at all.
- Use realistic-looking data (not "asdf test test 123") — it reads as more
  credible and lets a viewer actually understand what they're looking at.
