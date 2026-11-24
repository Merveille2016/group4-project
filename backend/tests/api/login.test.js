const request = require('supertest');
const bcrypt = require('bcrypt');
const Admin = require('../../models/Admin');
const RefreshToken = require('../../models/RefreshToken');
const config = require('../../config');
const {
  connectTestDb, clearTestDb, disconnectTestDb, buildApp, createAdmin,
  DEFAULT_PASSWORD, SESSION_COOKIE, REFRESH_COOKIE, getCookie, getCookieHeader,
} = require('../helpers');

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

const login = (app, email, password) => request(app).post('/api/auth/login').send({ email, password });
// High IP limit so these tests exercise the per-account lockout on its own
const roomyLimits = { login: { windowMinutes: 15, max: 1000 } };

describe('POST /api/auth/login', () => {
  test('succeeds with the right password, case-insensitive email', async () => {
    const { app } = buildApp();
    const admin = await createAdmin();
    const res = await login(app, ' ADMIN@uniguide.cm ', DEFAULT_PASSWORD).expect(200);

    expect(res.body).toEqual({
      message: 'Login successful',
      admin: { id: String(admin._id), name: 'Test Admin', email: 'admin@uniguide.cm', role: 'admin', tokenVersion: 1 },
    });
  });

  test('sets httpOnly session and refresh cookies, refresh scoped to /api/auth', async () => {
    const { app } = buildApp();
    await createAdmin();
    const res = await login(app, 'admin@uniguide.cm', DEFAULT_PASSWORD).expect(200);

    const session = getCookieHeader(res, SESSION_COOKIE);
    const refresh = getCookieHeader(res, REFRESH_COOKIE);
    expect(session).toMatch(/HttpOnly/);
    expect(session).toMatch(/SameSite=Lax/);
    expect(refresh).toMatch(/HttpOnly/);
    expect(refresh).toMatch(/SameSite=Lax/);
    expect(refresh).toMatch(/Path=\/api\/auth/);
    expect(refresh).toMatch(/Max-Age=604800/);

    // The token isn't in the body, so page scripts can never read it
    expect(JSON.stringify(res.body)).not.toContain(getCookie(res, REFRESH_COOKIE));
  });

  test('bumps tokenVersion, records the login and revokes older refresh tokens', async () => {
    const { app } = buildApp();
    const admin = await createAdmin();
    await login(app, 'admin@uniguide.cm', DEFAULT_PASSWORD).expect(200);
    await login(app, 'admin@uniguide.cm', DEFAULT_PASSWORD).expect(200);

    const stored = await Admin.findById(admin._id);
    expect(stored.tokenVersion).toBe(2);
    expect(stored.lastLoginAt).toBeInstanceOf(Date);
    expect(await RefreshToken.countDocuments({ admin: admin._id, revokedAt: null })).toBe(1);
  });

  test('gives the same answer for an unknown email and a wrong password', async () => {
    const { app } = buildApp();
    await createAdmin();
    const unknown = await login(app, 'nobody@uniguide.cm', DEFAULT_PASSWORD).expect(400);
    const wrong = await login(app, 'admin@uniguide.cm', 'wrong-password').expect(400);
    expect(unknown.body).toEqual(wrong.body);
    expect(unknown.body.message).toBe('Invalid email or password');
    expect(getCookie(wrong, SESSION_COOKIE)).toBeUndefined();
  });

  test.each([
    ['an operator object as email', { email: { $ne: null }, password: 'x' }],
    ['an operator object as password', { email: 'admin@uniguide.cm', password: { $ne: null } }],
    ['missing fields', {}],
  ])('rejects %s with 400', async (_label, body) => {
    const { app } = buildApp();
    await createAdmin();
    const res = await request(app).post('/api/auth/login').send(body).expect(400);
    expect(res.body.message).toBe('Email and password are required');
  });

  test('upgrades a legacy bcrypt hash to argon2id on successful login', async () => {
    const { app } = buildApp();
    await Admin.collection.insertOne({
      email: 'legacy@uniguide.cm', password: await bcrypt.hash('old-password', 4), role: 'admin', tokenVersion: 0,
    });

    await login(app, 'legacy@uniguide.cm', 'old-password').expect(200);

    const stored = await Admin.findOne({ email: 'legacy@uniguide.cm' }).select('+password');
    expect(stored.password).toMatch(/^\$argon2id\$/);
    await login(app, 'legacy@uniguide.cm', 'old-password').expect(200);
  });

  test('an account with no name (created before names existed) can still log in', async () => {
    const { app } = buildApp();
    await Admin.collection.insertOne({
      email: 'noname@uniguide.cm', password: await bcrypt.hash('old-password', 4), role: 'admin',
    });
    const res = await login(app, 'noname@uniguide.cm', 'old-password').expect(200);
    expect(res.body.admin.name).toBeNull();
  });
});

describe('account lockout', () => {
  const { threshold } = config.lockout;

  test(`locks after ${threshold} wrong passwords, even with the right one after`, async () => {
    const { app } = buildApp({ rateLimits: roomyLimits });
    await createAdmin();

    for (let i = 1; i < threshold; i++) await login(app, 'admin@uniguide.cm', 'wrong').expect(400);
    const locking = await login(app, 'admin@uniguide.cm', 'wrong').expect(429);
    expect(locking.body.message).toMatch(/Account locked/);

    const blocked = await login(app, 'admin@uniguide.cm', DEFAULT_PASSWORD).expect(429);
    expect(blocked.body.message).toMatch(/Try again in 15 minutes/);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(14 * 60);
    expect(getCookie(blocked, SESSION_COOKIE)).toBeUndefined();
  });

  test('lets the person in once the lock has expired, and resets the counter', async () => {
    const { app } = buildApp({ rateLimits: roomyLimits });
    const admin = await createAdmin({ lockoutUntil: new Date(Date.now() - 1000), failedLoginAttempts: 0 });

    await login(app, 'admin@uniguide.cm', 'wrong').expect(400);
    await login(app, 'admin@uniguide.cm', DEFAULT_PASSWORD).expect(200);

    const stored = await Admin.findById(admin._id);
    expect(stored.failedLoginAttempts).toBe(0);
    expect(stored.lockoutUntil).toBeNull();
  });

  test('wrong guesses on one account do not lock another', async () => {
    const { app } = buildApp({ rateLimits: roomyLimits });
    await createAdmin();
    await createAdmin({ email: 'other@uniguide.cm' });

    for (let i = 0; i < threshold; i++) await login(app, 'admin@uniguide.cm', 'wrong');
    await login(app, 'other@uniguide.cm', DEFAULT_PASSWORD).expect(200);
  });

  test('a successful login before the threshold clears earlier failures', async () => {
    const { app } = buildApp({ rateLimits: roomyLimits });
    await createAdmin();
    for (let i = 1; i < threshold; i++) await login(app, 'admin@uniguide.cm', 'wrong').expect(400);
    await login(app, 'admin@uniguide.cm', DEFAULT_PASSWORD).expect(200);
    for (let i = 1; i < threshold; i++) await login(app, 'admin@uniguide.cm', 'wrong').expect(400);
    await login(app, 'admin@uniguide.cm', DEFAULT_PASSWORD).expect(200);
  });
});
