import type { SuggestErrorCode, SuggestRequest, Suggestion } from '../shared/contract.ts'
import { parseModelOutput } from './parseModelOutput.ts'
import { buildUserMessage, SUGGESTION_SCHEMA, SYSTEM_PROMPT } from './prompt.ts'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 45_000
const MAX_OUTPUT_TOKENS = 4000

export interface ModelUsage {
  promptTokens: number | null
  completionTokens: number | null
  reasoningTokens: number | null
  costUsd: number | null
}

export type ModelResult =
  | { ok: true; suggestion: Suggestion; usage: ModelUsage }
  | { ok: false; code: SuggestErrorCode; message: string; detail: string }

export interface ModelCallOptions {
  apiKey: string
  model: string
  fetchFn?: typeof fetch
  signal?: AbortSignal
}

interface CompletionResponse {
  choices?: { message?: { content?: string | null } }[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    completion_tokens_details?: { reasoning_tokens?: number }
    cost?: number
  }
}

/**
 * One request, one call. A failure is returned, never retried: the user decides
 * whether to spend another call.
 */
export async function callModel(
  request: SuggestRequest,
  { apiKey, model, fetchFn = fetch, signal }: ModelCallOptions,
): Promise<ModelResult> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetchFn(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Blaze',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage(request) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'suggestion', strict: true, schema: SUGGESTION_SCHEMA },
        },
        // Skip providers that would silently ignore the schema.
        provider: { require_parameters: true },
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
  } catch (error) {
    return {
      ok: false,
      code: 'upstream_error',
      message: "Couldn't reach the model. Check your connection and try again.",
      detail: error instanceof Error ? error.name : 'unknown network error',
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      code: 'upstream_error',
      message: messageForStatus(response.status),
      detail: `OpenRouter returned ${response.status}`,
    }
  }

  let body: CompletionResponse
  try {
    body = (await response.json()) as CompletionResponse
  } catch {
    return invalidOutput('response body was not JSON')
  }

  const parsed = parseModelOutput(body.choices?.[0]?.message?.content ?? '')
  if (!parsed.ok) return invalidOutput(parsed.reason)

  return {
    ok: true,
    suggestion: parsed.suggestion,
    usage: {
      promptTokens: body.usage?.prompt_tokens ?? null,
      completionTokens: body.usage?.completion_tokens ?? null,
      reasoningTokens: body.usage?.completion_tokens_details?.reasoning_tokens ?? null,
      costUsd: body.usage?.cost ?? null,
    },
  }
}

function invalidOutput(detail: string): ModelResult {
  return {
    ok: false,
    code: 'invalid_model_output',
    message: "The model's reply couldn't be read. Your document is unchanged. Try again.",
    detail,
  }
}

function messageForStatus(status: number): string {
  if (status === 401 || status === 403) {
    return 'The OpenRouter API key was rejected. Check the key in your .env file.'
  }
  if (status === 402) return 'The OpenRouter account is out of credit.'
  if (status === 429) return 'The model is rate limited right now. Wait a moment and try again.'
  return 'The model service had a problem. Try again.'
}
