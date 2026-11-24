const crypto = require('crypto');

const randomToken = () => crypto.randomBytes(32).toString('base64url');

// Tokens are long and random, so plain SHA-256 is enough
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

module.exports = { randomToken, sha256 };
