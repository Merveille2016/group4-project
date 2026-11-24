const FIELD_DEFAULTS = {
  twoFactorEnabled: false,
  twoFactorSecret: null,
  twoFactorPendingSecret: null,
  lastTotpStep: null,
  backupCodes: [],
};

module.exports = {
  description: 'Two factor fields on admins and the pre-auth token collection',

  async up(db) {
    const admins = db.collection('admins');
    for (const [field, value] of Object.entries(FIELD_DEFAULTS)) {
      await admins.updateMany({ [field]: { $exists: false } }, { $set: { [field]: value } });
    }

    const existing = await db.listCollections({ name: 'preauthtokens' }, { nameOnly: true }).toArray();
    if (existing.length === 0) await db.createCollection('preauthtokens');
    const preAuth = db.collection('preauthtokens');
    await preAuth.createIndex({ tokenHash: 1 }, { unique: true });
    await preAuth.createIndex({ admin: 1 });
    await preAuth.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  },

  async down(db) {
    const unset = Object.fromEntries(Object.keys(FIELD_DEFAULTS).map((field) => [field, '']));
    await db.collection('admins').updateMany({}, { $unset: unset });
    const existing = await db.listCollections({ name: 'preauthtokens' }, { nameOnly: true }).toArray();
    if (existing.length > 0) await db.collection('preauthtokens').drop();
  },
};
