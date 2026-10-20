const { User } = require('../models');
const AppError = require('../utils/AppError');

/**
 * userService.js — TEMPORARY, Pre-Auth Placeholder
 * ─────────────────────────────────────────────────────────────────────────────
 * This is NOT the authentication system. M11 replaces this entirely with
 * registration, login, password hashing, and session/JWT handling.
 *
 * Every other resource in this API (Source, Question, Test, Attempt)
 * requires a valid `user` ObjectId. Without this, there'd be no way to
 * create or test any of the rest of the API before M11 exists. This lets a
 * developer create a bare user record (name + email, no password) purely
 * so the rest of the system has someone to belong to.
 *
 * Do not build UI around this. Do not treat createUser as "sign up".
 * ─────────────────────────────────────────────────────────────────────────────
 */

async function createUser({ name, email }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError(409, 'A user with that email already exists');
  }

  // No password yet — M11 adds passwordHash via bcrypt at registration.
  // Mongoose requires the field, so a placeholder value is used here only
  // to satisfy the schema until real auth exists.
  const user = await User.create({
    name,
    email,
    passwordHash: 'placeholder-until-m11-auth',
  });

  return user;
}

async function getUserById(id) {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError(404, 'User not found');
  }
  return user;
}

module.exports = { createUser, getUserById };
