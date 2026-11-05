import { test as base, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { SUGGEST_PATH } from '../shared/contract.ts'
import type { SuggestErrorCode, SuggestRequest } from '../shared/contract.ts'

type Reply =
  | { kind: 'suggestion'; rewrite: string; rationale: string }
  | { kind: 'error'; status: number; code: SuggestErrorCode; message: string }
  | { kind: 'networkFailure' }
  | { kind: 'hang' }

/**
 * Stands in for the API. Each test queues the replies it expects, and a request
 * with none queued fails that test, so nothing can pass by reaching further.
 */
export class SuggestStub {
  readonly requests: SuggestRequest[] = []
  readonly unexpected: string[] = []
  readonly blockedHosts: string[] = []
  private readonly queue: Reply[] = []

  reply(rewrite: string, rationale = 'A stubbed rationale.'): void {
    this.queue.push({ kind: 'suggestion', rewrite, rationale })
  }

  fail(status: number, code: SuggestErrorCode, message: string): void {
    this.queue.push({ kind: 'error', status, code, message })
  }

  failNetwork(): void {
    this.queue.push({ kind: 'networkFailure' })
  }

  /** Never answers, like a slow model, until the browser aborts the request. */
  hang(): void {
    this.queue.push({ kind: 'hang' })
  }

  async handle(route: Route): Promise<void> {
    const request = route.request()
    if (new URL(request.url()).pathname !== SUGGEST_PATH) {
      this.unexpected.push(request.url())
      await route.abort()
      return
    }

    this.requests.push(request.postDataJSON() as SuggestRequest)
    const next = this.queue.shift()

    if (!next) {
      this.unexpected.push(`a call with no reply queued: ${request.postData()}`)
      await route.abort()
    } else if (next.kind === 'suggestion') {
      await route.fulfill({ json: { rewrite: next.rewrite, rationale: next.rationale } })
    } else if (next.kind === 'error') {
      await route.fulfill({ status: next.status, json: { error: { code: next.code, message: next.message } } })
    } else if (next.kind === 'networkFailure') {
      await route.abort('failed')
    }
    // A hang leaves the route unanswered on purpose.
  }
}

export const isLocal = (url: URL) => url.hostname === '127.0.0.1' || url.hostname === 'localhost'

/** Applies to every test automatically, so no test can forget to stub the API. */
export const test = base.extend<{ suggest: SuggestStub }>({
  suggest: [
    async ({ context }, provide) => {
      const stub = new SuggestStub()
      await context.route(
        (url) => !isLocal(url),
        async (route) => {
          stub.blockedHosts.push(new URL(route.request().url()).hostname)
          await route.abort()
        },
      )
      // By path, not a glob like **/api/**, which would also catch src/api/ source files.
      await context.route(
        (url) => isLocal(url) && url.pathname.startsWith('/api/'),
        (route) => stub.handle(route),
      )

      await provide(stub)

      expect(stub.unexpected, 'requests the test did not expect').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** Opens the app and waits for the editor. */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/')
  // Longer than the default 5s as a margin for a busy machine. Vite is already warm
  // here: see globalSetup.ts. A real break still ends the run: see maxFailures.
  await expect(page.locator('.tiptap')).toBeVisible({ timeout: 15_000 })
}

export function docText(page: Page): Promise<string> {
  return page.locator('.tiptap').innerText()
}

/** Selects text inside one block, the way a mouse drag ends up doing. */
export async function selectText(page: Page, text: string): Promise<void> {
  await page.evaluate((wanted) => {
    const walker = document.createTreeWalker(document.querySelector('.tiptap') as Node, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const index = node.textContent?.indexOf(wanted) ?? -1
      if (index >= 0) {
        const range = document.createRange()
        range.setStart(node, index)
        range.setEnd(node, index + wanted.length)
        const selection = getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        return
      }
    }
    throw new Error(`Text not found: ${wanted}`)
  }, text)
  await expect(page.getByRole('toolbar')).toBeVisible()
}

/**
 * Puts the cursor at the start or end of a block. Home and End only reach the
 * visual line. The pause matters: ProseMirror learns about the cursor from the
 * selectionchange event, and a script's next key can arrive before it. A person
 * can't type that fast, but a test can, and the key would act on the old position.
 */
export async function placeCursor(page: Page, selector: string, text: string, edge: 'start' | 'end'): Promise<void> {
  await page.evaluate(
    ({ selector, text, edge }) => {
      const block = [...document.querySelectorAll<HTMLElement>(selector)].find((element) =>
        element.innerText.includes(text),
      )
      if (!block) throw new Error('Block not found: ' + text)
      document.querySelector<HTMLElement>('.tiptap')?.focus()
      const range = document.createRange()
      range.selectNodeContents(block)
      range.collapse(edge === 'start')
      const selection = getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    },
    { selector, text, edge },
  )
  await page.waitForTimeout(100)
}

/** Asks for a command from the selection pill. */
export async function pillCommand(page: Page, text: string, command: string): Promise<void> {
  await selectText(page, text)
  await page.getByRole('toolbar').getByRole('button', { name: command, exact: true }).click()
}

export const card = (page: Page) => page.getByRole('complementary', { name: 'Co-author' })
export const palette = (page: Page) => page.getByRole('dialog', { name: 'Commands' })

/** Somewhere to click that isn't the editor or an input. */
export const outsideEditor = (page: Page) => page.getByRole('heading', { name: /Document/ })

export const SAFE_SENTENCE = 'We are going to log every suggestion and whether it was accepted'
/** Against SAFE_SENTENCE this is two separate changes, under the block threshold. */
export const SAFE_REWRITE = 'We will log all suggestions and whether it was accepted'
