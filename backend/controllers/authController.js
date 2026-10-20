const authService = require('../services/authService');

/**
 * authController.js — HARDENED
 * REMOVED: getGeminiApiKey handler — there's no longer a route that
 * decrypts and returns a stored key to the browser.
 */

const COOKIE_NAME = 'token';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
  };
}

function clearCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  };
}

async function register(req, res) {
  const { name, email, password, geminiApiKey } = req.body;
  const { user, token } = await authService.register({ name, email, password, geminiApiKey });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.status(201).json({ user });
}

async function login(req, res) {
  const { email, password } = req.body;
  const { user, token } = await authService.login({ email, password });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({ user });
}

async function logout(req, res) {
  res.clearCookie(COOKIE_NAME, clearCookieOptions());
  res.status(204).send();
}

async function me(req, res) {
  res.json({ user: req.user });
}

async function updateProfile(req, res) {
  const { name } = req.body;
  const user = await authService.updateProfile(req.user.id, { name });
  res.json({ user });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, { currentPassword, newPassword });
  res.json({ message: 'Password updated successfully.' });
}

// updateGeminiApiKey — WRITE-ONLY. Never returns any key value.
async function updateGeminiApiKey(req, res) {
  const { geminiApiKey } = req.body;
  await authService.updateGeminiApiKey(req.user.id, geminiApiKey);
  res.json({ message: 'Gemini API key updated successfully.' });
}

async function deleteAccount(req, res) {
  await authService.deleteAccount(req.user.id);
  res.clearCookie(COOKIE_NAME, clearCookieOptions());
  res.status(204).send();
}

module.exports = {
  register, login, logout, me,
  updateProfile, changePassword,
  updateGeminiApiKey,
  deleteAccount,
};
