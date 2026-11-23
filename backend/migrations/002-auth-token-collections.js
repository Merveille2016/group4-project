// Creates the collections and indexes for refresh tokens and password reset tokens.
// The TTL indexes make MongoDB delete tokens on its own once they expire.
// Index specs match the Mongoose models, so Mongoose's own index sync sees nothing to change.

async function createCollectionIfMissing(db, name) {
  const existing = await db.listCollections({ name }, { nameOnly: true }).toArray();
  if (existing.length === 0) await db.createCollection(name);
}

async function dropIfExists(db, name) {
  const existing = await db.listCollections({ name }, { nameOnly: true }).toArray();
  if (existing.length > 0) await db.collection(name).drop();
}

module.exports = {
  description: 'Refresh token and password reset token collections with TTL indexes',

  async up(db) {
    await db.collection('admins').createIndex({ email: 1 }, { unique: true });

    await createCollectionIfMissing(db, 'refreshtokens');
    const refresh = db.collection('refreshtokens');
    await refresh.createIndex({ tokenHash: 1 }, { unique: true });
    await refresh.createIndex({ admin: 1 });
    await refresh.createIndex({ family: 1 });
    await refresh.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    await createCollectionIfMissing(db, 'passwordresettokens');
    const reset = db.collection('passwordresettokens');
    await reset.createIndex({ tokenHash: 1 }, { unique: true });
    await reset.createIndex({ admin: 1 });
    await reset.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  },

  async down(db) {
    await dropIfExists(db, 'refreshtokens');
    await dropIfExists(db, 'passwordresettokens');
  },
};
