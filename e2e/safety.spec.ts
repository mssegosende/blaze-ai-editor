import { expect, openApp, pillCommand, SAFE_REWRITE, SAFE_SENTENCE, test } from './support.ts'
import type { Page } from '@playwright/test'

/** Every control that takes keyboard focus. The clickable diff changes are excluded on purpose. */
async function controlHeights(page: Page): Promise<[string, number][]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, input')]
      .filter((element) => element.tabIndex !== -1 && element.offsetParent !== null)
      .map((element): [string, number] => [
        element.innerText || element.getAttribute('aria-label') || element.id,
        Math.round(element.getBoundingClientRect().height),
      ]),
  )
}

function expectTargets(heights: [string, number][]): void {
  expect(heights.length).toBeGreaterThan(0)
  expect(heights.filter(([, height]) => height < 44)).toEqual([])
}

test.describe('44px targets', () => {
  test('first open', async ({ page }) => {
    await openApp(page)
    expectTargets(await controlHeights(page))
  })

  test('the selection pill', async ({ page }) => {
    await openApp(page)
    await pillCommandlessSelect(page)
    expectTargets(await controlHeights(page))
  })

  test('reviewing, with a decision made', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply(SAFE_REWRITE)
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await page.getByRole('button', { name: 'Keep', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Apply/ })).toBeVisible()
    expectTargets(await controlHeights(page))
  })

  test('an error', async ({ page, suggest }) => {
    await openApp(page)
    suggest.failNetwork()
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
    expectTargets(await controlHeights(page))
  })

  test('the refine history', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply(SAFE_REWRITE)
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await expect(page.getByRole('button', { name: 'Warmer' })).toBeVisible()
    suggest.reply('We will warmly log all suggestions and whether it was accepted')
    await page.getByRole('button', { name: 'Warmer' }).click()
    await expect(page.getByRole('list', { name: 'Refine history' })).toBeVisible()
    expectTargets(await controlHeights(page))
  })
})

test.describe('the real API stays out of it', () => {
  test('a suggestion is answered by the stub, with no API host contacted', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply(SAFE_REWRITE)
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await expect(page.getByRole('button', { name: 'Accept all' })).toBeVisible()

    expect(suggest.requests).toHaveLength(1)
    expect(suggest.blockedHosts.filter((host) => host.includes('openrouter'))).toEqual([])
  })

  test('nothing is allowed to leave the machine', async ({ page, suggest }) => {
    await openApp(page)
    const status = await page.evaluate(() =>
      fetch('https://openrouter.ai/api/v1/models').then(
        () => 'reached',
        () => 'blocked',
      ),
    )
    expect(status).toBe('blocked')
    expect(suggest.blockedHosts).toContain('openrouter.ai')
  })
})

async function pillCommandlessSelect(page: Page): Promise<void> {
  await page.locator('.tiptap p', { hasText: 'Right now' }).click({ clickCount: 3 })
  await expect(page.getByRole('toolbar')).toBeVisible()
}
