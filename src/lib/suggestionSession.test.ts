import { describe, expect, it } from 'vitest'
import { computeDiff } from './diff'
import type { SuggestionPlace } from './editorDocument'
import { sessionReducer } from './suggestionSession'
import type { Iteration, Session } from './suggestionSession'

const place: SuggestionPlace = {
  kind: 'selection',
  from: 1,
  to: 10,
  guardFrom: 1,
  guardTo: 20,
  inline: true,
  markdown: 'one alpha two beta three gamma four',
  title: 'Head',
  context: null,
}

function iteration(rewrite: string): Iteration {
  return { label: 'Shorter', rewrite, rationale: 'Why.', diff: computeDiff(place.markdown, rewrite) }
}

const threeChanges = iteration('one A two B three C four')

function reviewing(): Session {
  const begun = sessionReducer(null, { type: 'begin', place, label: 'Shorter' })
  const session = sessionReducer(begun, { type: 'addIteration', iteration: threeChanges })
  if (!session) throw new Error('No session')
  return session
}

describe('sessionReducer', () => {
  it('the fixture has three separate changes', () => {
    expect(threeChanges.diff.changeCount).toBe(3)
  })

  it('the arrows reach every change, in both directions', () => {
    let session: Session | null = reviewing()
    const seen = [session.activeChange]
    for (let i = 0; i < 2; i += 1) {
      session = sessionReducer(session, { type: 'stepChange', delta: 1 })
      seen.push(session?.activeChange ?? -1)
    }
    expect(seen).toEqual([0, 1, 2])

    session = sessionReducer(session, { type: 'stepChange', delta: 1 })
    expect(session?.activeChange).toBe(0)
    session = sessionReducer(session, { type: 'stepChange', delta: -1 })
    expect(session?.activeChange).toBe(2)
  })

  it('clicking a change selects it', () => {
    expect(sessionReducer(reviewing(), { type: 'selectChange', id: 2 })?.activeChange).toBe(2)
  })

  it('selecting a change that does not exist does nothing', () => {
    const session = reviewing()
    expect(sessionReducer(session, { type: 'selectChange', id: 9 })).toBe(session)
  })

  it('a decision moves on to the next undecided change', () => {
    const session = sessionReducer(reviewing(), { type: 'decide', id: 0, decision: 'keep' })
    expect(session?.decisions.get(0)).toBe('keep')
    expect(session?.activeChange).toBe(1)
  })

  it('moving on skips changes that are already decided', () => {
    let session: Session | null = reviewing()
    session = sessionReducer(session, { type: 'decide', id: 1, decision: 'discard' })
    session = sessionReducer(session, { type: 'decide', id: 0, decision: 'keep' })
    expect(session?.activeChange).toBe(2)
  })

  it('a decision can be changed', () => {
    let session: Session | null = reviewing()
    session = sessionReducer(session, { type: 'decide', id: 0, decision: 'keep' })
    session = sessionReducer(session, { type: 'decide', id: 0, decision: 'discard' })
    expect(session?.decisions.get(0)).toBe('discard')
  })

  it('a new answer clears the marks made on the previous one', () => {
    let session: Session | null = reviewing()
    session = sessionReducer(session, { type: 'decide', id: 0, decision: 'keep' })
    session = sessionReducer(session, { type: 'addIteration', iteration: iteration('one A two beta three gamma four') })
    expect(session?.decisions.size).toBe(0)
    expect(session?.current).toBe(1)
  })

  it('moving the place keeps the review going', () => {
    const moved = { ...place, from: 50, to: 59 }
    const session = sessionReducer(reviewing(), { type: 'movePlace', place: moved })
    expect(session?.place).toBe(moved)
    expect(session?.iterations).toHaveLength(1)
  })

  it('actions without a session do nothing', () => {
    expect(sessionReducer(null, { type: 'stepChange', delta: 1 })).toBeNull()
  })
})
