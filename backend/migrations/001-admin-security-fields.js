// Brings existing admin documents in line with models/Admin.js:
//  - emails trimmed and lowercased (login now looks them up that way)
//  - login security fields present on every account
//  - the unused `refreshToken` field removed (refresh tokens have their own collection now)
//
// Passwords are NOT touched: bcrypt hashes can't be converted without the plain password,
// so they are upgraded to argon2 the next time each person logs in.

const FIELD_DEFAULTS = {
  tokenVersion: 0,
  failedLoginAttempts: 0,
  lockoutUntil: null,
  passwordChangedAt: null,
  lastLoginAt: null,
};

module.exports = {
  description: 'Normalise admin emails and add login security fields',

  async up(db) {
    const admins = db.collection('admins');
    const all = await admins.find({}, { projection: { email: 1 } }).toArray();

    // Lowercasing could turn two accounts into the same email; refuse rather than guess
    const owners = new Map();
    const collisions = new Set();
    for (const admin of all) {
      const email = String(admin.email || '').trim().toLowerCase();
      if (owners.has(email)) collisions.add(email);
      owners.set(email, admin._id);
    }
    if (collisions.size > 0) {
      throw new Error(
        `These emails belong to more than one account once lowercased: ${[...collisions].join(', ')}. ` +
        'Merge or rename those accounts, then run the migration again.',
      );
    }

    for (const admin of all) {
      const email = String(admin.email || '').trim().toLowerCase();
      if (email !== admin.email) await admins.updateOne({ _id: admin._id }, { $set: { email } });
    }

    for (const [field, value] of Object.entries(FIELD_DEFAULTS)) {
      await admins.updateMany({ [field]: { $exists: false } }, { $set: { [field]: value } });
    }

    await admins.updateMany({ refreshToken: { $exists: true } }, { $unset: { refreshToken: '' } });
  },

  // Email normalisation can't be undone (the original casing isn't kept).
  // tokenVersion stays: it existed before this migration.
  async down(db) {
    await db.collection('admins').updateMany({}, {
      $unset: { failedLoginAttempts: '', lockoutUntil: '', passwordChangedAt: '', lastLoginAt: '' },
    });
  },
};
