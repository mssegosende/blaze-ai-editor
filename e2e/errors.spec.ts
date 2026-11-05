import { card, docText, expect, openApp, pillCommand, SAFE_REWRITE, SAFE_SENTENCE, test } from './support.ts'

test.describe('loading and cancel', () => {
  test('Cancel aborts the request and leaves the document unchanged', async ({ page, suggest }) => {
    await openApp(page)
    const original = await docText(page)
    const aborted = page.waitForEvent('requestfailed', (request) => request.url().includes('/api/suggest'))

    suggest.hang()
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await expect(card(page)).toContainText('Thinking')
    await expect(page.locator('.blaze-thinking')).not.toHaveCount(0)

    await page.getByRole('button', { name: 'Cancel' }).click()
    await aborted

    await expect(card(page)).toContainText('Nothing to review')
    await expect(page.getByText('Cancelled. Your text is unchanged.')).toBeVisible()
    await expect(page.locator('.blaze-target-block')).toHaveCount(0)
    expect(await docText(page)).toBe(original)
  })

  test('cancelling a refine keeps the suggestion', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply(SAFE_REWRITE, 'First answer.')
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await expect(card(page)).toContainText('First answer.')

    suggest.hang()
    await page.getByRole('button', { name: 'Warmer' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(card(page)).toContainText('First answer.')
    await expect(page.getByRole('button', { name: 'Accept all' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0)
  })
})

test.describe('errors', () => {
  for (const { status, code, message, heading } of [
    {
      status: 500,
      code: 'missing_api_key',
      message: 'No API key found. Add OPENROUTER_API_KEY to your .env file and restart.',
      heading: 'Add your API key',
    },
    {
      status: 402,
      code: 'budget_exhausted',
      message: 'The credit on this API key has run out. Your document is unchanged.',
      heading: 'Out of credit',
    },
  ] as const) {
    test(`${code} says what happened and leaves the document unchanged`, async ({ page, suggest }) => {
      await openApp(page)
      const original = await docText(page)
      suggest.fail(status, code, message)
      await pillCommand(page, SAFE_SENTENCE, 'Shorter')

      await expect(page.getByRole('alert')).toHaveText(message)
      await expect(card(page)).toContainText(heading)
      expect(await docText(page)).toBe(original)
    })
  }

  test('an unreachable server says so', async ({ page, suggest }) => {
    await openApp(page)
    suggest.failNetwork()
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await expect(card(page)).toContainText("Can't reach the server")
  })

  test('a failure makes no second call until Retry, which makes exactly one', async ({ page, suggest }) => {
    await openApp(page)
    suggest.failNetwork()
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await expect(page.getByRole('alert')).toBeVisible()

    // Long enough for any automatic retry to have shown itself.
    await page.waitForTimeout(500)
    expect(suggest.requests).toHaveLength(1)

    suggest.reply(SAFE_REWRITE)
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByRole('button', { name: 'Accept all' })).toBeVisible()

    expect(suggest.requests).toHaveLength(2)
    expect(suggest.requests[1]).toEqual(suggest.requests[0])
  })

  test('a failed refine keeps the suggestion and offers Retry', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply(SAFE_REWRITE, 'First answer.')
    await pillCommand(page, SAFE_SENTENCE, 'Shorter')
    await expect(card(page)).toContainText('First answer.')

    suggest.failNetwork()
    await page.getByRole('button', { name: 'Warmer' }).click()
    await expect(page.getByRole('alert')).toContainText('Your current suggestion is still here.')
    await expect(card(page)).toContainText('First answer.')
    await expect(page.getByRole('button', { name: 'Accept all' })).toBeVisible()

    suggest.reply('We will warmly log all suggestions and whether it was accepted', 'Second answer.')
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(card(page)).toContainText('Second answer.')
    expect(suggest.requests[2]).toEqual(suggest.requests[1])
  })
})
