/**
 * Optional AES-256-GCM encryption for data/signals.json at rest.
 * Set TRACKER_SIGNALS_ENCRYPTION_KEY (32 bytes as 64 hex chars, or base64 decoding to 32 bytes).
 * If unset, files stay plaintext JSON arrays (current behavior).
 */

const crypto = require('crypto');
const fs = require('fs');

const KEY_ENV = 'TRACKER_SIGNALS_ENCRYPTION_KEY';

function loadKeyBuffer() {
  const raw = process.env[KEY_ENV];
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, 'hex');
  try {
    const b = Buffer.from(s, 'base64');
    if (b.length === 32) return b;
  } catch {
    /* ignore */
  }
  console.warn(
    `[tracker] ${KEY_ENV} is set but invalid (need 64 hex chars or base64 of 32 bytes). Plaintext mode.`,
  );
  return null;
}

function isSignalsEncryptionEnabled() {
  return loadKeyBuffer() !== null;
}

/**
 * @param {string} fileContent — full file string
 * @returns {any[]}
 */
function decodeSignalsFileContent(fileContent) {
  const trimmed = String(fileContent || '').trim();
  if (!trimmed) return [];
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && parsed._enc === true && parsed.v === 1 && parsed.iv && parsed.tag && parsed.data) {
    const key = loadKeyBuffer();
    if (!key) {
      console.warn(`[tracker] signals file is encrypted; set ${KEY_ENV} to decrypt.`);
      return [];
    }
    try {
      const iv = Buffer.from(parsed.iv, 'base64');
      const tag = Buffer.from(parsed.tag, 'base64');
      const data = Buffer.from(parsed.data, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const dec = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
      const list = JSON.parse(dec);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      console.warn('[tracker] decrypt signals file failed:', e.message);
      return [];
    }
  }
  return [];
}

/**
 * @param {any[]} list
 * @returns {string} file body to write
 */
function encodeSignalsFileContent(list) {
  const arr = Array.isArray(list) ? list : [];
  const key = loadKeyBuffer();
  const json = JSON.stringify(arr, null, 2);
  if (!key) return json;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify(
    {
      _enc: true,
      v: 1,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: enc.toString('base64'),
    },
    null,
    2
  );
}

function readSignalsArray(absPath) {
  if (!fs.existsSync(absPath)) return [];
  const raw = fs.readFileSync(absPath, 'utf8');
  return decodeSignalsFileContent(raw);
}

function writeSignalsArray(absPath, list) {
  const body = encodeSignalsFileContent(list);
  fs.writeFileSync(absPath, body, 'utf8');
}

module.exports = {
  isSignalsEncryptionEnabled,
  readSignalsArray,
  writeSignalsArray,
  decodeSignalsFileContent,
  encodeSignalsFileContent,
};
