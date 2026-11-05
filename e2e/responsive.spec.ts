import { card, docText, expect, openApp, palette, SAFE_REWRITE, SAFE_SENTENCE, selectText, test } from './support.ts'
import type { Page } from '@playwright/test'
import type { SuggestStub } from './support.ts'

const WIDTHS = [375, 768, 1024, 1280, 1920]
const REORDERED = [
  '- Weekly reviews of what the assistant got wrong so we can actually improve it over time.',
  '- An AI assistant that drafts answers for the most common tickets, which an agent always reviews before sending.',
  '- A shared knowledge base so the assistant and the team are working from the same information.',
].join('\n')

/** Nothing sticks out sideways, and every control is reachable and big enough. */
async function expectHealthy(page: Page, state: string): Promise<void> {
  const report = await page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const controls = [...document.querySelectorAll<HTMLElement>('button, input')].filter(
      (element) => element.tabIndex !== -1 && element.offsetParent !== null,
    )
    const label = (element: HTMLElement) => element.innerText || element.getAttribute('aria-label') || element.id
    return {
      sideways: document.documentElement.scrollWidth - width,
      small: controls.filter((element) => element.getBoundingClientRect().height < 44).map(label),
      offscreen: controls
        .filter((element) => {
          const box = element.getBoundingClientRect()
          return box.left < -1 || box.right > width + 1
        })
        .map(label),
    }
  })
  expect(report, `${state}`).toEqual({ sideways: 0, small: [], offscreen: [] })
}

/** Text in a thin column is the failure we saw: one letter per line. */
async function expectNotCrushed(page: Page, selector: string, minWidth: number): Promise<void> {
  const box = await page.locator(selector).first().boundingBox()
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(minWidth)
}

async function askAboutFirstSection(page: Page, suggest: SuggestStub, rewrite: string): Promise<void> {
  suggest.reply(rewrite)
  await page.getByRole('button', { name: /Commands/ }).click()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Accept all' })).toBeVisible()
}

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
    })

    test('first open', async ({ page }) => {
      await openApp(page)
      await expectHealthy(page, 'first open')
      await expectNotCrushed(page, '.tiptap h1', 250)
      await expectNotCrushed(page, 'article', 300)
    })

    test('the document and card do not overlap', async ({ page }) => {
      await openApp(page)
      const sheet = await page.locator('article').boundingBox()
      const panel = await card(page).boundingBox()
      if (!sheet || !panel) throw new Error('Not visible')
      const apartSideways = panel.x >= sheet.x + sheet.width || sheet.x >= panel.x + panel.width
      const apartVertically = panel.y >= sheet.y + sheet.height || sheet.y >= panel.y + panel.height
      expect(apartSideways || apartVertically).toBe(true)
    })

    test('the selection pill stays on screen in all its views', async ({ page }) => {
      await openApp(page)
      await selectText(page, SAFE_SENTENCE)
      await expectHealthy(page, 'pill actions')

      await page.getByRole('button', { name: /^Tone/ }).click()
      await expect(page.getByRole('button', { name: 'Keep my wording' })).toBeVisible()
      await expectHealthy(page, 'pill tone')

      await page.keyboard.press('Escape')
      await expect(page.getByRole('toolbar')).toBeHidden()
      await selectText(page, 'Right now the support team')
      await page.getByRole('button', { name: 'Ask', exact: true }).click()
      await expect(page.getByLabel(/What should/)).toBeVisible()
      await expectHealthy(page, 'pill ask')
    })

    test('the pill still works next to the screen edge, and at the top', async ({ page, suggest }) => {
      await openApp(page)
      await selectText(page, 'AI rollout')
      await expectHealthy(page, 'pill at the top left')
      suggest.reply('A rollout')
      await page.getByRole('toolbar').getByRole('button', { name: 'Shorter', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Accept all' })).toBeVisible()
    })

    test('the pill stays reachable when the selected text is out of view', async ({ page }) => {
      await page.setViewportSize({ width, height: 400 })
      await openApp(page)

      // Below the viewport.
      await selectText(page, "We'll know it's working")
      await expect(page.getByRole('toolbar')).toBeInViewport({ ratio: 1 })

      // Above the viewport, after scrolling past it.
      await selectText(page, 'AI rollout')
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await expect(page.getByRole('toolbar')).toBeInViewport({ ratio: 1 })
    })

    test('the palette header stays readable and the list reachable', async ({ page }) => {
      await openApp(page)
      await page.getByRole('button', { name: /Commands/ }).click()
      await expect(palette(page)).toContainText('on “Why now”')
      await expectHealthy(page, 'palette')
      await expectNotCrushed(page, '[role=dialog] span', 250)

      // The header is one or two lines, not a thin column.
      const header = await palette(page).getByText('/ commands').boundingBox()
      expect(header?.height ?? 999).toBeLessThanOrEqual(40)

      await page.getByRole('option', { name: 'Make it measurable' }).scrollIntoViewIfNeeded()
      await expect(page.getByRole('option', { name: 'Make it measurable' })).toBeInViewport()

      // These stay out of the tab order, so the general check above doesn't see them.
      const heights = await page
        .getByRole('option')
        .evaluateAll((options) => options.map((option) => option.getBoundingClientRect().height))
      expect(heights.filter((height) => height < 44)).toEqual([])
    })

    test('the palette with no text', async ({ page }) => {
      await openApp(page)
      await page.locator('.tiptap h1').click()
      await page.keyboard.press('ControlOrMeta+a')
      await page.keyboard.press('Backspace')
      await page.getByRole('button', { name: /Commands/ }).click()
      await expect(palette(page)).toContainText('Write something first, then ask')
      await expectHealthy(page, 'palette with no text')
    })

    test('the shortcuts dialog', async ({ page }) => {
      await openApp(page)
      await page.getByRole('button', { name: /Shortcuts/ }).click()
      await expect(page.getByRole('button', { name: 'Got it' })).toBeVisible()
      await expectHealthy(page, 'shortcuts')
    })

    test('loading', async ({ page, suggest }) => {
      await openApp(page)
      suggest.hang()
      await page.getByRole('button', { name: /Commands/ }).click()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
      await expectHealthy(page, 'loading')
    })

    test('an error, in view with Retry', async ({ page, suggest }) => {
      await openApp(page)
      suggest.fail(402, 'budget_exhausted', 'The credit on this API key has run out. Your document is unchanged.')
      await page.getByRole('button', { name: /Commands/ }).click()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('button', { name: 'Retry' })).toBeInViewport()
      await expectHealthy(page, 'error')
    })

    test('reviewing a word-by-word suggestion', async ({ page, suggest }) => {
      await openApp(page)
      suggest.reply(SAFE_REWRITE, 'A stubbed rationale that is long enough to wrap onto more than one line in the card.')
      await selectText(page, SAFE_SENTENCE)
      await page.getByRole('toolbar').getByRole('button', { name: 'Shorter', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Keep', exact: true })).toBeVisible()
      await expectHealthy(page, 'review')

      await page.getByRole('button', { name: 'Keep', exact: true }).click()
      await expect(page.getByRole('button', { name: /^Apply/ })).toBeVisible()
      await expectHealthy(page, 'review with a decision')
    })

    test('reviewing a restructured section as a block', async ({ page, suggest }) => {
      await openApp(page)
      await page.locator('.tiptap li', { hasText: 'A shared knowledge base' }).scrollIntoViewIfNeeded()
      await page.locator('.tiptap li', { hasText: 'A shared knowledge base' }).click()
      await page.waitForTimeout(100)
      await askAboutFirstSection(page, suggest, REORDERED)
      await expect(card(page)).toContainText('This reorganizes the section')
      await expectHealthy(page, 'block')
    })

    test('refine history and a failed refine', async ({ page, suggest }) => {
      await openApp(page)
      suggest.reply(SAFE_REWRITE)
      await selectText(page, SAFE_SENTENCE)
      await page.getByRole('toolbar').getByRole('button', { name: 'Shorter', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Warmer' })).toBeVisible()

      suggest.reply('We will warmly log all suggestions and whether it was accepted')
      await page.getByRole('button', { name: 'Warmer' }).click()
      await expect(page.getByRole('list', { name: 'Refine history' })).toBeVisible()
      await expectHealthy(page, 'refine history')

      suggest.failNetwork()
      await page.getByRole('button', { name: 'More formal' }).click()
      await expect(page.getByRole('button', { name: 'Retry' })).toBeInViewport()
      await expectHealthy(page, 'failed refine')
    })

    test('the toast after applying', async ({ page, suggest }) => {
      await openApp(page)
      suggest.reply(SAFE_REWRITE)
      await selectText(page, SAFE_SENTENCE)
      await page.getByRole('toolbar').getByRole('button', { name: 'Shorter', exact: true }).click()
      await page.getByRole('button', { name: 'Accept all' }).click()
      await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()
      await expectHealthy(page, 'toast')
    })

    test('a long unbroken word or link does not push the page sideways', async ({ page }) => {
      await openApp(page)
      await page.locator('.tiptap p', { hasText: "We'll know it's working" }).scrollIntoViewIfNeeded()
      await page.locator('.tiptap p', { hasText: "We'll know it's working" }).click()
      await page.waitForTimeout(100)
      await page.keyboard.type('https://example.com/' + 'a'.repeat(120))
      await expectHealthy(page, 'long word')
    })

    test('every entry point produces a suggestion', async ({ page, suggest }) => {
      await openApp(page)

      suggest.reply('A stubbed rewrite from the Commands button.')
      await page.getByRole('button', { name: /Commands/ }).click()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('button', { name: 'Accept all' })).toBeVisible()
      await page.getByRole('button', { name: 'Reject all' }).click()

      await page.reload()
      await expect(page.locator('.tiptap')).toBeAttached()
      suggest.reply('A stubbed rewrite from the slash key.')
      await page.keyboard.press('/')
      await expect(palette(page)).toBeVisible()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('button', { name: 'Accept all' })).toBeVisible()
      await page.getByRole('button', { name: 'Reject all' }).click()

      await page.reload()
      await expect(page.locator('.tiptap')).toBeAttached()
      suggest.reply('A stubbed rewrite from Try one.')
      await page.getByRole('button', { name: 'Make “Why now” shorter' }).click()
      await expect(page.getByRole('button', { name: 'Accept all' })).toBeVisible()

      expect(suggest.requests).toHaveLength(3)
      expect(suggest.requests.every((request) => request.target === 'section')).toBe(true)
    })
  })
}

test.describe('stacked layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
  })

  test('the card sits below the document, and the sidebar is a bar on top', async ({ page }) => {
    await openApp(page)
    const sheet = await page.locator('article').boundingBox()
    const panel = await card(page).boundingBox()
    const bar = await page.locator('[data-app-bar]').boundingBox()
    if (!sheet || !panel || !bar) throw new Error('Not visible')
    expect(panel.y).toBeGreaterThanOrEqual(sheet.y + sheet.height)
    expect(bar.y).toBe(0)
    expect(bar.height).toBeLessThanOrEqual(61)
  })

  test('when a suggestion arrives, the card scrolls into view below the bar', async ({ page, suggest }) => {
    await openApp(page)
    await expect(card(page)).not.toBeInViewport()

    suggest.reply(SAFE_REWRITE)
    await selectText(page, SAFE_SENTENCE)
    await page.getByRole('toolbar').getByRole('button', { name: 'Shorter', exact: true }).click()

    const diff = card(page).locator('del').first()
    await expect(diff).toBeInViewport()
    const panel = await card(page).boundingBox()
    expect(panel?.y ?? -1).toBeGreaterThanOrEqual(60)
  })

  test('a refine answer brings the card back into view, but stepping through history does not move it', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply(SAFE_REWRITE, 'First answer.')
    await selectText(page, SAFE_SENTENCE)
    await page.getByRole('toolbar').getByRole('button', { name: 'Shorter', exact: true }).click()
    await expect(card(page)).toContainText('First answer.')

    suggest.reply('We will warmly log all suggestions and whether it was accepted', 'Second answer.')
    await page.getByRole('button', { name: 'Warmer' }).click()
    await expect(card(page)).toContainText('Second answer.')
    await expect(card(page).getByText('Second answer.')).toBeInViewport()

    const before = await page.evaluate(() => scrollY)
    await page.getByRole('list', { name: 'Refine history' }).getByRole('button', { name: 'Shorter' }).click()
    await expect(card(page)).toContainText('First answer.')
    expect(await page.evaluate(() => scrollY)).toBe(before)
  })

  test('after accepting, the changed text is back in view, and one undo restores it', async ({ page, suggest }) => {
    await openApp(page)
    const original = await docText(page)
    suggest.reply(SAFE_REWRITE)
    await selectText(page, SAFE_SENTENCE)
    await page.getByRole('toolbar').getByRole('button', { name: 'Shorter', exact: true }).click()
    await page.getByRole('button', { name: 'Accept all' }).click()

    await expect(page.locator('.tiptap p', { hasText: SAFE_REWRITE })).toBeInViewport()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => docText(page)).toBe(original)
  })

  test('after rejecting, the text is back in view', async ({ page, suggest }) => {
    await openApp(page)
    suggest.reply(SAFE_REWRITE)
    await selectText(page, SAFE_SENTENCE)
    await page.getByRole('toolbar').getByRole('button', { name: 'Shorter', exact: true }).click()
    await expect(card(page).locator('del').first()).toBeInViewport()
    await page.getByRole('button', { name: 'Reject all' }).click()
    await expect(page.locator('.tiptap p', { hasText: 'Every answer' })).toBeInViewport()
  })

  test('scrolled down, the palette names the section under the bar, not behind it', async ({ page }) => {
    await openApp(page)
    await page.locator('.tiptap h2', { hasText: "How we'll keep it safe" }).evaluate((heading) => {
      window.scrollTo(0, heading.getBoundingClientRect().top + scrollY - 70)
    })
    await page.getByRole('button', { name: /Commands/ }).click()
    await expect(palette(page)).toContainText("on “How we'll keep it safe”")
  })

  test('the Commands button stays reachable while scrolled', async ({ page }) => {
    await openApp(page)
    await page.evaluate(() => window.scrollTo(0, 900))
    await expect(page.getByRole('button', { name: /Commands/ })).toBeInViewport()
  })

  test('key hints are hidden where there are no keys to press', async ({ page }) => {
    await openApp(page)
    await expect(page.getByText('Select any sentence to ask for a rewrite')).toBeVisible()
    await expect(page.locator('kbd:visible')).toHaveCount(0)
    await page.getByRole('button', { name: /Commands/ }).click()
    await expect(page.getByText('to move')).toBeHidden()
  })
})

test.describe('copy', () => {
  test('the hint reads as one sentence, with no gap before the comma', async ({ page }) => {
    await openApp(page)
    const text = await page.getByText('Select any sentence to ask for a rewrite').innerText()
    expect(text.replace(/\s+/g, ' ').trim()).toBe('Select any sentence to ask for a rewrite, or press /')

    const before = await page.evaluate(() => {
      const hint = [...document.querySelectorAll('p')].find((p) => p.innerText.startsWith('Select any sentence'))
      return hint ? [...hint.children].filter((child) => child.tagName === 'SPAN').length : 0
    })
    // The dot and one run of text. A separate flex item would put a gap before the comma.
    expect(before).toBe(2)
  })
})

test.describe('side by side', () => {
  test('at 1024px and up the card is beside the document, and sticks while the page scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 500 })
    await openApp(page)
    const sheet = await page.locator('article').boundingBox()
    const panel = await card(page).boundingBox()
    if (!sheet || !panel) throw new Error('Not visible')
    expect(panel.x).toBeGreaterThanOrEqual(sheet.x + sheet.width)

    await page.evaluate(() => window.scrollTo(0, 300))
    await expect(card(page).getByText('Nothing to review yet')).toBeInViewport()
  })

  test('a suggestion leaves the text where it is on screen', async ({ page, suggest }) => {
    await page.setViewportSize({ width: 1280, height: 500 })
    await openApp(page)
    await page.evaluate(() => window.scrollTo(0, 200))
    const paragraph = page.locator('.tiptap p', { hasText: 'Right now' })
    const before = await paragraph.boundingBox()

    suggest.reply(SAFE_REWRITE)
    await selectText(page, 'Right now the support team')
    await page.getByRole('toolbar').getByRole('button', { name: 'Shorter', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Accept all' })).toBeVisible()

    // Compared on screen, not by scrollY: the hint above goes away after the first
    // ask, and the browser adjusts scrollY so the text doesn't jump.
    const after = await paragraph.boundingBox()
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(1)
  })
})
