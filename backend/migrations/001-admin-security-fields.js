// bcrypt passwords are left alone and upgraded on the next login
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

    // Lowercasing could merge two accounts into one email
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

  // Lowercased emails can't be undone
  async down(db) {
    await db.collection('admins').updateMany({}, {
      $unset: { failedLoginAttempts: '', lockoutUntil: '', passwordChangedAt: '', lastLoginAt: '' },
    });
  },
};
