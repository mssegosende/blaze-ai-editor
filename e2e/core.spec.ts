import { card, docText, expect, openApp, pillCommand, placeCursor, SAFE_REWRITE, SAFE_SENTENCE, selectText, test } from './support.ts'

test.describe('first open', () => {
  test('a new user sees the hint and prompts, and one click gets a suggestion', async ({ page, suggest }) => {
    await openApp(page)
    const original = await docText(page)
    const hint = page.getByText('Select any sentence to ask for a rewrite')
    await expect(hint).toBeVisible()
    await expect(page.getByRole('button', { name: /^Make / })).toHaveCount(3)

    suggest.reply("We'll know it's working when median first response drops from [X] to [Y] by [date].")
    await page.getByRole('button', { name: 'Make the success metric measurable' }).click()

    await expect(card(page)).toContainText('Accept all')
    await expect(hint).toBeHidden()
    expect(suggest.requests[0]).toMatchObject({
      target: 'section',
      selection: "We'll know it's working when tickets get answered faster.",
      context: { heading: 'Success metrics' },
    })
    expect(await docText(page)).toBe(original)
  })

  test('a prompt disappears with its section and returns on undo', async ({ page }) => {
    await openApp(page)
    await page.locator('.tiptap h2', { hasText: 'Success metrics' }).click({ clickCount: 3 })
    await page.keyboard.press('Backspace')
    await expect(page.getByRole('button', { name: /^Make / })).toHaveCount(2)

    await page.keyboard.press('ControlOrMeta+z')
    await expect(page.getByRole('button', { name: /^Make / })).toHaveCount(3)
  })
})

test.describe('asking', () => {
  test('free text works on the first request, and only the selection is sent', async ({ page, suggest }) => {
    await openApp(page)
    const original = await docText(page)

    suggest.reply('Should we log every suggestion and whether it was accepted?')
    await selectText(page, SAFE_SENTENCE)
    await page.getByRole('button', { name: 'Ask', exact: true }).click()
    await page.getByLabel(/What should/).fill('Turn this into a question')
    await page.keyboard.press('Enter')

    await expect(card(page)).toContainText('Accept all')
    expect(suggest.requests[0]).toEqual({
      selection: SAFE_SENTENCE,
      target: 'selection',
      instruction: 'Turn this into a question',
      currentSuggestion: null,
      context: {
        heading: "How we'll keep it safe",
        before: null,
        after: null,
      },
    })
    expect(await docText(page)).toBe(original)
  })

  test('suggestions work on text the user just typed', async ({ page, suggest }) => {
    await openApp(page)
    await placeCursor(page, '.tiptap p', "We'll know it's working", 'end')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(100)
    await page.keyboard.type('i think this sentance has a typo')

    suggest.reply('I think this sentence has a typo.')
    await page.locator('.tiptap p', { hasText: 'sentance' }).click({ clickCount: 3 })
    await page.getByRole('toolbar').getByRole('button', { name: 'Fix grammar' }).click()
    await expect(card(page)).toContainText('Accept all')
    expect(suggest.requests[0]?.selection).toBe('i think this sentance has a typo')

    await page.getByRole('button', { name: 'Accept all' }).click()
    await expect(page.locator('.tiptap')).toContainText('I think this sentence has a typo.')
    await expect(page.locator('.tiptap')).not.toContainText('sentance')
  })
})

test.describe('reviewing', () => {
  test('the diff shows in the card and the document stays as it was', async ({ page, suggest }) => {
    await openApp(page)
    const original = await docText(page)
    suggest.reply(SAFE_REWRITE, 'Tightened the opening.')
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')

    await expect(card(page)).toContainText('Tightened the opening.')
    await expect(card(page).locator('del').first()).toBeVisible()
    await expect(card(page).locator('ins').first()).toBeVisible()
    await expect(page.getByText('Change 1 of 2')).toBeVisible()
    expect(await docText(page)).toBe(original)
  })

  test('partial accept applies only the kept change, and clicking selects a change', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply(SAFE_REWRITE)
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')

    await card(page).getByRole('button', { name: /^Change 2:/ }).click()
    await expect(page.getByText('Change 2 of 2')).toBeVisible()
    await page.getByRole('button', { name: 'Previous change' }).click()
    await expect(page.getByText('Change 1 of 2')).toBeVisible()

    await page.getByRole('button', { name: 'Keep', exact: true }).click()
    await expect(page.getByText('Change 2 of 2')).toBeVisible()
    await page.getByRole('button', { name: 'Discard', exact: true }).click()
    await page.getByRole('button', { name: 'Apply · 1 kept, 1 dropped' }).click()

    await expect(page.locator('.tiptap')).toContainText('We will log every suggestion and whether it was accepted')
  })

  test('the toast Undo restores the document in one step', async ({ page, suggest }) => {
    await openApp(page)
    const original = await docText(page)
    suggest.reply(SAFE_REWRITE)
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await page.getByRole('button', { name: 'Accept all' }).click()
    await expect(page.locator('.tiptap')).toContainText(SAFE_REWRITE)

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => docText(page)).toBe(original)
  })

  test('editing the paragraph discards the suggestion with a notice', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply(SAFE_REWRITE)
    await pillCommand(page, SAFE_SENTENCE, 'Rewrite')
    await expect(card(page)).toContainText('Accept all')

    await placeCursor(page, '.tiptap p', 'Every answer', 'end')
    await page.keyboard.type('x')

    await expect(page.getByText('You edited this text, so the suggestion was discarded.')).toBeVisible()
    await expect(card(page)).toContainText('Nothing to review')
  })

  test('editing another paragraph keeps the suggestion, and accept lands in the right place', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply(SAFE_REWRITE)
    await pillCommand(page, SAFE_SENTENCE, 'Rewrite')
    await expect(card(page)).toContainText('Accept all')

    await placeCursor(page, '.tiptap p', 'Right now', 'start')
    await page.keyboard.type('Added words. ')
    await expect(card(page)).toContainText('Accept all')

    await page.getByRole('button', { name: 'Accept all' }).click()
    await expect(page.locator('.tiptap p', { hasText: 'Every answer' })).toContainText(SAFE_REWRITE)
    await expect(page.locator('.tiptap p', { hasText: 'Right now' })).toContainText('Added words. Right now')
  })
})

test.describe('refining', () => {
  test('a refine sends the original, the current suggestion and the instruction', async ({ page, suggest }) => {
    await openApp(page)
    const original = await docText(page)
    suggest.reply(SAFE_REWRITE)
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await expect(card(page)).toContainText('Accept all')

    suggest.reply('We will record all suggestions and whether each was accepted')
    await page.getByRole('button', { name: 'More formal' }).click()
    await expect(page.getByRole('list', { name: 'Refine history' })).toBeVisible()

    suggest.reply('We record all suggestions and whether each was accepted')
    await page.getByLabel(/Tell .* what to change/).fill('Drop the future tense')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('list', { name: 'Refine history' })).toContainText('Drop the future tense')

    expect(suggest.requests.map((request) => request.selection)).toEqual([SAFE_SENTENCE, SAFE_SENTENCE, SAFE_SENTENCE])
    expect(suggest.requests[0]?.currentSuggestion).toBeNull()
    expect(suggest.requests[1]?.currentSuggestion).toBe(SAFE_REWRITE)
    expect(suggest.requests[2]?.instruction).toBe('Drop the future tense')
    expect(await docText(page)).toBe(original)
  })

  test('stepping back through the history makes no call', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply(SAFE_REWRITE, 'First answer.')
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await expect(card(page)).toContainText('First answer.')

    suggest.reply('We will record all suggestions and whether each was accepted', 'Second answer.')
    await page.getByRole('button', { name: 'Warmer' }).click()
    await expect(card(page)).toContainText('Second answer.')

    await page.getByRole('list', { name: 'Refine history' }).getByRole('button', { name: 'Shorter' }).click()
    await expect(card(page)).toContainText('First answer.')
    expect(suggest.requests).toHaveLength(2)
  })
})

test.describe('restructuring', () => {
  const REORDERED = [
    '- Weekly reviews of what the assistant got wrong so we can actually improve it over time.',
    '- An AI assistant that drafts answers for the most common tickets, which an agent always reviews before sending.',
    '- A shared knowledge base so the assistant and the team are working from the same information.',
  ].join('\n')

  test('a restructured section is one block, all or nothing, and one undo restores it', async ({ page, suggest }) => {
    await openApp(page)
    const original = await docText(page)
    await placeCursor(page, '.tiptap li p', 'A shared knowledge base', 'end')
    await page.getByRole('button', { name: /Commands/ }).click()

    suggest.reply(REORDERED, 'Moved the weekly reviews to the top.')
    await page.getByLabel(/something else/).fill('Put the weekly reviews first')
    await page.keyboard.press('Enter')

    await expect(card(page)).toContainText('This reorganizes the text')
    await expect(card(page)).toContainText('Before')
    await expect(card(page)).toContainText('After')
    await expect(page.getByRole('button', { name: 'Keep', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Discard', exact: true })).toHaveCount(0)
    expect(suggest.requests[0]?.target).toBe('section')
    expect(await docText(page)).toBe(original)

    await page.getByRole('button', { name: 'Accept all' }).click()
    const items = page.locator('.tiptap li')
    await expect(items).toHaveCount(3)
    await expect(items.first()).toContainText('Weekly reviews')
    await expect(page.locator('.tiptap h2')).toHaveCount(4)

    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(() => docText(page)).toBe(original)
  })

  test('rewording a section in place keeps word-by-word review', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply('Right now the support team spends most of their day answering the same questions.')
    await page.getByRole('button', { name: 'Make “Why now” shorter' }).click()
    await expect(page.getByRole('button', { name: 'Keep', exact: true })).toBeVisible()
    await expect(card(page)).not.toContainText('This reorganizes the text')
  })
})
