const request = require('supertest');
const Admin = require('../../models/Admin');
const RefreshToken = require('../../models/RefreshToken');
const config = require('../../config');
const { sha256 } = require('../../services/tokenUtils');
const {
  connectTestDb, clearTestDb, disconnectTestDb, buildApp, createAdmin,
  DEFAULT_PASSWORD, REFRESH_COOKIE, SESSION_COOKIE, getCookie, getCookieHeader,
} = require('../helpers');

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

async function loggedInAgent() {
  const ctx = buildApp();
  const admin = await createAdmin();
  const res = await ctx.agent.post('/api/auth/login').send({ email: admin.email, password: DEFAULT_PASSWORD }).expect(200);
  return { ...ctx, admin, refreshToken: getCookie(res, REFRESH_COOKIE) };
}

const withRefreshCookie = (req, token) => req.set('Cookie', `${REFRESH_COOKIE}=${token}`);

describe('GET /api/auth/me', () => {
  test('returns the logged in account in the shape the frontend reads', async () => {
    const { agent, admin } = await loggedInAgent();
    const res = await agent.get('/api/auth/me').expect(200);
    expect(res.body).toEqual({
      admin: { id: String(admin._id), name: 'Test Admin', email: 'admin@uniguide.cm', role: 'admin', tokenVersion: 1 },
    });
  });

  test('is 401 without a session', async () => {
    const { app } = buildApp();
    await request(app).get('/api/auth/me').expect(401);
  });

  test('a session from before a newer login stops working (tokenVersion)', async () => {
    const { agent, app, admin } = await loggedInAgent();
    await request(app).post('/api/auth/login').send({ email: admin.email, password: DEFAULT_PASSWORD }).expect(200);

    const res = await agent.get('/api/auth/me').expect(401);
    expect(res.body.message).toMatch(/session has ended/);
  });

  test('a session for a deleted account stops working', async () => {
    const { agent, admin } = await loggedInAgent();
    await Admin.deleteOne({ _id: admin._id });
    const res = await agent.get('/api/auth/me').expect(401);
    expect(res.body.message).toMatch(/no longer exists/);
  });

  test('the protected dashboard route uses the same check', async () => {
    const { agent } = await loggedInAgent();
    const res = await agent.get('/api/admin/secret-dashboard').expect(200);
    expect(res.body.adminEmail).toBe('admin@uniguide.cm');
  });
});

describe('POST /api/auth/refresh', () => {
  test('rotates the refresh cookie and starts a new session', async () => {
    const { app, refreshToken } = await loggedInAgent();

    const res = await withRefreshCookie(request(app).post('/api/auth/refresh'), refreshToken).expect(200);

    const next = getCookie(res, REFRESH_COOKIE);
    expect(next).toBeDefined();
    expect(next).not.toBe(refreshToken);
    expect(getCookieHeader(res, REFRESH_COOKIE)).toMatch(/HttpOnly/);
    expect(res.body.admin.email).toBe('admin@uniguide.cm');

    // The new session cookie works on its own
    const sessionCookie = getCookieHeader(res, SESSION_COOKIE).split(';')[0];
    await request(app).get('/api/auth/me').set('Cookie', sessionCookie).expect(200);
  });

  test('keeps a login alive after the session itself is gone', async () => {
    const { app, refreshToken } = await loggedInAgent();
    // After the idle timeout the browser only has the refresh cookie left
    await request(app).get('/api/auth/me').expect(401);

    const res = await withRefreshCookie(request(app).post('/api/auth/refresh'), refreshToken).expect(200);
    const sessionCookie = getCookieHeader(res, SESSION_COOKIE).split(';')[0];
    await request(app).get('/api/auth/me').set('Cookie', sessionCookie).expect(200);
  });

  test('is 401 and clears cookies without a refresh cookie', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/api/auth/refresh').expect(401);
    expect(res.body.message).toBe('Please log in again.');
    expect(getCookieHeader(res, REFRESH_COOKIE)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  test('replaying an old refresh token logs out every device in that chain', async () => {
    const { app, refreshToken } = await loggedInAgent();
    const first = await withRefreshCookie(request(app).post('/api/auth/refresh'), refreshToken).expect(200);
    const current = getCookie(first, REFRESH_COOKIE);

    // Past the race grace period, an attacker replays the stolen original
    await RefreshToken.updateOne(
      { tokenHash: sha256(refreshToken) },
      { $set: { revokedAt: new Date(Date.now() - (config.refreshToken.reuseGraceSeconds + 5) * 1000) } },
    );
    await withRefreshCookie(request(app).post('/api/auth/refresh'), refreshToken).expect(401);

    // ...and the real user's newer token is now dead as well
    await withRefreshCookie(request(app).post('/api/auth/refresh'), current).expect(401);
  });

  test('a race between two tabs leaves the winner\'s cookie alone', async () => {
    const { app, refreshToken } = await loggedInAgent();
    await withRefreshCookie(request(app).post('/api/auth/refresh'), refreshToken).expect(200);
    const loser = await withRefreshCookie(request(app).post('/api/auth/refresh'), refreshToken).expect(401);
    expect(getCookieHeader(loser, REFRESH_COOKIE)).toBeUndefined();
  });

  test('a refresh token from before a newer login is refused', async () => {
    const { app, admin, refreshToken } = await loggedInAgent();
    await request(app).post('/api/auth/login').send({ email: admin.email, password: DEFAULT_PASSWORD }).expect(200);
    await withRefreshCookie(request(app).post('/api/auth/refresh'), refreshToken).expect(401);
  });
});

describe('POST /api/auth/logout', () => {
  test('ends the session, revokes refresh tokens, clears both cookies', async () => {
    const { agent, admin, app, refreshToken } = await loggedInAgent();

    const res = await agent.post('/api/auth/logout').expect(200);
    expect(res.body.message).toBe('Logged out successfully');
    expect(getCookieHeader(res, SESSION_COOKIE)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(getCookieHeader(res, REFRESH_COOKIE)).toMatch(/Expires=Thu, 01 Jan 1970/);

    await agent.get('/api/auth/me').expect(401);
    await withRefreshCookie(request(app).post('/api/auth/refresh'), refreshToken).expect(401);
    expect(await RefreshToken.countDocuments({ admin: admin._id, revokedAt: null })).toBe(0);
  });

  test('bumps tokenVersion so the account is logged out everywhere', async () => {
    const { agent, admin } = await loggedInAgent();
    await agent.post('/api/auth/logout').expect(200);
    expect((await Admin.findById(admin._id)).tokenVersion).toBe(2);
  });

  test('works with only the refresh cookie (session already expired)', async () => {
    const { app, admin, refreshToken } = await loggedInAgent();
    await withRefreshCookie(request(app).post('/api/auth/logout'), refreshToken).expect(200);
    expect(await RefreshToken.countDocuments({ admin: admin._id, revokedAt: null })).toBe(0);
    expect((await Admin.findById(admin._id)).tokenVersion).toBe(2);
  });

  test('is safe to call when not logged in', async () => {
    const { app } = buildApp();
    await request(app).post('/api/auth/logout').expect(200);
  });
});

describe('DELETE /api/auth/me', () => {
  test('needs the right password, then removes the account and its tokens', async () => {
    const { agent, admin } = await loggedInAgent();

    await agent.delete('/api/auth/me').send({ password: 'wrong-password' }).expect(400);
    await agent.delete('/api/auth/me').send({ password: DEFAULT_PASSWORD }).expect(200);

    expect(await Admin.exists({ _id: admin._id })).toBeNull();
    expect(await RefreshToken.countDocuments({ admin: admin._id })).toBe(0);
    await agent.get('/api/auth/me').expect(401);
  });
});
