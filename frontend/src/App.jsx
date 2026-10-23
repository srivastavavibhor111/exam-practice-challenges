import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import PageLoadingFallback from './components/PageLoadingFallback/PageLoadingFallback';
import Navbar      from './components/Navbar/Navbar';
import Footer      from './components/Footer/Footer';
import BackToTop from "./components/BackToTop/BackToTop";

/* ─── App ─────────────────────────────────────────────────────────────────────
   UPDATED FOR M19 — route-based code splitting via React.lazy().

   Before this, every one of these eleven pages' JavaScript shipped in a
   single bundle on first load — someone visiting only the login page
   still downloaded the Test-taking engine, the Dashboard's charting code,
   the Review screen, all of it. Each import() below becomes its own
   separate chunk, fetched only the moment the user actually navigates to
   that route. Suspense's fallback covers the brief gap while a chunk
   downloads — see PageLoadingFallback.jsx.

   ProtectedRoute itself stays a normal (non-lazy) import — it's tiny and
   used on nearly every route, so splitting it out would just add an
   extra network request for no real benefit.

   Nothing about routing, auth, or theme behavior changed — only how and
   when each page's code is fetched.

   UPDATED — one new protected route: /create/scoring, the new "Set
   Scoring Rules" step. Flow is now:

     Create Test → Review → Scoring Rules → (persist) → Test setup (timer)
       → Take Test → Result

   Persistence (POST /api/sources, /api/questions/bulk, /api/tests) moved
   from Review's "Create Test" button to Scoring Rules' "Continue" button
   — see Review.jsx and ScoringRules.jsx's own patch/file comments.
────────────────────────────────────────────────────────────────────────────── */

/* ─── App ─────────────────────────────────────────────────────────────────────
   UPDATED — wraps everything in <GoogleOAuthProvider>, required by
   @react-oauth/google for GoogleAuthButton to work anywhere in the tree.
   Placed as the outermost provider since it has no dependency on auth or
   theme state itself.

   One new PUBLIC route: /auth/setup-gemini-key — NOT wrapped in
   ProtectedRoute (see GeminiKeySetup.jsx's own comment for why that's
   correct, not an oversight).
────────────────────────────────────────────────────────────────────────────── */

/* ─── App ─────────────────────────────────────────────────────────────────────
   UPDATED — three new protected routes for the Shared Tests feature:
     /shared-tests                        — the main hub page (6 sections)
     /shared-tests/take/:sharedTestId      — reuses Test.jsx's sub-components
     /shared-tests/result/:attemptId       — reuses Result.jsx's sub-components

   isTestRoute's chrome-hiding check is extended to also match
   /shared-tests/take, matching the same distraction-free treatment the
   personal /test/:testId route already gets.
────────────────────────────────────────────────────────────────────────────── */

const Home       = lazy(() => import('./pages/Home/Home'));
const Login      = lazy(() => import('./pages/Login/Login'));
const Register   = lazy(() => import('./pages/Register/Register'));

// gemini patch 4
const GetGeminiApiKeyGuide  = lazy(() => import('./pages/GetGeminiApiKeyGuide/GetGeminiApiKeyGuide'));
const GeminiKeySetup  = lazy(() => import('./pages/GeminiKeySetup/GeminiKeySetup'));

const Dashboard  = lazy(() => import('./pages/Dashboard/Dashboard'));
const MyTests    = lazy(() => import('./pages/MyTests/MyTests'));
const Profile    = lazy(() => import('./pages/Profile/Profile'));
const Progress   = lazy(() => import('./pages/Progress/Progress'));
const Bookmarks  = lazy(() => import('./pages/Bookmarks/Bookmarks'));
const Mistakes   = lazy(() => import('./pages/Mistakes/Mistakes'));
const CreateTest = lazy(() => import('./pages/CreateTest/CreateTest'));
const Review     = lazy(() => import('./pages/Review/Review'));
const ScoringRules    = lazy(() => import('./pages/ScoringRules/ScoringRules'));
const Test       = lazy(() => import('./pages/Test/Test'));
const Result     = lazy(() => import('./pages/Result/Result'));
const SharedTests        = lazy(() => import('./pages/SharedTests/SharedTests'));
const SharedTestDetails  = lazy(() => import('./pages/SharedTestDetails/SharedTestDetails'));
const SharedTestTaking   = lazy(() => import('./pages/SharedTestTaking/SharedTestTaking'));
const SharedTestResult   = lazy(() => import('./pages/SharedTestResult/SharedTestResult'));
const NotFound   = lazy(() => import('./pages/NotFound/NotFound'));


function AppContent() {
  const location = useLocation();

  const isTestRoute =
    location.pathname.startsWith('/test/') ||
    location.pathname.startsWith?.('/shared-tests/take/');

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {!isTestRoute && <Navbar />}

      <div id="main-content">
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route path="/"         element={<Home />} />
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/get-gemini-api-key"    element={<GetGeminiApiKeyGuide />} />
            <Route path="/auth/setup-gemini-key"    element={<GeminiKeySetup />} />

            <Route path="/dashboard" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path="/my-tests" element={
              <ProtectedRoute><MyTests /></ProtectedRoute>
            } />
            <Route path="/progress" element={
              <ProtectedRoute><Progress /></ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute><Profile /></ProtectedRoute>
            } />
            <Route path="/bookmarks" element={
              <ProtectedRoute><Bookmarks /></ProtectedRoute>
            } />
            <Route path="/mistakes" element={
              <ProtectedRoute><Mistakes /></ProtectedRoute>
            } />
            <Route path="/create" element={
              <ProtectedRoute><CreateTest /></ProtectedRoute>
            } />
            <Route path="/review" element={
              <ProtectedRoute><Review /></ProtectedRoute>
            } />
            <Route path="/create/scoring" element={
              <ProtectedRoute><ScoringRules /></ProtectedRoute>
            } />
            <Route path="/test/:testId" element={
              <ProtectedRoute><Test /></ProtectedRoute>
            } />
            <Route path="/result/:attemptId" element={
              <ProtectedRoute><Result /></ProtectedRoute>
            } />
            <Route path="/result" element={
              <ProtectedRoute><Result /></ProtectedRoute>
            } />

            {/* ── Shared Tests — new, separate ecosystem ── */}
            <Route path="/shared-tests" element={
              <ProtectedRoute><SharedTests /></ProtectedRoute>
            } />
            <Route path="/shared-tests/details/:sharedTestId" element={
              <ProtectedRoute><SharedTestDetails /></ProtectedRoute>
            } />
            <Route path="/shared-tests/take/:sharedTestId" element={
              <ProtectedRoute><SharedTestTaking /></ProtectedRoute>
            } />
            <Route path="/shared-tests/result/:attemptId" element={
              <ProtectedRoute><SharedTestResult /></ProtectedRoute>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        {/*  inside your JSX, near the closing </div> of the layout: */}
        <BackToTop />
      </div>

      {!isTestRoute && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <AppContent />
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}
