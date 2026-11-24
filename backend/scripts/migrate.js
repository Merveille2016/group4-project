require('dotenv').config();

const { MongoClient } = require('mongoose').mongo;
const { migrateUp, migrateDown, status } = require('../migrations/runner');

async function main() {
  const command = process.argv[2] || 'up';
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set (check backend/.env)');

  const client = await MongoClient.connect(process.env.MONGO_URI);
  try {
    const db = client.db();
    const log = (line) => console.log(line);

    if (command === 'up') {
      const done = await migrateUp(db, { log });
      console.log(done.length ? `✅ Applied ${done.length} migration(s).` : '✅ Database is up to date.');
    } else if (command === 'down') {
      const reverted = await migrateDown(db, { log });
      console.log(reverted ? `✅ Reverted ${reverted}.` : 'Nothing to revert.');
    } else if (command === 'status') {
      for (const m of await status(db)) {
        const when = m.appliedAt ? `applied ${m.appliedAt.toISOString()}` : 'PENDING';
        console.log(`${m.name.padEnd(32)} ${when}`);
      }
    } else {
      throw new Error(`Unknown command "${command}". Use up, down or status.`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
