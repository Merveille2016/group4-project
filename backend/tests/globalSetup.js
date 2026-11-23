// Starts one throwaway in-memory MongoDB for the whole test run.
// Set TEST_MONGO_URI to use another server instead (each test file still gets its own
// randomly named database, which is dropped when the file finishes).
module.exports = async () => {
  if (process.env.TEST_MONGO_URI) return;

  const { MongoMemoryServer } = require('mongodb-memory-server');
  const server = await MongoMemoryServer.create();
  globalThis.__MONGO_SERVER__ = server;
  process.env.TEST_MONGO_URI = server.getUri();
};
