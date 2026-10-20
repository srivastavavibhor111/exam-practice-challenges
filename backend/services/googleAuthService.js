const { OAuth2Client } = require('google-auth-library');

/**
 * googleAuthService.js — NEW
 * ─────────────────────────────────────────────────────────────────────────────
 * The ONLY place Google ID tokens get verified. Per the spec's explicit
 * requirement: never trust identity data sent directly by the frontend —
 * the frontend only ever forwards the opaque `credential` string Google
 * itself issued; every actual claim (email, name, googleId) comes from
 * this verification, not from anything the browser asserts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleToken(idToken) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is not set. Add it to your .env file.');
  }
  if (!idToken) {
    throw new Error('No Google credential was provided.');
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email_verified) {
    // Never authenticate against an unverified email — this is exactly
    // the kind of check that matters even though it's easy to skip.
    throw new Error('Your Google account email is not verified.');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase().trim(),
    name: payload.name || payload.email.split('@')[0],
  };
}

module.exports = { verifyGoogleToken };
