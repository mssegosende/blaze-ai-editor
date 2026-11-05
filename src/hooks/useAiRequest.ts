import { useCallback, useReducer, useRef } from 'react'
import { requestSuggestion } from '../api/suggestClient'
import type { ClientErrorCode } from '../api/suggestClient'
import type { SuggestRequest, Suggestion } from '../../shared/contract'

export type AiRequestState =
  | { status: 'idle' }
  | { status: 'loading'; requestId: number }
  | { status: 'success'; requestId: number; suggestion: Suggestion }
  | { status: 'error'; requestId: number; code: ClientErrorCode; message: string }

export type AiRequestAction =
  | { type: 'start'; requestId: number }
  | { type: 'succeed'; requestId: number; suggestion: Suggestion }
  | { type: 'fail'; requestId: number; code: ClientErrorCode; message: string }
  | { type: 'reset' }

export const INITIAL_AI_REQUEST: AiRequestState = { status: 'idle' }

/** A reply only counts if it answers the request still in flight. */
export function aiRequestReducer(state: AiRequestState, action: AiRequestAction): AiRequestState {
  switch (action.type) {
    case 'start':
      return { status: 'loading', requestId: action.requestId }
    case 'succeed':
      if (state.status !== 'loading' || state.requestId !== action.requestId) return state
      return { status: 'success', requestId: action.requestId, suggestion: action.suggestion }
    case 'fail':
      if (state.status !== 'loading' || state.requestId !== action.requestId) return state
      return {
        status: 'error',
        requestId: action.requestId,
        code: action.code,
        message: action.message,
      }
    case 'reset':
      return INITIAL_AI_REQUEST
  }
}

export function useAiRequest() {
  const [state, dispatch] = useReducer(aiRequestReducer, INITIAL_AI_REQUEST)
  const inFlight = useRef<AbortController | null>(null)
  const lastRequestId = useRef(0)

  /** Starts a request, replacing any in flight. Null means it was replaced or cancelled. */
  const run = useCallback(async (request: SuggestRequest): Promise<Suggestion | null> => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    lastRequestId.current += 1
    const requestId = lastRequestId.current

    dispatch({ type: 'start', requestId })
    const result = await requestSuggestion(request, controller.signal)

    if (result.ok) {
      dispatch({ type: 'succeed', requestId, suggestion: result.suggestion })
      return lastRequestId.current === requestId ? result.suggestion : null
    }
    if (!result.aborted) {
      dispatch({ type: 'fail', requestId, code: result.code, message: result.message })
    }
    return null
  }, [])

  const reset = useCallback(() => {
    inFlight.current?.abort()
    inFlight.current = null
    lastRequestId.current += 1
    dispatch({ type: 'reset' })
  }, [])

  return { state, run, reset }
}
