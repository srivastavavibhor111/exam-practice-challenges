import { apiRequest } from './api';

/**
 * authService.js (frontend) — UPDATED
 * ─────────────────────────────────────────────────────────────────────────────
 * login() and register() now take a recaptchaToken param, sent alongside
 * everything they already sent — same endpoints, same other fields.
 * Three new functions wrap the Google auth endpoints.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function register(name, email, password, geminiApiKey, recaptchaToken) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: { name, email, password, geminiApiKey, recaptchaToken },
  });
}

export function login(email, password, recaptchaToken) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password, recaptchaToken },
  });
}

export function logout() {
  return apiRequest('/auth/logout', { method: 'POST' });
}

export function getMe() {
  return apiRequest('/auth/me');
}

export function updateProfile(name) {
  return apiRequest('/auth/profile', { method: 'PUT', body: { name } });
}

export function changePassword(currentPassword, newPassword) {
  return apiRequest('/auth/password', { method: 'PUT', body: { currentPassword, newPassword } });
}

export function updateGeminiApiKey(geminiApiKey) {
  return apiRequest('/auth/gemini-key', { method: 'PUT', body: { geminiApiKey } });
}

export function deleteAccount() {
  return apiRequest('/auth/account', { method: 'DELETE' });
}

// NEW — Google authentication

export function googleLogin(credential) {
  return apiRequest('/auth/google/login', { method: 'POST', body: { credential } });
}

export function googleRegister(credential) {
  return apiRequest('/auth/google/register', { method: 'POST', body: { credential } });
}

export function completeGoogleRegistration(geminiApiKey) {
  return apiRequest('/auth/google/complete-registration', { method: 'POST', body: { geminiApiKey } });
}
