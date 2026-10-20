const userService = require('../services/userService');

// TEMPORARY — see services/userService.js for why this exists pre-M11.
async function createUser(req, res) {
  const { name, email } = req.body;
  const user = await userService.createUser({ name, email });
  res.status(201).json({ user: { id: user._id, name: user.name, email: user.email } });
}

async function getUser(req, res) {
  const user = await userService.getUserById(req.params.id);
  res.json({ user: { id: user._id, name: user.name, email: user.email } });
}

module.exports = { createUser, getUser };
