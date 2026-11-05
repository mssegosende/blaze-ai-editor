import { chromium } from '@playwright/test'
import type { FullConfig } from '@playwright/test'
import { isLocal } from './support.ts'

/**
 * Loads the app once before any worker starts, so Vite compiles it for one page
 * rather than for every worker at once. If the app can't load, the run stops here.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ baseURL: config.projects[0].use.baseURL })
    // The test fixture doesn't apply here, so the same rule is set by hand: no real API, no outside hosts.
    await page.route(
      (url) => !isLocal(url) || url.pathname.startsWith('/api/'),
      (route) => route.abort(),
    )
    await page.goto('/')
    await page.locator('.tiptap').waitFor({ state: 'visible', timeout: 60_000 })
  } finally {
    await browser.close()
  }
}
