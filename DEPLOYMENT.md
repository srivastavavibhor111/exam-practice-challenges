# Deployment Guide — M18

A completely free, production deployment: **MongoDB Atlas** (database) +
**Render** (backend) + **Vercel** (frontend). Verified current as of
August 2026 — free-tier terms shift over time, so if something here looks
different when you actually deploy, check each platform's current pricing
page before assuming this guide is stale.

**Why these three specifically:**
- **MongoDB Atlas free cluster (M0)** — genuinely free forever, no card
  required, 512MB storage. No expiration.
- **Render** — the best no-card, free-forever option for a real persistent
  Express server as of this writing. Railway (a common alternative)
  removed its free tier and now only offers a one-time trial credit — not
  a sustainable free option anymore.
- **Vercel** — free forever for personal projects, and purpose-built for
  exactly this kind of Vite/React app.

**The one real tradeoff to accept:** Render's free tier spins your backend
down after 15 minutes of no traffic. The next request after that takes
30-60 seconds to "cold start." Step 5 below shows how to mostly work
around this for $0 using a free uptime monitor.

---

## Before you start

Make sure every fix in this milestone is already in your project:
- `backend/controllers/authController.js` — environment-aware cookies
- `backend/server.js` — trust proxy + health check
- `src/services/api.js` — configurable `VITE_API_URL`
- `vercel.json` at your frontend's root
- `public/_redirects` in your frontend (harmless if you don't end up using Netlify)

Without these, the deployed app will not work correctly — this isn't
optional cleanup, these are the specific things that break across domains.

---

## Step 1 — MongoDB Atlas (the database)

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
2. Create a new project (any name).
3. Click **"Create a deployment"** → choose **M0 (Free)** — do NOT pick M2/M5,
   those are paid "Flex" tiers now, not free. Pick any region close to you.
4. **Database user**: set a username and a strong password. Save these —
   you'll need them in the connection string. Do not reuse a password from
   anywhere else.
5. **Network access**: add IP address `0.0.0.0/0` ("allow access from
   anywhere"). This looks alarming, but it's the standard, practical
   approach for a free-tier deployment — your real security is the
   username/password on the connection string and the app's own auth
   layer (M11), not IP restriction. Render's free tier doesn't publish
   fixed outbound IPs you could whitelist instead.
6. Click **"Connect"** → **"Drivers"** → copy the connection string. It
   looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<username>`/`<password>` with your real values, and add your
   database name before the `?`:
   ```
   mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/exam-practice-challenges?retryWrites=true&w=majority
   ```
   Save this — it's your `MONGODB_URI`.

---

## Step 2 — Render (the backend)

1. Push your project to GitHub if it isn't already (Render deploys from a
   Git repo).
2. Go to https://render.com, sign up (no card required for the free tier).
3. **New +** → **Web Service** → connect your GitHub repo.
4. Configure:
   - **Root Directory**: `backend` (if your backend lives in a subfolder —
     adjust if your structure differs)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
     *(confirm your `backend/package.json` has `"start": "node server.js"`
     in its scripts — add it if it's missing)*
   - **Instance Type**: Free
5. **Environment Variables** (Render's dashboard → Environment tab) — add
   every one of these:

   | Key | Value |
   |---|---|
   | `MONGODB_URI` | your Atlas connection string from Step 1 |
   | `JWT_SECRET` | a long random string (generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`) |
   | `GEMINI_API_KEY` | your key from aistudio.google.com/app/apikey |
   | `AI_MODEL` | `gemini-2.5-flash` (or leave unset for the default) |
   | `NODE_ENV` | `production` |
   | `CLIENT_URL` | *(leave a placeholder for now — you'll set the real value in Step 4, after Vercel gives you a URL)* |

   Do NOT set `PORT` — Render sets this automatically, and your server.js
   already reads `process.env.PORT` correctly.

6. Click **Create Web Service**. Render will build and deploy — this takes
   a few minutes the first time. Once live, you'll get a URL like
   `https://your-app-name.onrender.com`. **Save this URL** — it's what
   Vercel needs next.

7. Quick sanity check: visit `https://your-app-name.onrender.com/health`
   in a browser. You should see `{"status":"ok","timestamp":"..."}`. If
   you get an error instead, check Render's build/deploy logs before
   moving on.

---

## Step 3 — Vercel (the frontend)

1. Go to https://vercel.com, sign up (no card required).
2. **Add New** → **Project** → import the same GitHub repo.
3. Configure:
   - **Root Directory**: your frontend folder (e.g. `frontend`, or leave
     as-is if your React app is at the repo root)
   - **Framework Preset**: Vite (Vercel usually detects this automatically)
   - **Build Command**: `npm run build` (default, usually fine as-is)
   - **Output Directory**: `dist` (Vite's default — usually fine as-is)
4. **Environment Variables** — add:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://your-app-name.onrender.com/api` (your Render URL from Step 2, with `/api` appended) |

5. Click **Deploy**. Once done, you'll get a URL like
   `https://your-app-name.vercel.app`. **Save this URL.**

---

## Step 4 — Connect them (the part that's easy to forget)

Go back to **Render** → your web service → **Environment** tab, and set
the `CLIENT_URL` variable you left as a placeholder to your real Vercel URL:

```
CLIENT_URL=https://your-app-name.vercel.app
```

Save — Render will automatically redeploy with the new value. This is
what CORS uses to decide which frontend origin is allowed to make
credentialed requests to your API; without the correct value here, every
request from your deployed frontend will be rejected by CORS.

---

## Step 5 — (Optional but recommended) Keep the backend warm

Render's free tier sleeps after 15 minutes idle. A free uptime monitor
pinging your `/health` endpoint every 5-10 minutes keeps it from ever
fully going cold during normal use, at zero cost:

1. Go to https://uptimerobot.com (free tier: 50 monitors, 5-minute
   intervals) or https://cron-job.org (also free).
2. Add a new HTTP(S) monitor pointing at
   `https://your-app-name.onrender.com/health`.
3. Set the interval to 5 minutes.

This isn't a perfect fix — genuinely zero traffic for a while will still
let it sleep occasionally — but it eliminates cold starts for anyone using
the app somewhat regularly.

---

## Step 6 — Verify the whole thing actually works

Visit your Vercel URL and walk through:

- [ ] Register a new account → should succeed and land you logged in
- [ ] Open DevTools → Application → Cookies → confirm a `token` cookie
      exists, scoped to your **Render** domain (not Vercel's) — this is
      correct and expected, since the backend sets it
- [ ] Refresh the page → should stay logged in (confirms `GET /auth/me`
      + the cross-origin cookie are both working)
- [ ] Create a test, extract questions, review, save, take it, submit,
      see your result — the full pipeline, for real, in production
- [ ] Log out → confirm you're actually logged out on refresh
- [ ] Open a new incognito window, visit a protected route directly
      (e.g. `/dashboard`) — should redirect to `/login`, not error out
- [ ] Refresh while sitting on `/dashboard` or `/test/<id>` directly —
      should NOT 404 (this confirms `vercel.json`'s rewrite rule is working)

If registration/login silently doesn't "stick" (no error, but you're
logged out on refresh), the most likely cause is the cookie fix in Step 0
not being applied correctly, or `CLIENT_URL`/`VITE_API_URL` pointing at
the wrong place — double check both env vars match the REAL deployed URLs
exactly, including `https://` and no trailing slash mismatches.

---

## A note on ongoing cost

Every part of this stack is free at this app's expected scale (personal
use, a small number of users). The one number worth keeping an eye on is
Gemini API usage (extraction, M16's AI features) — free-tier request
limits apply per Google's terms, which can change; check
https://ai.google.dev/pricing occasionally if you significantly grow usage.
