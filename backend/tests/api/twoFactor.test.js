const request = require('supertest');
const OTPAuth = require('otpauth');
const Admin = require('../../models/Admin');
const PreAuthToken = require('../../models/PreAuthToken');
const config = require('../../config');
const { decryptSecret, PERIOD } = require('../../services/twoFactor');
const {
  connectTestDb, clearTestDb, disconnectTestDb, buildApp, createAdmin, DEFAULT_PASSWORD,
  SESSION_COOKIE, REFRESH_COOKIE, PRE_AUTH_COOKIE, getCookieHeader,
} = require('../helpers');

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

const EMAIL = 'admin@uniguide.cm';
const roomyLimits = { login: { windowMinutes: 15, max: 1000 }, twoFactorVerify: { windowMinutes: 15, max: 1000 } };

const codeFor = (secret, timestamp = Date.now()) => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate({ timestamp });
const nextCode = (secret) => codeFor(secret, Date.now() + PERIOD * 1000);
// Lets a test log in again without waiting for the next 30 second step
const forgetLastCode = (id) => Admin.updateOne({ _id: id }, { $set: { lastTotpStep: null } });

async function loggedIn(app) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: EMAIL, password: DEFAULT_PASSWORD }).expect(200);
  return agent;
}

// Account with 2FA turned on through the real endpoints
async function withTwoFactor({ rateLimits = roomyLimits } = {}) {
  const { app } = buildApp({ rateLimits });
  const admin = await createAdmin();
  const agent = await loggedIn(app);
  const setup = await agent.post('/api/auth/2fa/setup').expect(200);
  const enable = await agent.post('/api/auth/2fa/enable').send({ code: codeFor(setup.body.secret) }).expect(200);
  await forgetLastCode(admin._id);
  return { app, admin, agent, secret: setup.body.secret, backupCodes: enable.body.backupCodes };
}

async function passwordStep(app) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email: EMAIL, password: DEFAULT_PASSWORD }).expect(200);
  return { agent, res };
}

describe('enrolment', () => {
  test('setup needs a session', async () => {
    const { app } = buildApp();
    await request(app).post('/api/auth/2fa/setup').expect(401);
  });

  test('setup returns a QR code and keeps the secret encrypted until confirmed', async () => {
    const { app } = buildApp();
    const admin = await createAdmin();
    const agent = await loggedIn(app);

    const res = await agent.post('/api/auth/2fa/setup').expect(200);

    expect(res.body.qr).toMatch(/^data:image\/png;base64,/);
    expect(res.body.otpauthUrl).toContain(`secret=${res.body.secret}`);
    const stored = await Admin.findById(admin._id).select('+twoFactorPendingSecret +twoFactorSecret');
    expect(stored.twoFactorEnabled).toBe(false);
    expect(stored.twoFactorSecret).toBeNull();
    expect(stored.twoFactorPendingSecret).not.toContain(res.body.secret);
    expect(decryptSecret(stored.twoFactorPendingSecret)).toBe(res.body.secret);
  });

  test('enable rejects a wrong code and leaves 2FA off', async () => {
    const { app } = buildApp();
    const admin = await createAdmin();
    const agent = await loggedIn(app);
    await agent.post('/api/auth/2fa/setup').expect(200);

    const res = await agent.post('/api/auth/2fa/enable').send({ code: '000000' }).expect(400);
    expect(res.body.message).toMatch(/not right/);
    expect((await Admin.findById(admin._id)).twoFactorEnabled).toBe(false);
  });

  test('enable without setup asks to start again', async () => {
    const { app } = buildApp();
    await createAdmin();
    const agent = await loggedIn(app);
    const res = await agent.post('/api/auth/2fa/enable').send({ code: '123456' }).expect(400);
    expect(res.body.message).toMatch(/Start the setup again/);
  });

  test('enable turns 2FA on, returns ten backup codes once and stores only hashes', async () => {
    const { app } = buildApp();
    const admin = await createAdmin();
    const agent = await loggedIn(app);
    const setup = await agent.post('/api/auth/2fa/setup').expect(200);

    const res = await agent.post('/api/auth/2fa/enable').send({ code: codeFor(setup.body.secret) }).expect(200);

    expect(res.body.backupCodes).toHaveLength(10);
    expect(res.body.admin.twoFactorEnabled).toBe(true);
    const stored = await Admin.findById(admin._id).select('+twoFactorSecret +twoFactorPendingSecret +backupCodes');
    expect(stored.twoFactorPendingSecret).toBeNull();
    expect(decryptSecret(stored.twoFactorSecret)).toBe(setup.body.secret);
    expect(JSON.stringify(stored.backupCodes)).not.toContain(res.body.backupCodes[0].replace('-', ''));

    const status = await agent.get('/api/auth/2fa/status').expect(200);
    expect(status.body).toEqual({ enabled: true, backupCodesLeft: 10 });
  });

  test('enabling keeps this session but retires the refresh token issued before it', async () => {
    const { app } = buildApp();
    await createAdmin();
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ email: EMAIL, password: DEFAULT_PASSWORD }).expect(200);
    const oldRefresh = getCookieHeader(login, REFRESH_COOKIE).split(';')[0];

    const setup = await agent.post('/api/auth/2fa/setup').expect(200);
    await agent.post('/api/auth/2fa/enable').send({ code: codeFor(setup.body.secret) }).expect(200);

    await agent.get('/api/auth/me').expect(200);
    await request(app).post('/api/auth/refresh').set('Cookie', oldRefresh).expect(401);
  });

  test('setup is refused once 2FA is on', async () => {
    const { agent } = await withTwoFactor();
    const res = await agent.post('/api/auth/2fa/setup').expect(400);
    expect(res.body.message).toMatch(/already on/);
  });
});

describe('login with 2FA', () => {
  test('a correct password only gives a pre-auth cookie, no session', async () => {
    const { app } = await withTwoFactor();
    const { agent, res } = await passwordStep(app);

    expect(res.body).toEqual({ message: expect.any(String), twoFactorRequired: true });
    expect(res.body.admin).toBeUndefined();
    expect(getCookieHeader(res, SESSION_COOKIE)).toBeUndefined();
    expect(getCookieHeader(res, REFRESH_COOKIE)).toBeUndefined();

    const preAuth = getCookieHeader(res, PRE_AUTH_COOKIE);
    expect(preAuth).toMatch(/HttpOnly/);
    expect(preAuth).toMatch(/Path=\/api\/auth\/2fa/);
    expect(preAuth).toMatch(/Max-Age=300/);

    await agent.get('/api/auth/me').expect(401);
  });

  test('the right code finishes the login with session and refresh cookies', async () => {
    const { app, admin, secret } = await withTwoFactor();
    const { agent } = await passwordStep(app);

    const res = await agent.post('/api/auth/2fa/verify').send({ code: codeFor(secret) }).expect(200);

    expect(res.body.admin).toMatchObject({ email: EMAIL, twoFactorEnabled: true });
    expect(getCookieHeader(res, SESSION_COOKIE)).toMatch(/HttpOnly/);
    expect(getCookieHeader(res, REFRESH_COOKIE)).toMatch(/HttpOnly/);
    expect(getCookieHeader(res, PRE_AUTH_COOKIE)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(await PreAuthToken.countDocuments({ admin: admin._id })).toBe(0);
    await agent.get('/api/auth/me').expect(200);
  });

  test('a wrong code is refused and the same pre-auth can try again', async () => {
    const { app, secret } = await withTwoFactor();
    const { agent } = await passwordStep(app);

    const res = await agent.post('/api/auth/2fa/verify').send({ code: '000000' }).expect(400);
    expect(res.body.message).toMatch(/not right/);
    await agent.post('/api/auth/2fa/verify').send({ code: codeFor(secret) }).expect(200);
  });

  test('a code that was already used can not log in again', async () => {
    const { app, secret } = await withTwoFactor();
    const code = codeFor(secret);

    const first = await passwordStep(app);
    await first.agent.post('/api/auth/2fa/verify').send({ code }).expect(200);

    const second = await passwordStep(app);
    await second.agent.post('/api/auth/2fa/verify').send({ code }).expect(400);
    await second.agent.post('/api/auth/2fa/verify').send({ code: nextCode(secret) }).expect(200);
  });

  test('verify without the password step is 401', async () => {
    const { app, secret } = await withTwoFactor();
    const res = await request(app).post('/api/auth/2fa/verify').send({ code: codeFor(secret) }).expect(401);
    expect(res.body.message).toMatch(/enter your password again/);
  });

  test('an expired pre-auth is 401', async () => {
    const { app, admin, secret } = await withTwoFactor();
    const { agent } = await passwordStep(app);
    await PreAuthToken.updateMany({ admin: admin._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await agent.post('/api/auth/2fa/verify').send({ code: codeFor(secret) }).expect(401);
  });

  test('a pre-auth stops working after too many wrong codes', async () => {
    const { app, secret } = await withTwoFactor();
    const original = config.preAuth.maxAttempts;
    config.preAuth.maxAttempts = 2;
    try {
      const { agent } = await passwordStep(app);
      await agent.post('/api/auth/2fa/verify').send({ code: '000000' }).expect(400);
      const res = await agent.post('/api/auth/2fa/verify').send({ code: '000000' }).expect(401);
      expect(res.body.message).toMatch(/Too many wrong codes/);
      await agent.post('/api/auth/2fa/verify').send({ code: codeFor(secret) }).expect(401);
    } finally {
      config.preAuth.maxAttempts = original;
    }
  });

  test('wrong codes count towards the account lockout', async () => {
    const { app, secret } = await withTwoFactor();

    // Wrong passwords and wrong codes share one counter, and a correct password doesn't reset it
    const login = (password) => request(app).post('/api/auth/login').send({ email: EMAIL, password });
    for (let i = 0; i < 3; i += 1) await login('wrong-password').expect(400);
    const { agent } = await passwordStep(app);
    await agent.post('/api/auth/2fa/verify').send({ code: '000000' }).expect(400);
    const locked = await agent.post('/api/auth/2fa/verify').send({ code: '000000' }).expect(429);
    expect(locked.body.message).toMatch(/Account locked/);

    // The pre-auth is gone and the password step is locked too
    await agent.post('/api/auth/2fa/verify').send({ code: codeFor(secret) }).expect(401);
    await login(DEFAULT_PASSWORD).expect(429);
  });

  test('two requests racing with one pre-auth only log in once', async () => {
    const { app, secret } = await withTwoFactor();
    const { res } = await passwordStep(app);
    const cookie = getCookieHeader(res, PRE_AUTH_COOKIE).split(';')[0];

    const verify = (code) => request(app).post('/api/auth/2fa/verify').set('Cookie', cookie).send({ code });
    const results = await Promise.all([verify(codeFor(secret)), verify(nextCode(secret))]);
    expect(results.map((r) => r.status).filter((s) => s === 200)).toHaveLength(1);
  });

  test('accounts without 2FA still log in in one step', async () => {
    const { app } = buildApp();
    await createAdmin();
    const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: DEFAULT_PASSWORD }).expect(200);
    expect(res.body.twoFactorRequired).toBeUndefined();
    expect(getCookieHeader(res, SESSION_COOKIE)).toBeDefined();
  });
});

describe('recovery with backup codes', () => {
  test('a backup code logs in once and reports how many are left', async () => {
    const { app, backupCodes } = await withTwoFactor();

    const first = await passwordStep(app);
    const res = await first.agent.post('/api/auth/2fa/recover').send({ code: backupCodes[0] }).expect(200);
    expect(res.body.backupCodesLeft).toBe(9);
    await first.agent.get('/api/auth/me').expect(200);

    const second = await passwordStep(app);
    await second.agent.post('/api/auth/2fa/recover').send({ code: backupCodes[0] }).expect(400);
  });

  test('an app code does not work as a backup code, nor the other way round', async () => {
    const { app, secret, backupCodes } = await withTwoFactor();
    const { agent } = await passwordStep(app);
    await agent.post('/api/auth/2fa/recover').send({ code: codeFor(secret) }).expect(400);
    await agent.post('/api/auth/2fa/verify').send({ code: backupCodes[0] }).expect(400);
  });

  test('new backup codes replace the old ones', async () => {
    const { app, agent, secret, backupCodes } = await withTwoFactor();

    const res = await agent.post('/api/auth/2fa/backup-codes').send({ code: codeFor(secret) }).expect(200);
    expect(res.body.backupCodes).toHaveLength(10);
    expect(res.body.backupCodes).not.toContain(backupCodes[0]);

    const { agent: next } = await passwordStep(app);
    await next.post('/api/auth/2fa/recover').send({ code: backupCodes[0] }).expect(400);
    await next.post('/api/auth/2fa/recover').send({ code: res.body.backupCodes[0] }).expect(200);
  });

  test('new backup codes need a valid app code', async () => {
    const { agent } = await withTwoFactor();
    await agent.post('/api/auth/2fa/backup-codes').send({ code: '000000' }).expect(400);
  });
});

describe('turning 2FA off', () => {
  test('needs the password', async () => {
    const { agent, secret } = await withTwoFactor();
    const res = await agent.post('/api/auth/2fa/disable').send({ password: 'wrong-password', code: codeFor(secret) }).expect(400);
    expect(res.body.message).toBe('Incorrect password');
  });

  test('needs a valid code', async () => {
    const { agent } = await withTwoFactor();
    await agent.post('/api/auth/2fa/disable').send({ password: DEFAULT_PASSWORD, code: '000000' }).expect(400);
  });

  test('works with an app code and clears everything', async () => {
    const { app, admin, agent, secret } = await withTwoFactor();

    const res = await agent.post('/api/auth/2fa/disable').send({ password: DEFAULT_PASSWORD, code: codeFor(secret) }).expect(200);
    expect(res.body.admin.twoFactorEnabled).toBe(false);

    const stored = await Admin.findById(admin._id).select('+twoFactorSecret +backupCodes');
    expect(stored.twoFactorSecret).toBeNull();
    expect(stored.backupCodes).toHaveLength(0);

    const login = await request(app).post('/api/auth/login').send({ email: EMAIL, password: DEFAULT_PASSWORD }).expect(200);
    expect(login.body.twoFactorRequired).toBeUndefined();
  });

  test('works with a backup code for someone who lost their phone', async () => {
    const { agent, backupCodes } = await withTwoFactor();
    await agent.post('/api/auth/2fa/disable').send({ password: DEFAULT_PASSWORD, code: backupCodes[3] }).expect(200);
  });
});

describe('password reset with 2FA', () => {
  test('resetting the password keeps 2FA on and drops any pending pre-auth', async () => {
    const { app, mailer } = buildApp({ rateLimits: roomyLimits });
    const admin = await createAdmin();
    const agent = await loggedIn(app);
    const setup = await agent.post('/api/auth/2fa/setup').expect(200);
    await agent.post('/api/auth/2fa/enable').send({ code: codeFor(setup.body.secret) }).expect(200);
    await forgetLastCode(admin._id);

    const { agent: pending } = await passwordStep(app);

    await request(app).post('/api/auth/forgot-password').send({ email: EMAIL }).expect(200);
    const token = new URL(mailer.sendPasswordReset.mock.calls[0][0].link).searchParams.get('token');
    await request(app).post('/api/auth/reset-password').send({ token, password: 'a-brand-new-password' }).expect(200);

    await pending.post('/api/auth/2fa/verify').send({ code: codeFor(setup.body.secret) }).expect(401);

    const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: 'a-brand-new-password' }).expect(200);
    expect(res.body.twoFactorRequired).toBe(true);
  });
});

describe('rate limits', () => {
  test('verify is limited per network', async () => {
    const { app } = await withTwoFactor({ rateLimits: { ...roomyLimits, twoFactorVerify: { windowMinutes: 15, max: 2 } } });
    await request(app).post('/api/auth/2fa/verify').send({ code: '000000' }).expect(401);
    await request(app).post('/api/auth/2fa/verify').send({ code: '000000' }).expect(401);
    const res = await request(app).post('/api/auth/2fa/verify').send({ code: '000000' }).expect(429);
    expect(res.body.message).toMatch(/Too many code attempts/);
  });
});
