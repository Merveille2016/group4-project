// Backend for the browser tests: the real app on a throwaway in-memory MongoDB
import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(new URL('../../backend/package.json', import.meta.url))
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

const mongo = await MongoMemoryServer.create()
await mongoose.connect(mongo.getUri(), { dbName: 'uniguide_e2e' })

const { createApp } = require('./app')

const resetLinks = new Map()
const mailer = {
  async sendPasswordReset({ to, link }) {
    resetLinks.set(to, link)
  },
}

const roomy = { windowMinutes: 15, max: 10000 }
const app = createApp({
  mailer,
  rateLimits: {
    login: roomy, register: roomy, refresh: roomy, forgotPassword: roomy,
    forgotPasswordPerEmail: roomy, resetPassword: roomy, twoFactorVerify: roomy, twoFactorManage: roomy,
  },
})

// Lets the tests open the reset link that would have been emailed
app.get('/e2e/reset-link', (req, res) => res.json({ link: resetLinks.get(req.query.email) || null }))

const port = Number(process.env.E2E_API_PORT) || 5055
const server = app.listen(port, () => console.log(`e2e backend on http://localhost:${port}`))

async function stop() {
  server.close()
  await mongoose.disconnect()
  await mongo.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
