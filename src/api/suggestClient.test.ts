import { describe, expect, it, vi } from 'vitest'
import type { SuggestRequest } from '../../shared/contract'
import { requestSuggestion } from './suggestClient'

const request: SuggestRequest = {
  selection: 'Text.',
  target: 'selection',
  instruction: 'Make it shorter.',
  currentSuggestion: null,
  context: null,
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('requestSuggestion', () => {
  it('returns the suggestion', async () => {
    const suggestion = { rewrite: 'Short.', rationale: 'Cut.' }
    const result = await requestSuggestion(request, new AbortController().signal, async () => json(suggestion))
    expect(result).toEqual({ ok: true, suggestion })
  })

  it('passes on the error code and message from the server', async () => {
    const body = { error: { code: 'budget_exhausted', message: 'No credit.' } }
    const result = await requestSuggestion(request, new AbortController().signal, async () => json(body, 402))
    expect(result).toEqual({ ok: false, aborted: false, code: 'budget_exhausted', message: 'No credit.' })
  })

  it('the client reports an unreachable server', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch')
    })
    const result = await requestSuggestion(request, new AbortController().signal, fetchFn)
    expect(result).toMatchObject({ ok: false, aborted: false, code: 'network' })
  })

  it('a reply that is not JSON counts as an unreachable server', async () => {
    // The dev proxy answers like this when the API server isn't running.
    const fetchFn = vi.fn<typeof fetch>(async () => new Response('Internal Server Error', { status: 500 }))
    const result = await requestSuggestion(request, new AbortController().signal, fetchFn)
    expect(result).toMatchObject({ ok: false, aborted: false, code: 'network' })
  })

  it('cancel aborts the request', async () => {
    const controller = new AbortController()
    const fetchFn = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )
    const pending = requestSuggestion(request, controller.signal, fetchFn)
    controller.abort()

    expect(await pending).toEqual({ ok: false, aborted: true })
    expect(fetchFn.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  })
})
