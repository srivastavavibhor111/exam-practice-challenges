import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/authService';

/**
 * AuthContext — UPDATED
 * ─────────────────────────────────────────────────────────────────────────────
 * login()/register() now accept and forward a recaptchaToken. Three new
 * methods handle the Google flows:
 *
 *   googleLogin — always results in a real session (the backend only
 *   ever returns success here for an already-linked account) — sets
 *   `user` directly.
 *
 *   googleRegister — can result in EITHER an immediate login (an
 *   already-linked Google account) OR a "needs_gemini_key" response (a
 *   brand-new Google identity, no account created yet). This function
 *   does NOT set `user` in the second case — there's no session to
 *   reflect yet. The calling component (Register.jsx) inspects the
 *   returned `status` and decides where to navigate.
 *
 *   completeGoogleRegistration — the final step; always results in a
 *   real session on success, sets `user` directly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { user } = await authService.getMe();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  async function login(email, password, recaptchaToken) {
    const { user } = await authService.login(email, password, recaptchaToken);
    setUser(user);
    return user;
  }

  async function register(name, email, password, geminiApiKey, recaptchaToken) {
    const { user } = await authService.register(name, email, password, geminiApiKey, recaptchaToken);
    setUser(user);
    return user;
  }

  async function logout() {
    await authService.logout();
    setUser(null);
  }

  async function updateProfile(name) {
    const { user } = await authService.updateProfile(name);
    setUser(user);
    return user;
  }

  async function changePassword(currentPassword, newPassword) {
    return authService.changePassword(currentPassword, newPassword);
  }

  async function updateGeminiApiKey(geminiApiKey) {
    return authService.updateGeminiApiKey(geminiApiKey);
  }

  async function deleteAccount() {
    await authService.deleteAccount();
    setUser(null);
  }

  // NEW — Google authentication

  async function googleLogin(credential) {
    const { user } = await authService.googleLogin(credential);
    setUser(user);
    return user;
  }

  async function googleRegister(credential) {
    const result = await authService.googleRegister(credential);
    if (result.status === 'logged_in') {
      setUser(result.user);
    }
    return result; // { status: 'logged_in', user } OR { status: 'needs_gemini_key', name, email }
  }

  async function completeGoogleRegistration(geminiApiKey) {
    const { user } = await authService.completeGoogleRegistration(geminiApiKey);
    setUser(user);
    return user;
  }

  return (
    <AuthContext.Provider value={{
      user, isLoading, login, register, logout,
      updateProfile, changePassword, deleteAccount,
      updateGeminiApiKey,
      googleLogin, googleRegister, completeGoogleRegistration,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
