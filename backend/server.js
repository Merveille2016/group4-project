require('dotenv').config();

const mongoose = require('mongoose');
const { MongoStore } = require('connect-mongo');
const config = require('./config');
const { createApp } = require('./app');
const { pendingMigrations } = require('./migrations/runner');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
  console.log('Database Name:', mongoose.connection.db.databaseName);

  const pending = await pendingMigrations(mongoose.connection.db);
  if (pending.length > 0) {
    console.warn(`⚠️  ${pending.length} database migration(s) not applied yet: ${pending.join(', ')}`);
    console.warn('   Run `npm run migrate` to apply them.');
  }

  const app = createApp({
    sessionStore: MongoStore.create({ mongoUrl: process.env.MONGO_URI, collectionName: 'sessions' }),
  });

  console.log(`✅ CORS CONFIGURED: Only allowing ${config.clientUrls.join(', ')}`);

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error('❌ FAILED to start the server:');
  console.error(error.message);
  process.exit(1);
});
