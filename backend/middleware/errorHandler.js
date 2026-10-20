/**
 * errorHandler.js — UPDATED FOR M17
 * ─────────────────────────────────────────────────────────────────────────────
 * NEW: handles malformed JSON request bodies cleanly. Before this, sending
 * invalid JSON (e.g. a trailing comma, or genuinely broken data from a
 * buggy client) would fall through to the generic 500 branch — technically
 * correct, but a client mistake should be a 400, not treated the same as
 * an unexpected server bug.
 *
 * Rate-limit rejections (M17's rateLimiters.js) do NOT reach this file —
 * express-rate-limit sends its own response directly and never calls
 * next(err), so no handling is needed here for that case.
 *
 * Everything else is unchanged from M8.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function errorHandler(err, req, res, next) {
  // Malformed JSON body — body-parser (used internally by express.json())
  // marks this with type 'entity.parse.failed'.
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    return res.status(400).json({
      error: { message: 'The request body contains invalid JSON.' },
    });
  }

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: { message: err.message },
    });
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: { message: messages.join('; ') },
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      error: { message: `Invalid ID format: ${err.value}` },
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({
      error: { message: `That ${field} is already in use.` },
    });
  }

  console.error('Unexpected error:', err);
  return res.status(500).json({
    error: { message: 'Something went wrong on our end. Please try again.' },
  });
}

module.exports = errorHandler;
