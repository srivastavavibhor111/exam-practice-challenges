/**
 * asyncHandler — Async Route Wrapper
 * ─────────────────────────────────────────────────────────────────────────────
 * Express doesn't automatically catch errors thrown inside an `async`
 * controller — an unhandled rejection would crash the request silently.
 * Wrapping every async controller in this forwards any thrown error to
 * next(err), which errorHandler.js then catches and formats.
 *
 * Usage:  router.get('/:id', asyncHandler(testController.getTest));
 * ─────────────────────────────────────────────────────────────────────────────
 */

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
