import { Hono } from 'hono'
import {
  MAX_CONTEXT_CHARS,
  MAX_INSTRUCTION_CHARS,
  MAX_SELECTION_CHARS,
  SUGGEST_PATH,
} from '../shared/contract.ts'
import type {
  SuggestContext,
  SuggestErrorBody,
  SuggestErrorCode,
  SuggestRequest,
} from '../shared/contract.ts'
import { callModel } from './openRouter.ts'

export interface AppOptions {
  apiKey: string
  model: string
  fetchFn?: typeof fetch
}

const HTTP_STATUS = {
  bad_request: 400,
  missing_api_key: 500,
  upstream_error: 502,
  invalid_model_output: 502,
} as const satisfies Record<SuggestErrorCode, number>

function errorBody(code: SuggestErrorCode, message: string): SuggestErrorBody {
  return { error: { code, message } }
}

export function createApp({ apiKey, model, fetchFn }: AppOptions) {
  const app = new Hono()

  app.post(SUGGEST_PATH, async (c) => {
    if (apiKey === '') {
      return c.json(
        errorBody('missing_api_key', 'No API key found. Add OPENROUTER_API_KEY to your .env file and restart.'),
        HTTP_STATUS.missing_api_key,
      )
    }

    const request = parseSuggestRequest(await c.req.json().catch(() => null))
    if (request === null) {
      return c.json(
        errorBody('bad_request', "That request couldn't be sent. Try a shorter selection."),
        HTTP_STATUS.bad_request,
      )
    }

    const result = await callModel(request, { apiKey, model, fetchFn, signal: c.req.raw.signal })
    if (!result.ok) {
      // The detail is written by us and never includes request headers.
      console.error(`[suggest] ${result.code}: ${result.detail}`)
      return c.json(errorBody(result.code, result.message), HTTP_STATUS[result.code])
    }

    return c.json(result.suggestion)
  })

  return app
}

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max
}

function parseContextField(value: unknown): string | null | undefined {
  if (value === null) return null
  return isBoundedString(value, MAX_CONTEXT_CHARS) ? value : undefined
}

function parseContext(value: unknown): SuggestContext | null | undefined {
  if (value === null) return null
  if (typeof value !== 'object') return undefined

  const { heading, before, after } = value as Record<string, unknown>
  const parsed = {
    heading: parseContextField(heading),
    before: parseContextField(before),
    after: parseContextField(after),
  }
  if (parsed.heading === undefined || parsed.before === undefined || parsed.after === undefined) {
    return undefined
  }
  return { heading: parsed.heading, before: parsed.before, after: parsed.after }
}

/** Returns null for anything that doesn't match the contract. */
export function parseSuggestRequest(body: unknown): SuggestRequest | null {
  if (typeof body !== 'object' || body === null) return null

  const { selection, target, instruction, currentSuggestion, context } = body as Record<string, unknown>
  if (!isBoundedString(selection, MAX_SELECTION_CHARS) || selection.trim() === '') return null
  if (target !== 'selection' && target !== 'section') return null
  if (!isBoundedString(instruction, MAX_INSTRUCTION_CHARS) || instruction.trim() === '') return null

  // A rewrite can legitimately be longer than the selection it replaces.
  const suggestion = currentSuggestion ?? null
  if (suggestion !== null && !isBoundedString(suggestion, MAX_SELECTION_CHARS * 2)) return null

  const parsedContext = parseContext(context ?? null)
  if (parsedContext === undefined) return null

  return { selection, target, instruction, currentSuggestion: suggestion, context: parsedContext }
}
