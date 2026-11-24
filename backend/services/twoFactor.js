const crypto = require('crypto');
const OTPAuth = require('otpauth');
const QRCode = require('qrcode');
const Admin = require('../models/Admin');
const config = require('../config');
const { sha256 } = require('./tokenUtils');

const PERIOD = 30;
const BACKUP_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

const encryptionKey = () => crypto.createHash('sha256').update(config.twoFactor.key).digest();

// AES-256-GCM, stored as iv.tag.ciphertext in base64url
function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.');
}

function decryptSecret(stored) {
  const [iv, tag, data] = String(stored).split('.').map((part) => Buffer.from(part, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function totpFor(secret, label) {
  return new OTPAuth.TOTP({
    issuer: config.twoFactor.issuer,
    label: label || 'account',
    algorithm: 'SHA1',
    digits: 6,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

function generateSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

async function enrolmentDetails(secret, email) {
  const otpauthUrl = totpFor(secret, email).toString();
  return { secret, otpauthUrl, qr: await QRCode.toDataURL(otpauthUrl) };
}

const cleanCode = (code) => (typeof code === 'string' ? code.replace(/\s+/g, '') : '');

// Returns the time step the code belongs to, or null. Accepts one step either side for clock drift.
function matchTotp(secret, code, now = Date.now()) {
  const token = cleanCode(code);
  if (!/^\d{6}$/.test(token)) return null;
  const delta = totpFor(secret).validate({ token, timestamp: now, window: 1 });
  if (delta === null) return null;
  return Math.floor(now / 1000 / PERIOD) + delta;
}

// Checks the code and records its step in one update, so the same code can't be used twice
async function acceptTotp(adminId, encryptedSecret, code, now = Date.now()) {
  const step = matchTotp(decryptSecret(encryptedSecret), code, now);
  if (step === null) return false;
  const result = await Admin.updateOne(
    { _id: adminId, $or: [{ lastTotpStep: null }, { lastTotpStep: { $lt: step } }] },
    { $set: { lastTotpStep: step } },
  );
  return result.modifiedCount === 1;
}

const normalizeBackupCode = (code) => (typeof code === 'string' ? code.toLowerCase().replace(/[^a-z0-9]/g, '') : '');

function generateBackupCodes(count = config.twoFactor.backupCodeCount) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    let raw = '';
    for (let j = 0; j < 10; j += 1) raw += BACKUP_ALPHABET[crypto.randomInt(BACKUP_ALPHABET.length)];
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return {
    codes,
    stored: codes.map((code) => ({ hash: sha256(normalizeBackupCode(code)), usedAt: null })),
  };
}

// Marks one unused backup code as used. Returns true if it matched.
async function consumeBackupCode(adminId, code) {
  const normalized = normalizeBackupCode(code);
  if (normalized.length !== 10) return false;
  const result = await Admin.updateOne(
    { _id: adminId, backupCodes: { $elemMatch: { hash: sha256(normalized), usedAt: null } } },
    { $set: { 'backupCodes.$.usedAt': new Date() } },
  );
  return result.modifiedCount === 1;
}

async function backupCodesLeft(adminId) {
  const admin = await Admin.findById(adminId).select('+backupCodes');
  return admin ? admin.backupCodes.filter((c) => !c.usedAt).length : 0;
}

module.exports = {
  PERIOD,
  encryptSecret,
  decryptSecret,
  generateSecret,
  enrolmentDetails,
  matchTotp,
  acceptTotp,
  generateBackupCodes,
  consumeBackupCode,
  backupCodesLeft,
};
