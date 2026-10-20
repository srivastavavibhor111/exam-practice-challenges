/**
 * recaptchaService.js — NEW
 * ─────────────────────────────────────────────────────────────────────────────
 * Verifies a reCAPTCHA v2 token server-side against Google's siteverify
 * endpoint. No new dependency — uses the built-in fetch, same as
 * aiClient.js already does for the Gemini API.
 *
 * Per the spec: never rely on frontend-only reCAPTCHA validation — a
 * browser can always be scripted to skip client-side checks. This is the
 * ONLY verification that actually counts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

async function verifyRecaptcha(token) {
  if (!token) return false;

  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    // Fail closed, loudly — a missing secret is a config mistake, not a
    // reason to silently let every request through unverified.
    console.error('RECAPTCHA_SECRET_KEY is not set — rejecting all reCAPTCHA verifications.');
    return false;
  }

  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }).toString(),
    });
    const data = await response.json();
    return data.success === true;
  } catch (err) {
    console.error('reCAPTCHA verification request failed:', err);
    return false;
  }
}

module.exports = { verifyRecaptcha };
