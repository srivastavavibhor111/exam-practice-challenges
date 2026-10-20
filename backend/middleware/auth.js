const jwt = require('jsonwebtoken');
const { User } = require('../models');
const AppError = require('../utils/AppError');
const { getJwtSecret } = require('../services/authService');

/**
 * auth.js — protect Middleware
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the payoff of a decision made all the way back in M8:
 * assertOwnership() was written to compare a resource's `user` field against
 * "whatever userId the caller provides" — with an explicit comment that once
 * real auth existed, that value would come from a verified identity instead
 * of a client-supplied one, "no other code needs to change." This is that
 * moment. assertOwnership.js is untouched. Every service function is
 * untouched. Only WHERE userId comes from changes — from here.
 *
 * On success, sets req.user = { id, name, email } — every controller that
 * used to read req.body.userId or req.query.userId now reads req.user.id
 * instead, and that value is no longer something a client can simply type
 * into a request body.
 * ─────────────────────────────────────────────────────────────────────────────
 */

async function protect(req, res, next) {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return next(new AppError(401, 'Please log in to continue.'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch {
      return next(new AppError(401, 'Your session has expired. Please log in again.'));
    }

    const user = await User.findById(decoded.sub);
    if (!user) {
      return next(new AppError(401, 'This account no longer exists.'));
    }

    req.user = { id: user._id.toString(), name: user.name, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = protect;
