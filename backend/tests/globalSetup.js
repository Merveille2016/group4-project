// Set TEST_MONGO_URI to use another server instead
module.exports = async () => {
  if (process.env.TEST_MONGO_URI) return;

  const { MongoMemoryServer } = require('mongodb-memory-server');
  const server = await MongoMemoryServer.create();
  globalThis.__MONGO_SERVER__ = server;
  process.env.TEST_MONGO_URI = server.getUri();
};
