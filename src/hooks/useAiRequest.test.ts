import { describe, expect, it } from 'vitest'
import { aiRequestReducer, INITIAL_AI_REQUEST } from './useAiRequest'

const suggestion = { rewrite: 'Short.', rationale: 'Cut filler.' }

describe('aiRequestReducer', () => {
  it('goes from idle to loading to success', () => {
    const loading = aiRequestReducer(INITIAL_AI_REQUEST, { type: 'start', requestId: 1 })
    expect(loading.status).toBe('loading')
    const done = aiRequestReducer(loading, { type: 'succeed', requestId: 1, suggestion })
    expect(done).toEqual({ status: 'success', requestId: 1, suggestion })
  })

  it('goes from loading to error', () => {
    const loading = aiRequestReducer(INITIAL_AI_REQUEST, { type: 'start', requestId: 1 })
    const failed = aiRequestReducer(loading, {
      type: 'fail',
      requestId: 1,
      code: 'network',
      message: 'Offline',
    })
    expect(failed).toMatchObject({ status: 'error', code: 'network', message: 'Offline' })
  })

  it('a stale response is ignored', () => {
    const second = aiRequestReducer(
      aiRequestReducer(INITIAL_AI_REQUEST, { type: 'start', requestId: 1 }),
      { type: 'start', requestId: 2 },
    )
    expect(aiRequestReducer(second, { type: 'succeed', requestId: 1, suggestion })).toBe(second)
    expect(
      aiRequestReducer(second, { type: 'fail', requestId: 1, code: 'network', message: 'Offline' }),
    ).toBe(second)
  })

  it('a response after a reset is ignored', () => {
    const reset = aiRequestReducer(
      aiRequestReducer(INITIAL_AI_REQUEST, { type: 'start', requestId: 1 }),
      { type: 'reset' },
    )
    expect(aiRequestReducer(reset, { type: 'succeed', requestId: 1, suggestion })).toEqual(
      INITIAL_AI_REQUEST,
    )
  })
})
