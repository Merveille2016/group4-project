const Admin = require('../../models/Admin');
const RefreshToken = require('../../models/RefreshToken');
const config = require('../../config');
const { sha256 } = require('../../services/tokenUtils');
const {
  RefreshError, issueRefreshToken, rotateRefreshToken, revokeByToken, revokeAllForAdmin,
} = require('../../services/refreshTokens');
const { connectTestDb, clearTestDb, disconnectTestDb, createAdmin } = require('../helpers');

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

const rotateError = (token) => rotateRefreshToken(token).then(
  () => { throw new Error('expected rotation to fail'); },
  (err) => err,
);

// Pretend a token was rotated long enough ago that the race grace period is over
const ageRevocation = (token) => RefreshToken.updateOne(
  { tokenHash: sha256(token) },
  { $set: { revokedAt: new Date(Date.now() - (config.refreshToken.reuseGraceSeconds + 5) * 1000) } },
);

describe('issueRefreshToken', () => {
  test('stores only a SHA-256 of a long random token', async () => {
    const admin = await createAdmin();
    const { token, doc } = await issueRefreshToken(admin, { ip: '1.2.3.4', userAgent: 'jest' });

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(doc.tokenHash).toBe(sha256(token));
    expect(JSON.stringify(await RefreshToken.findById(doc._id).lean())).not.toContain(token);
    expect(doc.tokenVersion).toBe(admin.tokenVersion);
    expect(doc.createdByIp).toBe('1.2.3.4');
  });

  test('expires after the configured number of days', async () => {
    const admin = await createAdmin();
    const { doc } = await issueRefreshToken(admin);
    const days = (doc.expiresAt - Date.now()) / (24 * 60 * 60 * 1000);
    expect(days).toBeCloseTo(config.refreshToken.days, 1);
  });

  test('has a TTL index so MongoDB removes expired tokens', async () => {
    const indexes = await RefreshToken.collection.indexes();
    expect(indexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
    ]));
  });
});

describe('rotateRefreshToken', () => {
  test('swaps a valid token for a new one in the same family', async () => {
    const admin = await createAdmin();
    const first = await issueRefreshToken(admin);

    const { token, admin: owner } = await rotateRefreshToken(first.token);

    expect(token).not.toBe(first.token);
    expect(String(owner._id)).toBe(String(admin._id));
    const old = await RefreshToken.findById(first.doc._id);
    const next = await RefreshToken.findOne({ tokenHash: sha256(token) });
    expect(old.revokeReason).toBe('rotated');
    expect(old.replacedByHash).toBe(next.tokenHash);
    expect(next.family).toBe(first.doc.family);
  });

  test.each([
    ['missing', undefined],
    ['invalid', 'not-a-real-token'],
  ])('rejects a %s token', async (code, token) => {
    const err = await rotateError(token);
    expect(err).toBeInstanceOf(RefreshError);
    expect(err.code).toBe(code);
  });

  test('rejects an expired token', async () => {
    const admin = await createAdmin();
    const { token, doc } = await issueRefreshToken(admin);
    await RefreshToken.updateOne({ _id: doc._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await rotateError(token)).code).toBe('expired');
  });

  test('treats an immediate second use as a race and keeps the family alive', async () => {
    const admin = await createAdmin();
    const first = await issueRefreshToken(admin);
    const { token: winner } = await rotateRefreshToken(first.token);

    expect((await rotateError(first.token)).code).toBe('raced');
    await expect(rotateRefreshToken(winner)).resolves.toHaveProperty('token');
  });

  test('reuse of an old rotated token revokes the whole family', async () => {
    const admin = await createAdmin();
    const first = await issueRefreshToken(admin);
    const { token: current } = await rotateRefreshToken(first.token);
    await ageRevocation(first.token);

    expect((await rotateError(first.token)).code).toBe('reused');

    // The legitimate holder's newer token is dead too
    expect((await rotateError(current)).code).toBe('revoked');
    const live = await RefreshToken.countDocuments({ family: first.doc.family, revokedAt: null });
    expect(live).toBe(0);
  });

  test('only one of many parallel rotations succeeds', async () => {
    const admin = await createAdmin();
    const { token } = await issueRefreshToken(admin);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => rotateRefreshToken(token)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  test('a token issued before the account tokenVersion changed is stale', async () => {
    const admin = await createAdmin();
    const { token } = await issueRefreshToken(admin);
    await Admin.updateOne({ _id: admin._id }, { $inc: { tokenVersion: 1 } });
    expect((await rotateError(token)).code).toBe('stale');
  });

  test('a token for a deleted account is stale', async () => {
    const admin = await createAdmin();
    const { token } = await issueRefreshToken(admin);
    await admin.deleteOne();
    expect((await rotateError(token)).code).toBe('stale');
  });
});

describe('revocation', () => {
  test('revokeByToken ends that token chain only', async () => {
    const admin = await createAdmin();
    const laptop = await issueRefreshToken(admin);
    const phone = await issueRefreshToken(admin);

    const doc = await revokeByToken(laptop.token, 'logout');

    expect(String(doc.admin)).toBe(String(admin._id));
    expect((await rotateError(laptop.token)).code).toBe('revoked');
    await expect(rotateRefreshToken(phone.token)).resolves.toHaveProperty('token');
  });

  test('revokeByToken ignores unknown and missing tokens', async () => {
    await expect(revokeByToken('nope', 'logout')).resolves.toBeNull();
    await expect(revokeByToken(undefined, 'logout')).resolves.toBeNull();
  });

  test('revokeAllForAdmin ends every chain for that account only', async () => {
    const admin = await createAdmin();
    const other = await createAdmin({ email: 'other@uniguide.cm' });
    const a = await issueRefreshToken(admin);
    const b = await issueRefreshToken(admin);
    const c = await issueRefreshToken(other);

    await revokeAllForAdmin(admin._id, 'password-reset');

    expect((await rotateError(a.token)).code).toBe('revoked');
    expect((await rotateError(b.token)).code).toBe('revoked');
    await expect(rotateRefreshToken(c.token)).resolves.toHaveProperty('token');
  });
});
