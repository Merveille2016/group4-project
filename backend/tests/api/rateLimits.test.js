const request = require('supertest');
const { connectTestDb, clearTestDb, disconnectTestDb, buildApp, createAdmin, DEFAULT_PASSWORD } = require('../helpers');

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

// Tiny limits so each endpoint's limiter trips quickly
const TIGHT = {
  login: { windowMinutes: 15, max: 2 },
  register: { windowMinutes: 60, max: 2 },
  refresh: { windowMinutes: 15, max: 2 },
  forgotPassword: { windowMinutes: 15, max: 2 },
  forgotPasswordPerEmail: { windowMinutes: 60, max: 2 },
  resetPassword: { windowMinutes: 15, max: 2 },
};

const post = (app, path, body) => request(app).post(`/api/auth${path}`).send(body);

describe('rate limits on the real auth endpoints', () => {
  test('login: failed attempts from one network are capped, across accounts', async () => {
    const { app } = buildApp({ rateLimits: TIGHT });
    await createAdmin();
    await post(app, '/login', { email: 'a@uniguide.cm', password: 'wrong-one' }).expect(400);
    await post(app, '/login', { email: 'b@uniguide.cm', password: 'wrong-two' }).expect(400);
    const res = await post(app, '/login', { email: 'admin@uniguide.cm', password: DEFAULT_PASSWORD }).expect(429);
    expect(res.body.message).toMatch(/Too many failed login attempts/);
  });

  test('login: successful logins never use up the budget', async () => {
    const { app } = buildApp({ rateLimits: TIGHT });
    await createAdmin();
    for (let i = 0; i < 5; i++) {
      await post(app, '/login', { email: 'admin@uniguide.cm', password: DEFAULT_PASSWORD }).expect(200);
    }
  });

  test('register', async () => {
    const { app } = buildApp({ rateLimits: TIGHT });
    const body = (n) => ({ name: 'N', email: `user${n}@uniguide.cm`, password: 'long-enough-pw' });
    await post(app, '/register', body(1)).expect(201);
    await post(app, '/register', body(2)).expect(201);
    await post(app, '/register', body(3)).expect(429);
  });

  test('refresh', async () => {
    const { app } = buildApp({ rateLimits: TIGHT });
    await post(app, '/refresh').expect(401);
    await post(app, '/refresh').expect(401);
    await post(app, '/refresh').expect(429);
  });

  test('forgot password', async () => {
    const { app } = buildApp({ rateLimits: TIGHT });
    await post(app, '/forgot-password', { email: 'one@uniguide.cm' }).expect(200);
    await post(app, '/forgot-password', { email: 'two@uniguide.cm' }).expect(200);
    await post(app, '/forgot-password', { email: 'three@uniguide.cm' }).expect(429);
  });

  test('reset password', async () => {
    const { app } = buildApp({ rateLimits: TIGHT });
    await post(app, '/reset-password', { token: 'x'.repeat(43), password: 'long-enough-pw' }).expect(400);
    await post(app, '/reset-password', { token: 'x'.repeat(43), password: 'long-enough-pw' }).expect(400);
    await post(app, '/reset-password', { token: 'x'.repeat(43), password: 'long-enough-pw' }).expect(429);
  });

  test('using up one endpoint leaves the others working', async () => {
    const { app } = buildApp({ rateLimits: TIGHT });
    await createAdmin();
    for (let i = 0; i < 3; i++) await post(app, '/forgot-password', { email: `x${i}@uniguide.cm` });
    await post(app, '/forgot-password', { email: 'y@uniguide.cm' }).expect(429);

    await post(app, '/login', { email: 'admin@uniguide.cm', password: DEFAULT_PASSWORD }).expect(200);
    await post(app, '/register', { name: 'N', email: 'new@uniguide.cm', password: 'long-enough-pw' }).expect(201);
  });
});
