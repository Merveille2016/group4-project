const Admin = require('../../models/Admin');
const { lockRemainingMs, recordFailedLogin, clearFailedLogins } = require('../../services/lockout');
const { connectTestDb, clearTestDb, disconnectTestDb, createAdmin } = require('../helpers');

const POLICY = { threshold: 3, minutes: 15 };

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe('lockRemainingMs', () => {
  test('is 0 with no lockout or an expired one', () => {
    expect(lockRemainingMs({ lockoutUntil: null })).toBe(0);
    expect(lockRemainingMs({ lockoutUntil: new Date(Date.now() - 1000) })).toBe(0);
  });

  test('is the time left on an active lockout', () => {
    const now = Date.now();
    expect(lockRemainingMs({ lockoutUntil: new Date(now + 60_000) }, now)).toBe(60_000);
  });
});

describe('recordFailedLogin', () => {
  test('counts down the attempts left before locking', async () => {
    const admin = await createAdmin();
    await expect(recordFailedLogin(admin._id, POLICY)).resolves.toEqual({ locked: false, attemptsLeft: 2 });
    await expect(recordFailedLogin(admin._id, POLICY)).resolves.toEqual({ locked: false, attemptsLeft: 1 });
  });

  test('locks the account for the configured time when the threshold is reached', async () => {
    const admin = await createAdmin();
    await recordFailedLogin(admin._id, POLICY);
    await recordFailedLogin(admin._id, POLICY);
    const before = Date.now();
    const result = await recordFailedLogin(admin._id, POLICY);

    expect(result.locked).toBe(true);
    const expected = before + POLICY.minutes * 60 * 1000;
    expect(result.lockoutUntil.getTime()).toBeGreaterThanOrEqual(expected);
    expect(result.lockoutUntil.getTime()).toBeLessThan(expected + 5000);

    const stored = await Admin.findById(admin._id);
    expect(stored.lockoutUntil.getTime()).toBe(result.lockoutUntil.getTime());
    // Counter starts over, so after the lock ends the person gets a full set of attempts
    expect(stored.failedLoginAttempts).toBe(0);
  });

  test('parallel wrong guesses still lock the account', async () => {
    const admin = await createAdmin();
    await Promise.all(Array.from({ length: 10 }, () => recordFailedLogin(admin._id, POLICY)));
    const stored = await Admin.findById(admin._id);
    expect(lockRemainingMs(stored)).toBeGreaterThan(0);
  });

  test('ignores an account that no longer exists', async () => {
    const admin = await createAdmin();
    await admin.deleteOne();
    await expect(recordFailedLogin(admin._id, POLICY)).resolves.toEqual({ locked: false, attemptsLeft: 0 });
  });
});

describe('clearFailedLogins', () => {
  test('resets the counter and lifts the lock', async () => {
    const admin = await createAdmin({ failedLoginAttempts: 2, lockoutUntil: new Date(Date.now() + 60_000) });
    await clearFailedLogins(admin._id);
    const stored = await Admin.findById(admin._id);
    expect(stored.failedLoginAttempts).toBe(0);
    expect(stored.lockoutUntil).toBeNull();
  });
});
