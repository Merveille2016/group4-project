const crypto = require('crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../app');
const Admin = require('../models/Admin');
const RefreshToken = require('../models/RefreshToken');
const PasswordResetToken = require('../models/PasswordResetToken');
const { hashPassword } = require('../services/password');
const config = require('../config');

const DEFAULT_PASSWORD = 'correct-horse-battery';

// Each test file works in its own database, so files never see each other's data
async function connectTestDb() {
  if (!process.env.TEST_MONGO_URI) throw new Error('TEST_MONGO_URI not set; is tests/globalSetup.js running?');
  const dbName = `uniguide_test_${crypto.randomBytes(4).toString('hex')}`;
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName });
  await Promise.all([Admin.init(), RefreshToken.init(), PasswordResetToken.init()]);
}

// Refuses to touch anything but the throwaway database this file created
function assertTestDb() {
  const name = mongoose.connection.db?.databaseName || '';
  if (!name.startsWith('uniguide_test_')) throw new Error(`Refusing to modify non-test database "${name}"`);
}

async function clearTestDb() {
  assertTestDb();
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

// Drops each collection rather than the database: Atlas users with plain readWrite
// rights may not drop databases, and MongoDB removes a database once it's empty anyway
async function dropTestCollections() {
  assertTestDb();
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.drop().catch(() => {})));
}

async function disconnectTestDb() {
  if (mongoose.connection.readyState === 1) await dropTestCollections();
  await mongoose.disconnect();
}

// Fresh app (and fresh rate limit counters) with a fake mailer that records reset emails
function buildApp({ rateLimits } = {}) {
  const mailer = { sendPasswordReset: jest.fn().mockResolvedValue() };
  const app = createApp({ mailer, rateLimits });
  return { app, mailer, agent: request.agent(app) };
}

async function createAdmin({ password = DEFAULT_PASSWORD, ...fields } = {}) {
  return Admin.create({
    name: 'Test Admin',
    email: 'admin@uniguide.cm',
    password: await hashPassword(password),
    ...fields,
  });
}

// Value of a cookie from a response's Set-Cookie header, or undefined
function getCookie(res, name) {
  const header = (res.headers['set-cookie'] || []).find((c) => c.startsWith(`${name}=`));
  if (!header) return undefined;
  return decodeURIComponent(header.split(';')[0].slice(name.length + 1));
}

function getCookieHeader(res, name) {
  return (res.headers['set-cookie'] || []).find((c) => c.startsWith(`${name}=`));
}

const REFRESH_COOKIE = config.refreshToken.cookieName;
const SESSION_COOKIE = config.session.cookieName;

module.exports = {
  DEFAULT_PASSWORD,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  connectTestDb,
  clearTestDb,
  dropTestCollections,
  disconnectTestDb,
  buildApp,
  createAdmin,
  getCookie,
  getCookieHeader,
};
