const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

/**
 * validation.js — Request Body Validation
 * ─────────────────────────────────────────────────────────────────────────────
 * A small, dependency-free validator. Rather than pull in a library like Joi
 * or Zod for what's mostly "is this field present and the right shape",
 * this factory covers the checks the API actually needs.
 *
 * Usage:
 *   router.post('/', validateBody({
 *     title:     { required: true, type: 'string', minLength: 1 },
 *     questions: { required: true, type: 'array', minLength: 1 },
 *   }), controller.createTest);
 *
 * Supported rule keys: required, type ('string'|'number'|'boolean'|'array'|
 * 'object'), enum, minLength, objectId (validates as a Mongo ObjectId).
 * ─────────────────────────────────────────────────────────────────────────────
 */

function validateBody(rules) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = req.body[field];
      const isMissing = value === undefined || value === null || value === '';

      if (rule.required && isMissing) {
        errors.push(`${field} is required`);
        continue;
      }
      if (isMissing) continue; // optional and not provided — nothing more to check

      if (rule.type === 'string'  && typeof value !== 'string')                        errors.push(`${field} must be a string`);
      if (rule.type === 'number'  && typeof value !== 'number')                        errors.push(`${field} must be a number`);
      if (rule.type === 'boolean' && typeof value !== 'boolean')                       errors.push(`${field} must be a boolean`);
      if (rule.type === 'array'   && !Array.isArray(value))                            errors.push(`${field} must be an array`);
      if (rule.type === 'object'  && (typeof value !== 'object' || Array.isArray(value))) errors.push(`${field} must be an object`);

      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rule.enum.join(', ')}`);
      }
      if (rule.minLength != null) {
        const length = typeof value === 'string' || Array.isArray(value) ? value.length : null;
        if (length !== null && length < rule.minLength) {
          errors.push(`${field} must have at least ${rule.minLength} ${Array.isArray(value) ? 'items' : 'characters'}`);
        }
      }
      if (rule.objectId && !mongoose.Types.ObjectId.isValid(value)) {
        errors.push(`${field} must be a valid ID`);
      }
    }

    if (errors.length > 0) {
      return next(new AppError(400, errors.join('; ')));
    }
    next();
  };
}

module.exports = { validateBody };
