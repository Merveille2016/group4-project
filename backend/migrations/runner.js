const fs = require('fs');
const path = require('path');

// Each migration is NNN-name.js exporting { description, up(db), down(db) }

const COLLECTION = 'migrations';
const FILE_PATTERN = /^\d{3}-[\w-]+\.js$/;

function loadMigrations(dir = __dirname) {
  return fs.readdirSync(dir)
    .filter((file) => FILE_PATTERN.test(file))
    .sort()
    .map((file) => ({ name: file.replace(/\.js$/, ''), ...require(path.join(dir, file)) }));
}

async function appliedRecords(db) {
  const records = db.collection(COLLECTION);
  await records.createIndex({ name: 1 }, { unique: true });
  return records.find().sort({ name: 1 }).toArray();
}

async function pendingMigrations(db, { dir } = {}) {
  const applied = new Set((await appliedRecords(db)).map((r) => r.name));
  return loadMigrations(dir).filter((m) => !applied.has(m.name)).map((m) => m.name);
}

async function status(db, { dir } = {}) {
  const applied = new Map((await appliedRecords(db)).map((r) => [r.name, r.appliedAt]));
  return loadMigrations(dir).map((m) => ({
    name: m.name,
    description: m.description,
    appliedAt: applied.get(m.name) || null,
  }));
}

async function migrateUp(db, { dir, log = () => {} } = {}) {
  const applied = new Set((await appliedRecords(db)).map((r) => r.name));
  const done = [];
  for (const migration of loadMigrations(dir)) {
    if (applied.has(migration.name)) continue;
    log(`↑ ${migration.name}: ${migration.description || ''}`);
    await migration.up(db);
    await db.collection(COLLECTION).insertOne({ name: migration.name, appliedAt: new Date() });
    done.push(migration.name);
  }
  return done;
}

async function migrateDown(db, { dir, log = () => {} } = {}) {
  const records = await appliedRecords(db);
  const last = records[records.length - 1];
  if (!last) return null;

  const migration = loadMigrations(dir).find((m) => m.name === last.name);
  if (!migration) throw new Error(`Migration file for "${last.name}" is missing, cannot revert it`);

  log(`↓ ${migration.name}`);
  await migration.down(db);
  await db.collection(COLLECTION).deleteOne({ name: last.name });
  return last.name;
}

module.exports = { loadMigrations, pendingMigrations, status, migrateUp, migrateDown };
