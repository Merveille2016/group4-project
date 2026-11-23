const request = require('supertest');
const Admin = require('../../models/Admin');
const { connectTestDb, clearTestDb, disconnectTestDb, buildApp, createAdmin, SESSION_COOKIE, REFRESH_COOKIE, getCookie } = require('../helpers');

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

const register = (app, body) => request(app).post('/api/auth/register').send(body);
const valid = { name: 'Jane Doe', email: 'Jane@UniGuide.cm', password: 'long-enough-pw' };

describe('POST /api/auth/register', () => {
  test('creates the account with an argon2id hash and a normalised email', async () => {
    const { app } = buildApp();
    const res = await register(app, valid).expect(201);

    expect(res.body.admin).toEqual({
      id: expect.any(String), name: 'Jane Doe', email: 'jane@uniguide.cm', role: 'admin', tokenVersion: 0, twoFactorEnabled: false,
    });
    expect(res.body.admin).not.toHaveProperty('password');

    const stored = await Admin.findOne({ email: 'jane@uniguide.cm' }).select('+password');
    expect(stored.password).toMatch(/^\$argon2id\$/);
    expect(stored.password).not.toContain(valid.password);
  });

  test('does not log the person in (no session or refresh cookie)', async () => {
    const { app } = buildApp();
    const res = await register(app, valid).expect(201);
    expect(getCookie(res, SESSION_COOKIE)).toBeUndefined();
    expect(getCookie(res, REFRESH_COOKIE)).toBeUndefined();
  });

  test('rejects a duplicate email, whatever its casing, with 409', async () => {
    const { app } = buildApp();
    await createAdmin({ email: 'jane@uniguide.cm' });
    const res = await register(app, valid).expect(409);
    // The landing page matches "already exists" to show its own wording
    expect(res.body.message).toMatch(/already exists/);
  });

  test('two simultaneous sign ups with one email create one account', async () => {
    const { app } = buildApp();
    const results = await Promise.all([register(app, valid), register(app, valid)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await Admin.countDocuments()).toBe(1);
  });

  test.each([
    ['no name', { ...valid, name: '  ' }, /Name is required/],
    ['a bad email', { ...valid, email: 'jane' }, /valid email/],
    ['an injected email', { ...valid, email: { $gt: '' } }, /valid email/],
    ['a short password', { ...valid, password: 'short' }, /at least 8/],
    ['a huge password', { ...valid, password: 'x'.repeat(129) }, /at most 128/],
    ['no body', undefined, /Name is required/],
  ])('rejects %s with 400', async (_label, body, message) => {
    const { app } = buildApp();
    const res = await register(app, body).expect(400);
    expect(res.body.message).toMatch(message);
    expect(await Admin.countDocuments()).toBe(0);
  });

  test('rejects malformed JSON with 400', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/api/auth/register').set('Content-Type', 'application/json').send('{"name":').expect(400);
    expect(res.body.message).toMatch(/not valid JSON/);
  });
});
