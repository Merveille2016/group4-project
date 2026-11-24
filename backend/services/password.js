const argon2 = require('argon2');
const bcrypt = require('bcrypt');

// OWASP's recommended argon2id settings (19 MiB memory, 2 passes, 1 lane)
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

// Returns { ok, needsRehash }. needsRehash is true when the password was right but the
// stored hash should be replaced: a bcrypt hash from before the argon2 switch, or an
// argon2 hash made with weaker settings than ARGON2_OPTIONS.
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
    // Malformed hash in the database: treat as a wrong password rather than a crash
    return { ok: false, needsRehash: false };
  }
}

// Logging in with an unknown email should take as long as with a known one,
// otherwise response times reveal which emails have accounts.
let dummyHashPromise;
async function spendVerifyTime(plain) {
  dummyHashPromise ??= hashPassword('timing-equaliser-not-a-real-password');
  await verifyPassword(await dummyHashPromise, typeof plain === 'string' ? plain : '');
}

module.exports = { ARGON2_OPTIONS, hashPassword, verifyPassword, spendVerifyTime, isBcryptHash };
