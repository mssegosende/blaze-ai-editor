import { card, docText, expect, openApp, outsideEditor, palette, pillCommand, placeCursor, SAFE_REWRITE, SAFE_SENTENCE, selectText, test } from './support.ts'

test.describe('typing stays typing', () => {
  test('"and/or" in a sentence types a slash and opens nothing', async ({ page }) => {
    await openApp(page)
    const original = await docText(page)
    await placeCursor(page, '.tiptap p', 'Right now', 'end')
    await page.keyboard.type(' and/or')

    await expect(page.locator('.tiptap')).toContainText('and/or')
    await expect(palette(page)).toBeHidden()

    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(() => docText(page)).toBe(original)
  })

  test('a slash and a question mark in the refine field stay text', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply(SAFE_REWRITE)
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    const field = page.getByLabel(/Tell .* what to change/)
    await field.click()
    await page.keyboard.type('and/or?')

    await expect(field).toHaveValue('and/or?')
    await expect(palette(page)).toBeHidden()
    await expect(page.getByRole('dialog', { name: 'Shortcuts' })).toBeHidden()
  })
})

test.describe('the / palette', () => {
  test('on an empty line it opens on the current section, and the slash is not typed', async ({ page }) => {
    await openApp(page)
    await placeCursor(page, '.tiptap p', 'Right now', 'end')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(100)
    await page.keyboard.press('/')

    await expect(palette(page)).toContainText('on “Why now”')
    await expect(page.locator('.tiptap')).not.toContainText('/')
  })

  test('with a selection it runs on the selection, using the arrows and Enter', async ({ page, suggest }) => {
    await openApp(page)
    await selectText(page, SAFE_SENTENCE)
    await page.keyboard.press('/')
    await expect(palette(page)).toContainText("on “How we'll keep it safe”")

    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('option', { selected: true })).toContainText('Shorter')

    suggest.reply(SAFE_REWRITE)
    await page.keyboard.press('Enter')
    await expect(card(page)).toContainText('Accept all')
    expect(suggest.requests[0]).toMatchObject({
      target: 'selection',
      selection: SAFE_SENTENCE,
      instruction: 'Make it shorter.',
    })
  })

  test('with nothing selected it acts on the whole section', async ({ page, suggest }) => {
    await openApp(page)
    await placeCursor(page, '.tiptap p', 'Right now', 'end')
    await page.getByRole('button', { name: /Commands/ }).click()
    await expect(palette(page)).toContainText('on “Why now”')

    suggest.reply('The team answers the same questions all day, so harder tickets wait.')
    await page.keyboard.press('Enter')
    await expect(card(page)).toContainText('Accept all')
    expect(suggest.requests[0]?.target).toBe('section')
    expect(suggest.requests[0]?.selection).toContain('Right now the support team')
    expect(suggest.requests[0]?.selection).not.toContain('What we')
  })

  test('free text works in the palette', async ({ page, suggest }) => {
    await openApp(page)
    await selectText(page, SAFE_SENTENCE)
    await page.keyboard.press('/')
    suggest.reply(SAFE_REWRITE)
    await page.getByLabel(/something else/).fill('Say it in fewer words')
    await page.keyboard.press('Enter')
    await expect(card(page)).toContainText('Accept all')
    expect(suggest.requests[0]?.instruction).toBe('Say it in fewer words')
  })

  test('during a review it refines the suggestion', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply(SAFE_REWRITE)
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await expect(card(page)).toContainText('Accept all')

    await outsideEditor(page).click()
    await page.keyboard.press('/')
    suggest.reply('We record all suggestions and whether each was accepted')
    await page.getByLabel(/something else/).fill('Use the word record')
    await page.keyboard.press('Enter')

    await expect(page.getByRole('list', { name: 'Refine history' })).toBeVisible()
    expect(suggest.requests[1]).toMatchObject({
      selection: SAFE_SENTENCE,
      currentSuggestion: SAFE_REWRITE,
      instruction: 'Use the word record',
    })
  })

  test('Esc closes it', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: /Commands/ }).click()
    await expect(palette(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(palette(page)).toBeHidden()
  })
})

test.describe('shortcuts', () => {
  test('Ctrl+Enter accepts all, and Ctrl+Z from outside the editor undoes it', async ({ page, suggest }) => {
    await openApp(page)
    const original = await docText(page)
    suggest.reply(SAFE_REWRITE)
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await expect(page.getByRole('button', { name: 'Accept all' })).toBeVisible()

    await outsideEditor(page).click()
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(page.locator('.tiptap')).toContainText(SAFE_REWRITE)

    await outsideEditor(page).click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(() => docText(page)).toBe(original)
  })

  test('Esc rejects a suggestion', async ({ page, suggest }) => {
    await openApp(page)
    const original = await docText(page)
    suggest.reply(SAFE_REWRITE)
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await expect(page.getByRole('button', { name: 'Accept all' })).toBeVisible()

    await outsideEditor(page).click()
    await page.keyboard.press('Escape')
    await expect(card(page)).toContainText('Nothing to review')
    expect(await docText(page)).toBe(original)
  })

  test('Esc cancels a request in flight', async ({ page, suggest }) => {
    await openApp(page)
    suggest.hang()
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()

    await outsideEditor(page).click()
    await page.keyboard.press('Escape')
    await expect(card(page)).toContainText('Nothing to review')
  })

  test('Esc closes the pill', async ({ page }) => {
    await openApp(page)
    await selectText(page, SAFE_SENTENCE)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('toolbar')).toBeHidden()
  })

  test('? opens the shortcuts from outside the editor, and Esc closes them', async ({ page }) => {
    await openApp(page)
    await outsideEditor(page).click()
    await page.keyboard.press('?')
    const dialog = page.getByRole('dialog', { name: 'Shortcuts' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('the sidebar buttons open the shortcuts too', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: /Shortcuts/ }).click()
    await expect(page.getByRole('dialog', { name: 'Shortcuts' })).toBeVisible()
    await page.getByRole('button', { name: 'Got it' }).click()
    await expect(page.getByRole('dialog', { name: 'Shortcuts' })).toBeHidden()
  })
})
