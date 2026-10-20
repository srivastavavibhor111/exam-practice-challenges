const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * User
 * ─────────────────────────────────────────────────────────────────────────────
 * A single account. Authentication logic (hashing, login, sessions) is built
 * in M11 — this schema only defines the shape of the data. `passwordHash`
 * exists now so the field is stable before M11 wires in bcrypt.
 *
 * `preferences.theme` lets a signed-in user's theme choice follow them across
 * devices, per the architecture's theme-persistence requirement (section 19).
 * Anonymous/pre-auth theme state still falls back to localStorage on the
 * frontend — this field only matters once a user is logged in.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: false,
      // Never select passwordHash by default — must opt in with .select('+passwordHash')
      select: false,
    },
    googleId: {
      type: String,
      default: null,// allows many documents with googleId: null —
      unique: true,
      sparse: true,   // without `sparse`, a unique index would reject
                      // every local user after the first one, since
                      // they'd all have the same null value
                       
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },

    geminiApiKey: {
      type: String,
      select: false,   // same reasoning as passwordHash — never included
                        // in a default query, must be explicitly requested
      default: null,
    },
    preferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system',
      },
    },
  },
  { timestamps: true } // adds createdAt, updatedAt
);

userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
