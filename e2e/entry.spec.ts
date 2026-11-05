import { card, expect, openApp, outsideEditor, palette, placeCursor, test } from './support.ts'
import type { Page } from '@playwright/test'

const REWRITE = 'The support team spends most of the day answering the same questions.'

async function expectEveryCommandEnabled(page: Page): Promise<void> {
  await expect(page.getByRole('option')).toHaveCount(7)
  await expect(page.locator('[role=option]:disabled')).toHaveCount(0)
}

test.describe('every entry point works in one click, with nothing selected', () => {
  test('the Commands button names the first section and produces a suggestion', async ({ page, suggest }) => {
    await openApp(page)
    await page.getByRole('button', { name: /Commands/ }).click()
    await expect(palette(page)).toContainText('on “Why now”')
    await expectEveryCommandEnabled(page)

    suggest.reply(REWRITE)
    await page.keyboard.press('Enter')
    await expect(card(page)).toContainText('Accept all')
    expect(suggest.requests[0]).toMatchObject({ target: 'section', context: { heading: 'Why now' } })
    expect(suggest.requests[0]?.selection).toContain('Right now the support team')
  })

  test('/ on a fresh page names the first section and produces a suggestion', async ({ page, suggest }) => {
    await openApp(page)
    await page.keyboard.press('/')
    await expect(palette(page)).toContainText('on “Why now”')
    await expectEveryCommandEnabled(page)

    suggest.reply(REWRITE)
    await page.getByRole('option', { name: 'Shorter' }).click()
    await expect(card(page)).toContainText('Accept all')
    expect(suggest.requests[0]?.instruction).toBe('Make it shorter.')
  })

  for (const prompt of ['Make “Why now” shorter', 'Make the success metric measurable', 'Make the safety section more formal']) {
    test(`"${prompt}" produces a suggestion`, async ({ page, suggest }) => {
      await openApp(page)
      suggest.reply('A stubbed rewrite of this section.')
      await page.getByRole('button', { name: prompt }).click()
      await expect(card(page)).toContainText('Accept all')
      expect(suggest.requests[0]?.target).toBe('section')
    })
  }
})

test.describe('what the palette targets', () => {
  test('scrolled down, it names the section nearest the top of the viewport', async ({ page, suggest }) => {
    await page.setViewportSize({ width: 1440, height: 420 })
    await openApp(page)
    await page.locator('.tiptap h2', { hasText: "How we'll keep it safe" }).evaluate((heading) => {
      heading.scrollIntoView({ block: 'start' })
    })

    await page.getByRole('button', { name: /Commands/ }).click()
    await expect(palette(page)).toContainText("on “How we'll keep it safe”")

    suggest.reply('A stubbed rewrite of this section.')
    await page.keyboard.press('Enter')
    await expect(card(page)).toContainText('Accept all')
    expect(suggest.requests[0]?.selection).toContain('Every answer the assistant writes')
  })

  test('a cursor you placed wins over where you scrolled', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 420 })
    await openApp(page)
    await placeCursor(page, '.tiptap p', 'Right now', 'end')
    await page.locator('.tiptap h2', { hasText: 'Success metrics' }).evaluate((heading) => {
      heading.scrollIntoView({ block: 'start' })
    })

    await page.getByRole('button', { name: /Commands/ }).click()
    await expect(palette(page)).toContainText('on “Why now”')
  })

  test('a cursor on the title uses the section nearest the top of the viewport', async ({ page }) => {
    await openApp(page)
    await placeCursor(page, '.tiptap h1', 'AI rollout plan', 'end')
    await page.getByRole('button', { name: /Commands/ }).click()
    await expect(palette(page)).toContainText('on “Why now”')
    await expectEveryCommandEnabled(page)
  })

  test('from outside the editor, / uses the same rule', async ({ page }) => {
    await openApp(page)
    await outsideEditor(page).click()
    await page.keyboard.press('/')
    await expect(palette(page)).toContainText('on “Why now”')
  })

  test('with no text anywhere it says to write first, and offers no commands', async ({ page }) => {
    await openApp(page)
    await placeCursor(page, '.tiptap h1', 'AI rollout plan', 'end')
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
    await page.keyboard.press('/')
    await expect(palette(page)).toContainText('Write something first, then ask')
    await expect(page.getByRole('option')).toHaveCount(0)
  })
})
