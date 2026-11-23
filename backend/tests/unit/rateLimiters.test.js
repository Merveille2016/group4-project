const express = require('express');
const request = require('supertest');
const { createRateLimiters } = require('../../middleware/rateLimiters');

const LIMITS = {
  login: { windowMinutes: 15, max: 2 },
  register: { windowMinutes: 60, max: 2 },
  refresh: { windowMinutes: 15, max: 2 },
  forgotPassword: { windowMinutes: 15, max: 2 },
  forgotPasswordPerEmail: { windowMinutes: 60, max: 2 },
  resetPassword: { windowMinutes: 15, max: 2 },
};

// A tiny app whose routes answer with whatever status the test asks for
function appWith(limiters) {
  const app = express();
  app.use(express.json());
  const reply = (req, res) => res.status(req.body.status || 200).json({ ok: true });
  app.post('/login', limiters.login, reply);
  app.post('/register', limiters.register, reply);
  app.post('/refresh', limiters.refresh, reply);
  app.post('/forgot', limiters.forgotPasswordByIp, limiters.forgotPasswordByEmail, reply);
  app.post('/reset', limiters.resetPassword, reply);
  return app;
}

const post = (app, path, body = {}) => request(app).post(path).send(body);

describe('rate limiters', () => {
  test('login only counts failed attempts', async () => {
    const app = appWith(createRateLimiters(LIMITS));
    for (let i = 0; i < 5; i++) await post(app, '/login', { status: 200 }).expect(200);

    await post(app, '/login', { status: 400 }).expect(400);
    await post(app, '/login', { status: 400 }).expect(400);
    const blocked = await post(app, '/login', { status: 200 }).expect(429);
    expect(blocked.body.message).toMatch(/Too many failed login attempts/);
  });

  test.each(['/register', '/refresh', '/reset'])('%s blocks after its limit with a JSON message', async (path) => {
    const app = appWith(createRateLimiters(LIMITS));
    await post(app, path).expect(200);
    await post(app, path).expect(200);
    const res = await post(app, path).expect(429);
    expect(res.body).toEqual({ message: expect.any(String) });
    expect(res.headers).toHaveProperty('ratelimit-policy');
  });

  test('every endpoint has its own budget', async () => {
    const app = appWith(createRateLimiters(LIMITS));
    await post(app, '/register').expect(200);
    await post(app, '/register').expect(200);
    await post(app, '/register').expect(429);

    // Register is used up, the others are untouched
    await post(app, '/login', { status: 400 }).expect(400);
    await post(app, '/refresh').expect(200);
    await post(app, '/forgot', { email: 'a@b.cm' }).expect(200);
    await post(app, '/reset').expect(200);
  });

  test('forgot password is also limited per email address, whatever its casing', async () => {
    // Network limit set high so only the per-email limit can trigger
    const app = appWith(createRateLimiters({ ...LIMITS, forgotPassword: { windowMinutes: 15, max: 50 } }));
    await post(app, '/forgot', { email: 'Victim@UniGuide.cm' }).expect(200);
    await post(app, '/forgot', { email: 'victim@uniguide.cm ' }).expect(200);
    const res = await post(app, '/forgot', { email: 'VICTIM@uniguide.cm' }).expect(429);
    expect(res.body.message).toMatch(/for this email/);

    // A different address is unaffected
    await post(app, '/forgot', { email: 'someone-else@uniguide.cm' }).expect(200);
  });

  test('forgot password is limited per network across different emails', async () => {
    const app = appWith(createRateLimiters(LIMITS));
    await post(app, '/forgot', { email: 'one@uniguide.cm' }).expect(200);
    await post(app, '/forgot', { email: 'two@uniguide.cm' }).expect(200);
    const res = await post(app, '/forgot', { email: 'three@uniguide.cm' }).expect(429);
    expect(res.body.message).not.toMatch(/for this email/);
  });

  test('separate createRateLimiters calls keep separate counters', async () => {
    const first = appWith(createRateLimiters(LIMITS));
    const second = appWith(createRateLimiters(LIMITS));
    await post(first, '/register').expect(200);
    await post(first, '/register').expect(200);
    await post(first, '/register').expect(429);
    await post(second, '/register').expect(200);
  });
});
