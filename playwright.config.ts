import { defineConfig, devices } from '@playwright/test'

const PORT = 5199

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/globalSetup.ts',
  reporter: 'list',
  forbidOnly: true,
  // If the app doesn't compile, every test would wait out its timeout. Stop early instead.
  maxFailures: 5,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1440, height: 1000 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: {
    // Vite only. The API server, the one thing that holds the key, never runs here.
    command: `pnpm exec vite --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
  },
})
