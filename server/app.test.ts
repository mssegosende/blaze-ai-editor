import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_SELECTION_CHARS, SUGGEST_PATH } from '../shared/contract.ts'
import type { SuggestErrorBody } from '../shared/contract.ts'
import { createApp } from './app.ts'

const API_KEY = 'test-key-value'
const validBody = {
  selection: 'The original.',
  target: 'selection',
  instruction: 'Make it shorter.',
  currentSuggestion: null,
  context: null,
}

function modelReply(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
}

async function errorCode(response: Response) {
  return ((await response.json()) as SuggestErrorBody).error.code
}

function post(app: ReturnType<typeof createApp>, body: unknown) {
  return app.request(SUGGEST_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/suggest', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the rewrite and rationale', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      modelReply('{"rewrite":"Short.","rationale":"Cut filler."}'),
    )
    const response = await post(createApp({ apiKey: API_KEY, model: 'm', fetchFn }), validBody)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ rewrite: 'Short.', rationale: 'Cut filler.' })
  })

  it('asks for the strict schema and skips providers that would ignore it', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      modelReply('{"rewrite":"Short.","rationale":"Cut filler."}'),
    )
    await post(createApp({ apiKey: API_KEY, model: 'chosen/model', fetchFn }), validBody)

    const sent = JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body))
    expect(sent.model).toBe('chosen/model')
    expect(sent.response_format.json_schema.strict).toBe(true)
    expect(sent.provider.require_parameters).toBe(true)
  })

  it('a model failure makes no second call', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response('down', { status: 503 }))
    const response = await post(createApp({ apiKey: API_KEY, model: 'm', fetchFn }), validBody)

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(502)
    expect(await errorCode(response)).toBe('upstream_error')
  })

  it('malformed model output is an error, not a suggestion', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => modelReply('Sure! Here is your rewrite.'))
    const response = await post(createApp({ apiKey: API_KEY, model: 'm', fetchFn }), validBody)

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(502)
    expect(await errorCode(response)).toBe('invalid_model_output')
  })

  it('a network failure becomes a readable error', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed')
    })
    const response = await post(createApp({ apiKey: API_KEY, model: 'm', fetchFn }), validBody)

    expect(response.status).toBe(502)
    expect(await errorCode(response)).toBe('upstream_error')
  })

  it.each([
    ['no credit (402)', new Response('{"error":{"message":"Insufficient credits"}}', { status: 402 })],
    ['a key over its cap (403)', new Response('{"error":{"message":"Key limit exceeded"}}', { status: 403 })],
  ])('an exhausted budget is reported as budget_exhausted: %s', async (_label, upstream) => {
    const fetchFn = vi.fn<typeof fetch>(async () => upstream)
    const response = await post(createApp({ apiKey: API_KEY, model: 'm', fetchFn }), validBody)

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(402)
    expect(await errorCode(response)).toBe('budget_exhausted')
  })

  it('any other 403 is not reported as an exhausted budget', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response('flagged by moderation', { status: 403 }))
    const response = await post(createApp({ apiKey: API_KEY, model: 'm', fetchFn }), validBody)
    expect(await errorCode(response)).toBe('upstream_error')
  })

  it('upstream error text is never passed to the browser', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response('secret upstream detail', { status: 500 }))
    const response = await post(createApp({ apiKey: API_KEY, model: 'm', fetchFn }), validBody)
    expect(await response.text()).not.toContain('secret upstream detail')
  })

  it('a missing key is reported without calling the model', async () => {
    const fetchFn = vi.fn<typeof fetch>()
    const response = await post(createApp({ apiKey: '', model: 'm', fetchFn }), validBody)

    expect(fetchFn).not.toHaveBeenCalled()
    expect(response.status).toBe(500)
    expect(await errorCode(response)).toBe('missing_api_key')
  })

  it.each([
    ['an empty selection', { ...validBody, selection: '  ' }],
    ['an oversized selection', { ...validBody, selection: 'x'.repeat(MAX_SELECTION_CHARS + 1) }],
    ['a missing instruction', { selection: 'The original.', target: 'selection' }],
    ['an unknown target', { ...validBody, target: 'document' }],
    ['a malformed context', { ...validBody, context: { heading: 42 } }],
    ['a non-object body', 'hello'],
  ])('rejects %s without calling the model', async (_label, body) => {
    const fetchFn = vi.fn<typeof fetch>()
    const response = await post(createApp({ apiKey: API_KEY, model: 'm', fetchFn }), body)

    expect(fetchFn).not.toHaveBeenCalled()
    expect(response.status).toBe(400)
  })

  it('the key goes to OpenRouter and never into a response or a log', async () => {
    const errorLog = vi.spyOn(console, 'error')
    const fetchFn = vi.fn<typeof fetch>(async () => new Response('denied', { status: 401 }))
    const response = await post(createApp({ apiKey: API_KEY, model: 'm', fetchFn }), validBody)

    const headers = new Headers(fetchFn.mock.calls[0]?.[1]?.headers)
    expect(headers.get('Authorization')).toBe(`Bearer ${API_KEY}`)
    expect(await response.text()).not.toContain(API_KEY)
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(API_KEY)
  })
})
