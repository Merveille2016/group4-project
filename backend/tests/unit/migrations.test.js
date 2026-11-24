const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const { loadMigrations, pendingMigrations, status, migrateUp, migrateDown } = require('../../migrations/runner');
const { connectTestDb, disconnectTestDb } = require('../helpers');

let db;

beforeAll(async () => {
  await connectTestDb();
  db = mongoose.connection.db;
});
// Raw driver tests: start every test from an empty database
afterEach(() => {
  if (!db.databaseName.startsWith('uniguide_test_')) throw new Error('Not a test database');
  return db.dropDatabase();
});
afterAll(disconnectTestDb);

describe('migration runner', () => {
  test('finds the migrations in order', () => {
    expect(loadMigrations().map((m) => m.name)).toEqual([
      '001-admin-security-fields',
      '002-auth-token-collections',
      '003-two-factor',
    ]);
  });

  test('applies pending migrations once and records them', async () => {
    expect(await pendingMigrations(db)).toHaveLength(3);

    expect(await migrateUp(db)).toEqual(['001-admin-security-fields', '002-auth-token-collections', '003-two-factor']);
    expect(await pendingMigrations(db)).toEqual([]);
    expect(await migrateUp(db)).toEqual([]);

    const rows = await status(db);
    expect(rows.every((r) => r.appliedAt instanceof Date)).toBe(true);
  });

  test('migrateDown reverts the most recent migration only', async () => {
    await migrateUp(db);
    expect(await migrateDown(db)).toBe('003-two-factor');
    expect(await pendingMigrations(db)).toEqual(['003-two-factor']);
    expect(await migrateDown(db)).toBe('002-auth-token-collections');
    expect(await migrateDown(db)).toBe('001-admin-security-fields');
    expect(await migrateDown(db)).toBeNull();
  });

  test('a failing migration is not recorded and stops the ones after it', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'));
    fs.writeFileSync(path.join(dir, '001-ok.js'), 'module.exports = { up: async () => {}, down: async () => {} };');
    fs.writeFileSync(path.join(dir, '002-broken.js'), 'module.exports = { up: async () => { throw new Error("boom"); }, down: async () => {} };');
    fs.writeFileSync(path.join(dir, '003-later.js'), 'module.exports = { up: async () => {}, down: async () => {} };');

    await expect(migrateUp(db, { dir })).rejects.toThrow('boom');
    expect(await pendingMigrations(db, { dir })).toEqual(['002-broken', '003-later']);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('001-admin-security-fields', () => {
  test('normalises emails, adds missing fields, keeps existing values and passwords', async () => {
    const admins = db.collection('admins');
    await admins.insertMany([
      // Account from before names and security fields existed, with a bcrypt hash
      { email: '  Old.Admin@UniGuide.CM ', password: '$2b$10$legacyhash', role: 'admin', refreshToken: 'x' },
      // Already has some fields set
      { name: 'Peri', email: 'peri@gmail.com', password: '$argon2id$...', tokenVersion: 7, failedLoginAttempts: 3 },
    ]);

    await migrateUp(db);

    const old = await admins.findOne({ email: 'old.admin@uniguide.cm' });
    expect(old).toMatchObject({
      password: '$2b$10$legacyhash',
      tokenVersion: 0,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      passwordChangedAt: null,
      lastLoginAt: null,
    });
    expect(old).not.toHaveProperty('refreshToken');

    const peri = await admins.findOne({ email: 'peri@gmail.com' });
    expect(peri).toMatchObject({ tokenVersion: 7, failedLoginAttempts: 3 });
  });

  test('refuses to run if lowercasing would merge two accounts', async () => {
    await db.collection('admins').insertMany([
      { email: 'Jane@uniguide.cm', password: 'a' },
      { email: 'jane@uniguide.cm', password: 'b' },
    ]);
    await expect(migrateUp(db)).rejects.toThrow(/jane@uniguide.cm/);
    expect(await db.collection('admins').countDocuments({ email: 'Jane@uniguide.cm' })).toBe(1);
  });
});

describe('002-auth-token-collections', () => {
  const indexKeys = async (name) => (await db.collection(name).indexes()).map((i) => ({
    key: i.key, unique: Boolean(i.unique), ttl: i.expireAfterSeconds,
  }));

  test('creates token collections with unique and TTL indexes', async () => {
    await migrateUp(db);

    for (const name of ['refreshtokens', 'passwordresettokens']) {
      const keys = await indexKeys(name);
      expect(keys).toEqual(expect.arrayContaining([
        { key: { tokenHash: 1 }, unique: true, ttl: undefined },
        { key: { expiresAt: 1 }, unique: false, ttl: 0 },
      ]));
    }
    expect(await indexKeys('admins')).toEqual(expect.arrayContaining([
      { key: { email: 1 }, unique: true, ttl: undefined },
    ]));
  });

  test('down drops the token collections', async () => {
    await migrateUp(db);
    await migrateDown(db);
    await migrateDown(db);
    const names = (await db.listCollections().toArray()).map((c) => c.name);
    expect(names).not.toContain('refreshtokens');
    expect(names).not.toContain('passwordresettokens');
  });
});

describe('003-two-factor', () => {
  test('adds two factor fields without touching accounts that already have them', async () => {
    await db.collection('admins').insertMany([
      { email: 'old@uniguide.cm', password: 'x' },
      { email: 'on@uniguide.cm', password: 'x', twoFactorEnabled: true, twoFactorSecret: 'enc' },
    ]);
    await migrateUp(db);

    const old = await db.collection('admins').findOne({ email: 'old@uniguide.cm' });
    expect(old).toMatchObject({ twoFactorEnabled: false, twoFactorSecret: null, lastTotpStep: null, backupCodes: [] });
    const on = await db.collection('admins').findOne({ email: 'on@uniguide.cm' });
    expect(on).toMatchObject({ twoFactorEnabled: true, twoFactorSecret: 'enc' });

    const keys = (await db.collection('preauthtokens').indexes()).map((i) => ({ key: i.key, ttl: i.expireAfterSeconds }));
    expect(keys).toEqual(expect.arrayContaining([
      { key: { tokenHash: 1 }, ttl: undefined },
      { key: { expiresAt: 1 }, ttl: 0 },
    ]));
  });

  test('down removes the fields and the pre-auth collection', async () => {
    await db.collection('admins').insertOne({ email: 'old@uniguide.cm', password: 'x' });
    await migrateUp(db);
    await migrateDown(db);

    const admin = await db.collection('admins').findOne({ email: 'old@uniguide.cm' });
    expect(admin).not.toHaveProperty('twoFactorEnabled');
    const names = (await db.listCollections().toArray()).map((c) => c.name);
    expect(names).not.toContain('preauthtokens');
  });
});
