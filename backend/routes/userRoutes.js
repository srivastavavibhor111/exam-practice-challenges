const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const asyncHandler = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validation');

/**
 * userRoutes.js — /api/users
 * ─────────────────────────────────────────────────────────────────────────────
 * TEMPORARY, pre-auth only. POST here just creates a bare user record (name
 * + email, no password) so the rest of the API has a valid userId to work
 * with while testing. M11 replaces this entirely with real registration,
 * login, and password hashing — this route should be removed or locked down
 * once that milestone lands.
 * ─────────────────────────────────────────────────────────────────────────────
 */

router.post(
  '/',
  validateBody({
    name:  { required: true, type: 'string', minLength: 1 },
    email: { required: true, type: 'string', minLength: 3 },
  }),
  asyncHandler(userController.createUser)
);

router.get('/:id', asyncHandler(userController.getUser));

module.exports = router;
