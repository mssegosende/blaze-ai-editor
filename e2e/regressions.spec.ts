import { card, docText, expect, openApp, palette, pillCommand, placeCursor, SAFE_REWRITE, SAFE_SENTENCE, selectText, test } from './support.ts'

/** Real bugs found by hand in a browser, which no unit test could see. */
test.describe('regressions', () => {
  test('after Apply, focus returns to the document and one Ctrl+Z restores it', async ({ page, suggest }) => {
    await openApp(page)
    const original = await docText(page)

    suggest.reply(SAFE_REWRITE)
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await page.getByRole('button', { name: 'Keep', exact: true }).click()
    await page.getByRole('button', { name: /^Apply/ }).click()

    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()
    expect(await docText(page)).not.toBe(original)
    // The Apply button is gone. Without this, focus would be lost with it.
    await expect(page.locator('.tiptap')).toBeFocused()

    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(() => docText(page)).toBe(original)
  })

  test('after Accept all, focus returns to the document', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply(SAFE_REWRITE)
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await page.getByRole('button', { name: 'Accept all' }).click()
    await expect(page.locator('.tiptap')).toBeFocused()
  })

  test('after Reject all, focus returns to the document', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply(SAFE_REWRITE)
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await page.getByRole('button', { name: 'Reject all' }).click()
    await expect(page.locator('.tiptap')).toBeFocused()
  })

  test('the pill comes back after Cancel, on the very same words', async ({ page, suggest }) => {
    await openApp(page)
    suggest.hang()
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(card(page)).toContainText('Nothing to review')
    await expect(page.locator('.tiptap')).toBeFocused()

    // Choosing the same words again must count as a new selection.
    await selectText(page, SAFE_SENTENCE)
    await expect(page.getByRole('toolbar')).toBeVisible()
  })

  test('the pill comes back after Reject, on the very same words', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply(SAFE_REWRITE)
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await page.getByRole('button', { name: 'Reject all' }).click()
    await expect(page.locator('.tiptap')).toBeFocused()

    await selectText(page, SAFE_SENTENCE)
    await expect(page.getByRole('toolbar')).toBeVisible()
  })

  test('Esc closes the palette when it has no target', async ({ page, suggest }) => {
    await openApp(page)
    // The title has no text of its own, so the palette has nothing to act on.
    await placeCursor(page, '.tiptap h1', 'AI rollout plan', 'end')
    await page.getByRole('button', { name: /Commands/ }).click()
    await expect(palette(page)).toContainText('select text, or put the cursor')

    // Focus has to land inside the palette, or Esc never reaches it.
    await expect(page.getByLabel(/something else/)).toBeFocused()

    await page.keyboard.press('Enter')
    expect(suggest.requests).toHaveLength(0)

    await page.keyboard.press('Escape')
    await expect(palette(page)).toBeHidden()
  })
})
