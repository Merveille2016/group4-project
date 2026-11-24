import { defineConfig } from '@playwright/test'

const API_PORT = 5055
const WEB_PORT = 5180

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node e2e/server.js',
      url: `http://localhost:${API_PORT}/`,
      env: { E2E_API_PORT: String(API_PORT), CLIENT_URL: `http://localhost:${WEB_PORT}` },
      timeout: 120000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_API_URL: `http://localhost:${API_PORT}` },
    },
  ],
})
