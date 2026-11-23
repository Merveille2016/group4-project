const request = require('supertest');
const Admin = require('../../models/Admin');
const RefreshToken = require('../../models/RefreshToken');
const PasswordResetToken = require('../../models/PasswordResetToken');
const {
  connectTestDb, clearTestDb, disconnectTestDb, buildApp, createAdmin, DEFAULT_PASSWORD,
} = require('../helpers');

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

const GENERIC = 'If an account exists for that email, a password reset link has been sent.';
const forgot = (app, email) => request(app).post('/api/auth/forgot-password').send({ email });
const reset = (app, token, password) => request(app).post('/api/auth/reset-password').send({ token, password });
const tokenFromEmail = (mailer, call = 0) => new URL(mailer.sendPasswordReset.mock.calls[call][0].link).searchParams.get('token');

describe('POST /api/auth/forgot-password', () => {
  test('emails a single-use reset link to a known account', async () => {
    const { app, mailer } = buildApp();
    await createAdmin();

    const res = await forgot(app, 'Admin@UniGuide.cm').expect(200);

    expect(res.body.message).toBe(GENERIC);
    expect(mailer.sendPasswordReset).toHaveBeenCalledTimes(1);
    const email = mailer.sendPasswordReset.mock.calls[0][0];
    expect(email).toMatchObject({ to: 'admin@uniguide.cm', name: 'Test Admin', minutes: 30 });
    expect(email.link).toMatch(/\/reset-password\?token=[A-Za-z0-9_-]{43}$/);
  });

  test('answers exactly the same for an unknown email and sends nothing', async () => {
    const { app, mailer } = buildApp();
    const res = await forgot(app, 'nobody@uniguide.cm').expect(200);
    expect(res.body.message).toBe(GENERIC);
    expect(mailer.sendPasswordReset).not.toHaveBeenCalled();
  });

  test('still answers 200 if the mail server fails', async () => {
    const { app, mailer } = buildApp();
    mailer.sendPasswordReset.mockRejectedValueOnce(new Error('SMTP down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await createAdmin();

    await forgot(app, 'admin@uniguide.cm').expect(200);
    await new Promise((r) => setImmediate(r));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('could not send'), 'SMTP down');
    spy.mockRestore();
  });

  test.each([['a bad email', 'nope'], ['an injected email', { $ne: '' }]])('rejects %s with 400', async (_label, email) => {
    const { app, mailer } = buildApp();
    await forgot(app, email).expect(400);
    expect(mailer.sendPasswordReset).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/reset-password', () => {
  async function requestReset() {
    const ctx = buildApp();
    const admin = await createAdmin({ failedLoginAttempts: 2, lockoutUntil: new Date(Date.now() + 600_000) });
    await forgot(ctx.app, admin.email).expect(200);
    return { ...ctx, admin, token: tokenFromEmail(ctx.mailer) };
  }

  test('sets the new argon2id password; the old one stops working', async () => {
    const { app, admin, token } = await requestReset();

    const res = await reset(app, token, 'brand-new-password').expect(200);
    expect(res.body.message).toMatch(/password has been reset/);

    const stored = await Admin.findById(admin._id).select('+password');
    expect(stored.password).toMatch(/^\$argon2id\$/);
    expect(stored.passwordChangedAt).toBeInstanceOf(Date);

    await request(app).post('/api/auth/login').send({ email: admin.email, password: DEFAULT_PASSWORD }).expect(400);
    await request(app).post('/api/auth/login').send({ email: admin.email, password: 'brand-new-password' }).expect(200);
  });

  test('lifts a lockout', async () => {
    const { app, admin, token } = await requestReset();
    await reset(app, token, 'brand-new-password').expect(200);
    const stored = await Admin.findById(admin._id);
    expect(stored.lockoutUntil).toBeNull();
    expect(stored.failedLoginAttempts).toBe(0);
  });

  test('ends every existing session and refresh token', async () => {
    const ctx = buildApp();
    const admin = await createAdmin();
    await ctx.agent.post('/api/auth/login').send({ email: admin.email, password: DEFAULT_PASSWORD }).expect(200);
    await forgot(ctx.app, admin.email).expect(200);

    await reset(ctx.app, tokenFromEmail(ctx.mailer), 'brand-new-password').expect(200);

    await ctx.agent.get('/api/auth/me').expect(401);
    await ctx.agent.post('/api/auth/refresh').expect(401);
    expect(await RefreshToken.countDocuments({ admin: admin._id, revokedAt: null })).toBe(0);
  });

  test('the link works only once', async () => {
    const { app, token } = await requestReset();
    await reset(app, token, 'brand-new-password').expect(200);
    const res = await reset(app, token, 'another-password').expect(400);
    expect(res.body.message).toMatch(/invalid or has expired/);
  });

  test('an expired link is refused', async () => {
    const { app, admin, token } = await requestReset();
    await PasswordResetToken.updateMany({ admin: admin._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await reset(app, token, 'brand-new-password').expect(400);
  });

  test('only the newest link works when several were requested', async () => {
    const { app, mailer, admin, token: first } = await requestReset();
    await forgot(app, admin.email).expect(200);
    const second = tokenFromEmail(mailer, 1);

    await reset(app, first, 'brand-new-password').expect(400);
    await reset(app, second, 'brand-new-password').expect(200);
  });

  test('a weak new password is refused without using up the link', async () => {
    const { app, token } = await requestReset();
    const res = await reset(app, token, 'short').expect(400);
    expect(res.body.message).toMatch(/at least 8/);
    await reset(app, token, 'brand-new-password').expect(200);
  });

  test.each([['missing', undefined], ['made up', 'x'.repeat(43)], ['an object', { $ne: null }]])(
    'a %s token is refused',
    async (_label, token) => {
      const { app } = buildApp();
      await reset(app, token, 'brand-new-password').expect(400);
    },
  );
});
