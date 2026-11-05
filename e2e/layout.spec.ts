import { expect, openApp, test } from './support.ts'
import type { Page } from '@playwright/test'

async function box(page: Page, selector: string) {
  const found = await page.locator(selector).first().boundingBox()
  if (!found) throw new Error(`Not visible: ${selector}`)
  return found
}

test.describe('wide screens', () => {
  for (const width of [1280, 1440, 1920, 2560]) {
    test(`at ${width}px the document and card stay together and centered`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await openApp(page)

      const sidebar = await box(page, 'aside:not([aria-label])')
      const sheet = await box(page, 'article')
      const card = await box(page, 'aside[aria-label="Co-author"]')

      const gap = card.x - (sheet.x + sheet.width)
      expect(gap).toBe(40)

      const leftMargin = sheet.x - (sidebar.x + sidebar.width)
      const rightMargin = width - (card.x + card.width)
      expect(Math.abs(leftMargin - rightMargin)).toBeLessThanOrEqual(1)
    })
  }

  test('the sheet and card keep their design sizes on a wide screen', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 900 })
    await openApp(page)
    expect((await box(page, 'article')).width).toBe(820)
    expect((await box(page, 'aside[aria-label="Co-author"]')).width).toBe(384)
  })
})
