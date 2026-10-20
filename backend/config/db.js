const mongoose = require('mongoose');

/**
 * db.js — MongoDB Connection
 * ─────────────────────────────────────────────────────────────────────────────
 * Establishes the Mongoose connection using MONGODB_URI from .env.
 * Called once from server.js at startup (M8 wires this in).
 *
 * This file only connects — it has no models, routes, or business logic.
 * Keeping connection setup separate from schema definitions means the
 * connection can be swapped or reconfigured without touching any model file.
 * ─────────────────────────────────────────────────────────────────────────────
 */

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Add it to your .env file — see .env.example.'
    );
  }

  try {
    await mongoose.connect(uri);
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
