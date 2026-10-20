/**
 * sanitize.js — NoSQL Injection Protection
 * ─────────────────────────────────────────────────────────────────────────────
 * REAL GAP THIS CLOSES: several routes take a value straight from
 * req.query or req.body and drop it into a Mongoose filter — e.g.
 * questionService.listQuestionsBySource does
 * Question.find({ source: sourceId, ... }). Express's query parser can
 * turn a query string like ?sourceId[$ne]=null into a nested OBJECT
 * ({ $ne: null }) instead of a string. If that object reaches a Mongo
 * query unsanitized, it can manipulate the filter itself — e.g. bypassing
 * an equality check the app assumed was a plain string comparison.
 *
 * Deliberately NOT using the express-mongo-sanitize package: recent
 * versions try to reassign req.query wholesale, which throws in some
 * Express setups where req.query is a read-only getter. This does the
 * same job — strip any object key starting with '$' or containing '.'
 * (both have special meaning to MongoDB) — by mutating req.query's
 * existing keys in place instead of replacing the object, and by
 * reassigning req.body/req.params (which are always safe to reassign).
 * Zero new dependencies, and no version-compatibility risk.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    const clean = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.')) continue; // strip dangerous keys
      clean[key] = sanitizeValue(val);
    }
    return clean;
  }
  return value;
}

function sanitizeInputs(req, res, next) {
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }

  // req.query is read-only in some Express versions — mutate keys in
  // place instead of reassigning the whole object.
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete req.query[key];
      } else {
        req.query[key] = sanitizeValue(req.query[key]);
      }
    }
  }

  next();
}

module.exports = sanitizeInputs;
