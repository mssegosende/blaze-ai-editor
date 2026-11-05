import { describe, expect, it } from 'vitest'
import type { AiRequestState } from '../hooks/useAiRequest'
import { deriveCardView } from './cardView'
import type { SuggestionPlace } from './editorDocument'
import { makeIteration, sessionReducer } from './suggestionSession'
import type { Session } from './suggestionSession'

const place: SuggestionPlace = {
  kind: 'selection',
  from: 1,
  to: 10,
  guardFrom: 1,
  guardTo: 20,
  inline: true,
  markdown: 'one alpha two beta three',
  title: 'Head',
  context: null,
}

const IDLE: AiRequestState = { status: 'idle' }
const LOADING: AiRequestState = { status: 'loading', requestId: 2 }
const FAILED: AiRequestState = { status: 'error', requestId: 2, code: 'network', message: 'Offline' }

function reviewing(): Session {
  const begun = sessionReducer(null, { type: 'begin', place, label: 'Shorter' })
  const session = sessionReducer(begun, {
    type: 'addIteration',
    iteration: makeIteration(place.markdown, 'Shorter', 'one A two B three', 'Why.'),
  })
  if (!session) throw new Error('No session')
  return session
}

describe('deriveCardView', () => {
  it('no session is the idle card', () => {
    expect(deriveCardView(null, IDLE)).toEqual({ kind: 'idle' })
  })

  it('a first request is the loading card', () => {
    const begun = sessionReducer(null, { type: 'begin', place, label: 'Shorter' })
    expect(deriveCardView(begun, LOADING)).toMatchObject({ kind: 'loading', label: 'Shorter' })
  })

  it('a failed first request is the error card', () => {
    const begun = sessionReducer(null, { type: 'begin', place, label: 'Shorter' })
    expect(deriveCardView(begun, FAILED)).toMatchObject({ kind: 'error', message: 'Offline' })
  })

  it('an answer is the review card', () => {
    expect(deriveCardView(reviewing(), { status: 'success', requestId: 1, suggestion: { rewrite: '', rationale: '' } })).toMatchObject({
      kind: 'review',
      label: 'Shorter',
      refining: null,
      refineError: null,
    })
  })

  it('a refine in flight keeps the current suggestion on screen', () => {
    const session = sessionReducer(reviewing(), { type: 'refine', label: 'Warmer' })
    expect(deriveCardView(session, LOADING)).toMatchObject({
      kind: 'review',
      label: 'Shorter',
      refining: 'Warmer',
    })
  })

  it('a failed refine keeps the current suggestion', () => {
    const session = sessionReducer(reviewing(), { type: 'refine', label: 'Warmer' })
    const view = deriveCardView(session, FAILED)
    expect(view).toMatchObject({ kind: 'review', label: 'Shorter', refineError: 'Offline', refining: null })
    if (view.kind === 'review') expect(view.diff.changeCount).toBe(2)
  })

  it('the history lists every answer in order', () => {
    const session = sessionReducer(reviewing(), {
      type: 'addIteration',
      iteration: makeIteration(place.markdown, 'Warmer', 'one C two beta three', 'Why.'),
    })
    expect(deriveCardView(session, IDLE)).toMatchObject({ history: ['Shorter', 'Warmer'], current: 1 })
  })
})
