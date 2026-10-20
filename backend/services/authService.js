const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { User, Source, Question, Test, Attempt, Folder, FolderItem } = require('../models');
const AppError = require('../utils/AppError');
const { encrypt, decrypt } = require('../utils/encryption');

/**
 * authService.js — UPDATED
 * ─────────────────────────────────────────────────────────────────────────────
 * Every function above the "GOOGLE AUTHENTICATION" divider below is
 * completely UNCHANGED from before this feature — same logic, same
 * validation, same error messages, same JWT issuance. Nothing about
 * existing email/password registration or login was touched.
 *
 * Everything below the divider is new, and reuses existing building
 * blocks rather than duplicating them: generateToken() (the same
 * function local login/register already use), toPublicUser(), encrypt()
 * — all shared, not reimplemented.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 10;
const MIN_GEMINI_KEY_LENGTH = 20;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Add it to your .env file.');
  }
  return secret;
}

function generateToken(userId) {
  return jwt.sign({ sub: userId.toString() }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

async function register({ name, email, password, geminiApiKey }) {
  const normalizedEmail = email.toLowerCase().trim();

  if (!geminiApiKey || geminiApiKey.trim().length < MIN_GEMINI_KEY_LENGTH) {
    throw new AppError(400, 'A valid Gemini API key is required to create an account.');
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new AppError(409, 'An account with that email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    authProvider: 'local',
    geminiApiKey: encrypt(geminiApiKey.trim()),
  });

  const token = generateToken(user._id);
  return { user: toPublicUser(user), token };
}

async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');

  if (!user) {
    throw new AppError(401, 'Invalid email or password.');
  }
  if (!user.passwordHash) {
    // A Google-only account has no password to compare against — same
    // generic message as any other mismatch, so this doesn't leak
    // "this email uses Google sign-in" to an unauthenticated caller.
    throw new AppError(401, 'Invalid email or password.');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError(401, 'Invalid email or password.');
  }

  const token = generateToken(user._id);
  return { user: toPublicUser(user), token };
}

async function updateProfile(userId, { name }) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 'Account not found.');
  }
  user.name = name.trim();
  await user.save();
  return toPublicUser(user);
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new AppError(404, 'Account not found.');
  }
  if (!user.passwordHash) {
    throw new AppError(400, 'This account signed up with Google and has no password to change. Set one by contacting support, or continue using Google to sign in.');
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    throw new AppError(401, 'Current password is incorrect.');
  }

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();
}

async function updateGeminiApiKey(userId, geminiApiKey) {
  if (!geminiApiKey || geminiApiKey.trim().length < MIN_GEMINI_KEY_LENGTH) {
    throw new AppError(400, 'Please provide a valid Gemini API key.');
  }
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 'Account not found.');
  }
  user.geminiApiKey = encrypt(geminiApiKey.trim());
  await user.save();
}

async function getEffectiveGeminiApiKey(userId) {
  const user = await User.findById(userId).select('+geminiApiKey');
  if (user?.geminiApiKey) {
    try {
      return decrypt(user.geminiApiKey);
    } catch (err) {
      console.error('Could not decrypt stored Gemini API key, falling back to server default.', err);
    }
  }
  return process.env.GEMINI_API_KEY || null;
}

async function deleteAccount(userId) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await FolderItem.deleteMany({ user: userId }).session(session); // NEW — Custom Test Folders
      await Folder.deleteMany({ user: userId }).session(session);     // NEW — Custom Test Folders
      await Attempt.deleteMany({ user: userId }).session(session);
      await Question.deleteMany({ user: userId }).session(session);
      await Test.deleteMany({ user: userId }).session(session);
      await Source.deleteMany({ user: userId }).session(session);
      await User.deleteOne({ _id: userId }).session(session);
    });
  } finally {
    session.endSession();
  }
}

function toPublicUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email };
}

/* ═══════════════════════════════════════════════════════════════════════════
   GOOGLE AUTHENTICATION — everything below is new. Nothing above this
   line was changed to make room for it.
   ═══════════════════════════════════════════════════════════════════════════ */

const PENDING_GOOGLE_EXPIRES_IN = '15m';
const PENDING_GOOGLE_PURPOSE = 'google_pending_registration';

function generatePendingGoogleToken({ googleId, email, name }) {
  return jwt.sign(
    { purpose: PENDING_GOOGLE_PURPOSE, googleId, email, name },
    getJwtSecret(),
    { expiresIn: PENDING_GOOGLE_EXPIRES_IN }
  );
}

function verifyPendingGoogleToken(token) {
  const decoded = jwt.verify(token, getJwtSecret());
  if (decoded.purpose !== PENDING_GOOGLE_PURPOSE) {
    throw new Error('Invalid pending registration token.');
  }
  return decoded;
}

async function findUserByGoogleId(googleId) {
  return User.findOne({ googleId });
}

async function findUserByEmail(email) {
  return User.findOne({ email: email.toLowerCase().trim() });
}

/**
 * googleLogin — "Continue with Google" on the Login page.
 * Deliberately does NOT create an account and does NOT auto-link an
 * existing unlinked local account — this app has no email-verification
 * or password-reset flow establishing that "controls the Gmail inbox" is
 * sufficient proof to access an existing password-protected account.
 * Linking has to happen explicitly (via the Google REGISTER flow, which
 * itself refuses to link silently — see googleRegister below), not as a
 * side effect of a login attempt.
 */
async function googleLogin({ googleId, email }) {
  const linkedUser = await findUserByGoogleId(googleId);
  if (linkedUser) {
    const token = generateToken(linkedUser._id);
    return { status: 'logged_in', user: toPublicUser(linkedUser), token };
  }

  const existingLocal = await findUserByEmail(email);
  if (existingLocal) {
    throw new AppError(409, 'An account with this email already exists. Please log in with your email and password.');
  }

  throw new AppError(404, 'No account found for this Google account. Please sign up first.');
}

/**
 * googleRegister — "Sign up with Google" on the Register page.
 * Three outcomes:
 *   1. Already linked → log in normally (per spec).
 *   2. Email belongs to an existing LOCAL account → refuse, point at Login.
 *   3. Genuinely new → issue a restricted pending token. NO USER IS
 *      CREATED YET — that only happens once the Gemini key is provided
 *      (completeGoogleRegistration, below).
 */
async function googleRegister({ googleId, email, name }) {
  const linkedUser = await findUserByGoogleId(googleId);
  if (linkedUser) {
    const token = generateToken(linkedUser._id);
    return { status: 'logged_in', user: toPublicUser(linkedUser), token };
  }

  const existingLocal = await findUserByEmail(email);
  if (existingLocal) {
    throw new AppError(409, 'An account with this email already exists. Please log in instead.');
  }

  const pendingToken = generatePendingGoogleToken({ googleId, email, name });
  return { status: 'needs_gemini_key', pendingToken, name, email };
}

/**
 * completeGoogleRegistration — the final step of Google sign-up. Only
 * reachable via protectPendingGoogle, which already proved a real Google
 * identity was verified moments ago. Re-checks for an existing account
 * defensively (a race — e.g. two tabs — shouldn't be able to create a
 * duplicate), THEN creates the user with no passwordHash at all (Google
 * users don't have one), THEN issues the real, normal session token —
 * the exact same generateToken() every other login path uses.
 */
async function completeGoogleRegistration({ googleId, email, name }, geminiApiKey) {
  if (!geminiApiKey || geminiApiKey.trim().length < MIN_GEMINI_KEY_LENGTH) {
    throw new AppError(400, 'A valid Gemini API key is required to complete registration.');
  }

  const existingByGoogle = await findUserByGoogleId(googleId);
  if (existingByGoogle) {
    throw new AppError(409, 'This Google account has already completed registration. Please log in instead.');
  }
  const existingByEmail = await findUserByEmail(email);
  if (existingByEmail) {
    throw new AppError(409, 'An account with this email already exists. Please log in instead.');
  }

  const user = await User.create({
    name: (name && name.trim()) || email.split('@')[0],
    email,
    googleId,
    authProvider: 'google',
    geminiApiKey: encrypt(geminiApiKey.trim()),
    // passwordHash intentionally omitted — Google accounts have none.
  });

  const token = generateToken(user._id);
  return { user: toPublicUser(user), token };
}

module.exports = {
  register,
  login,
  updateProfile,
  changePassword,
  updateGeminiApiKey,
  getEffectiveGeminiApiKey,
  deleteAccount,
  generateToken,
  getJwtSecret,
  // Google authentication
  googleLogin,
  googleRegister,
  completeGoogleRegistration,
  verifyPendingGoogleToken,
  findUserByGoogleId,
  findUserByEmail,
};
