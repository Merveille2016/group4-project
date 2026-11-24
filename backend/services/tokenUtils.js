const crypto = require('crypto');

// 256 bits of randomness, URL-safe so it can sit in a cookie or a link
const randomToken = () => crypto.randomBytes(32).toString('base64url');

// Tokens are random and long, so a plain SHA-256 is enough to store them safely
// (no salt or slow hash needed, unlike passwords).
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

module.exports = { randomToken, sha256 };
