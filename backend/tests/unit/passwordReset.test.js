const PasswordResetToken = require('../../models/PasswordResetToken');
const config = require('../../config');
const { sha256 } = require('../../services/tokenUtils');
const { createResetToken, consumeResetToken, buildResetLink } = require('../../services/passwordReset');
const { connectTestDb, clearTestDb, disconnectTestDb, createAdmin } = require('../helpers');

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe('createResetToken', () => {
  test('stores only the hash, with the configured expiry', async () => {
    const admin = await createAdmin();
    const token = await createResetToken(admin, { ip: '1.2.3.4' });

    const doc = await PasswordResetToken.findOne({ admin: admin._id });
    expect(doc.tokenHash).toBe(sha256(token));
    expect(doc.requestedIp).toBe('1.2.3.4');
    const minutes = (doc.expiresAt - Date.now()) / 60000;
    expect(minutes).toBeCloseTo(config.passwordReset.minutes, 0);
  });

  test('a new request makes the previous link stop working', async () => {
    const admin = await createAdmin();
    const first = await createResetToken(admin);
    const second = await createResetToken(admin);

    await expect(consumeResetToken(first)).resolves.toBeNull();
    await expect(consumeResetToken(second)).resolves.not.toBeNull();
  });
});

describe('consumeResetToken', () => {
  test('works once', async () => {
    const admin = await createAdmin();
    const token = await createResetToken(admin);

    const record = await consumeResetToken(token);
    expect(String(record.admin)).toBe(String(admin._id));
    await expect(consumeResetToken(token)).resolves.toBeNull();
  });

  test('only one of many parallel uses succeeds', async () => {
    const admin = await createAdmin();
    const token = await createResetToken(admin);
    const results = await Promise.all(Array.from({ length: 5 }, () => consumeResetToken(token)));
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  test('rejects an expired token', async () => {
    const admin = await createAdmin();
    const token = await createResetToken(admin);
    await PasswordResetToken.updateOne({ admin: admin._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(consumeResetToken(token)).resolves.toBeNull();
  });

  test.each([
    ['unknown', 'x'.repeat(43)],
    ['too short', 'abc'],
    ['too long', 'x'.repeat(201)],
    ['not a string', { $ne: null }],
  ])('rejects an %s token', async (_label, token) => {
    await expect(consumeResetToken(token)).resolves.toBeNull();
  });
});

test('buildResetLink points at the frontend reset page with the token URL-encoded', () => {
  expect(buildResetLink('abc_-123')).toBe(`${config.appUrl.replace(/\/$/, '')}/reset-password?token=abc_-123`);
});
