import { SUGGEST_PATH } from '../../shared/contract'
import type { SuggestErrorBody, SuggestErrorCode, SuggestRequest, Suggestion } from '../../shared/contract'

export type ClientErrorCode = SuggestErrorCode | 'network'

export type SuggestResult =
  | { ok: true; suggestion: Suggestion }
  | { ok: false; aborted: true }
  | { ok: false; aborted: false; code: ClientErrorCode; message: string }

function failure(code: ClientErrorCode, message: string): SuggestResult {
  return { ok: false, aborted: false, code, message }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** The only place in the UI that talks to the network. */
export async function requestSuggestion(
  request: SuggestRequest,
  signal: AbortSignal,
  fetchFn: typeof fetch = fetch,
): Promise<SuggestResult> {
  try {
    const response = await fetchFn(SUGGEST_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })
    const body = (await response.json()) as Suggestion | SuggestErrorBody

    if ('error' in body) return failure(body.error.code, body.error.message)
    if (!response.ok) return failure('upstream_error', 'The model service had a problem. Try again.')
    return { ok: true, suggestion: body }
  } catch (error) {
    if (isAbort(error)) return { ok: false, aborted: true }
    return failure('network', "Couldn't reach the server. Check that it's running and try again.")
  }
}
