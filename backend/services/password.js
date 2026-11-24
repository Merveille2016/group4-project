const argon2 = require('argon2');
const bcrypt = require('bcrypt');

// OWASP recommended argon2id settings
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const isBcryptHash = (hash) => /^\$2[aby]\$/.test(hash);

function hashPassword(plain) {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

// needsRehash is true for bcrypt hashes and argon2 hashes with weaker settings
async function verifyPassword(hash, plain) {
  if (typeof hash !== 'string' || typeof plain !== 'string') {
    return { ok: false, needsRehash: false };
  }

  if (isBcryptHash(hash)) {
    const ok = await bcrypt.compare(plain, hash);
    return { ok, needsRehash: ok };
  }

  try {
    const ok = await argon2.verify(hash, plain);
    return { ok, needsRehash: ok && argon2.needsRehash(hash, ARGON2_OPTIONS) };
  } catch {
    return { ok: false, needsRehash: false };
  }
}

// Unknown emails take as long as known ones, so timing doesn't reveal accounts
let dummyHashPromise;
async function spendVerifyTime(plain) {
  dummyHashPromise ??= hashPassword('timing-equaliser-not-a-real-password');
  await verifyPassword(await dummyHashPromise, typeof plain === 'string' ? plain : '');
}

module.exports = { ARGON2_OPTIONS, hashPassword, verifyPassword, spendVerifyTime, isBcryptHash };
