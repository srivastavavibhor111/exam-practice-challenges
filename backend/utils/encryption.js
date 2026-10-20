const crypto = require('crypto');

/**
 * encryption.js — NEW
 * ─────────────────────────────────────────────────────────────────────────────
 * Encrypts/decrypts values that must be stored but later retrieved in
 * their real, usable form — unlike a password (one-way hashed, never
 * needs to be "read back"), a Gemini API key must be recoverable in
 * plaintext to actually send it to Google's API on the user's behalf.
 *
 * AES-256-GCM: authenticated encryption — GCM's auth tag means a tampered
 * ciphertext fails to decrypt at all, rather than silently decrypting to
 * garbage. Uses Node's built-in `crypto` module — zero new dependency.
 *
 * Requires ENCRYPTION_KEY in .env — a 64-character hex string (32 raw
 * bytes). Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * The stored format is a single string: "iv:authTag:ciphertext", all
 * hex-encoded, so it fits in one String schema field with no extra
 * columns needed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY is not set. Add it to your .env file.');
  }
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  return buf;
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(combined) {
  const [ivHex, authTagHex, encryptedHex] = combined.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Malformed encrypted value.');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
