/**
 * AppError — Custom Error Class
 * ─────────────────────────────────────────────────────────────────────────────
 * Distinguishes errors WE expect and understand (bad input, missing resource,
 * unauthorized access) from bugs we didn't anticipate. `isOperational: true`
 * marks the former — errorHandler.js uses this flag to decide whether to
 * show the message to the client or hide it behind a generic "server error".
 *
 * Usage:  throw new AppError(404, 'Test not found');
 * ─────────────────────────────────────────────────────────────────────────────
 */

class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
