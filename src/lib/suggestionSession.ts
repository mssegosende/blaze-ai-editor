import { changesOf, computeDiff } from './diff'
import type { ChangeDecision, SuggestionDiff } from './diff'
import type { SuggestionPlace } from './editorDocument'

/** One answer from the model. Refining adds another. */
export interface Iteration {
  label: string
  rewrite: string
  rationale: string
  diff: SuggestionDiff
}

/** One suggestion under review, from the first ask until it's settled. */
export interface Session {
  place: SuggestionPlace
  /** The action in flight or last asked for. */
  label: string
  iterations: Iteration[]
  current: number
  /** Keep and discard marks for the current iteration. */
  decisions: ReadonlyMap<number, ChangeDecision>
  /** The change the row below the diff acts on. */
  activeChange: number
}

/**
 * The diff always runs from the original to this rewrite, never from the
 * previous answer: what the user reviews is what accept would apply.
 */
export function makeIteration(original: string, label: string, rewrite: string, rationale: string): Iteration {
  return { label, rewrite, rationale, diff: computeDiff(original, rewrite) }
}

export type SessionAction =
  | { type: 'begin'; place: SuggestionPlace; label: string }
  | { type: 'refine'; label: string }
  | { type: 'addIteration'; iteration: Iteration }
  | { type: 'selectIteration'; index: number }
  | { type: 'selectChange'; id: number }
  | { type: 'stepChange'; delta: 1 | -1 }
  | { type: 'decide'; id: number; decision: ChangeDecision }
  | { type: 'movePlace'; place: SuggestionPlace }
  | { type: 'end' }

export function currentIteration(session: Session): Iteration | undefined {
  return session.iterations[session.current]
}

function changeIds(session: Session): number[] {
  const iteration = currentIteration(session)
  return iteration ? changesOf(iteration.diff).map((change) => change.id) : []
}

/** After a decision, the row moves to the next change still waiting for one. */
function nextUndecided(session: Session, decisions: ReadonlyMap<number, ChangeDecision>, from: number): number {
  const ids = changeIds(session)
  const start = ids.indexOf(from)
  for (let offset = 1; offset <= ids.length; offset += 1) {
    const id = ids[(start + offset) % ids.length]
    if (id !== undefined && !decisions.has(id)) return id
  }
  return from
}

export function sessionReducer(session: Session | null, action: SessionAction): Session | null {
  if (action.type === 'begin') {
    return {
      place: action.place,
      label: action.label,
      iterations: [],
      current: 0,
      decisions: new Map(),
      activeChange: 0,
    }
  }
  if (!session) return null

  switch (action.type) {
    case 'refine':
      return { ...session, label: action.label }
    case 'selectIteration':
      if (!session.iterations[action.index] || action.index === session.current) return session
      return { ...session, current: action.index, decisions: new Map(), activeChange: 0 }
    case 'addIteration':
      // The changes are new, so marks made on the previous answer can't carry over.
      return {
        ...session,
        iterations: [...session.iterations, action.iteration],
        current: session.iterations.length,
        decisions: new Map(),
        activeChange: 0,
      }
    case 'selectChange':
      return changeIds(session).includes(action.id) ? { ...session, activeChange: action.id } : session
    case 'stepChange': {
      const ids = changeIds(session)
      if (ids.length === 0) return session
      const index = ids.indexOf(session.activeChange)
      const id = ids[(index + action.delta + ids.length) % ids.length]
      return id === undefined ? session : { ...session, activeChange: id }
    }
    case 'decide': {
      const decisions = new Map(session.decisions).set(action.id, action.decision)
      return { ...session, decisions, activeChange: nextUndecided(session, decisions, action.id) }
    }
    case 'movePlace':
      return { ...session, place: action.place }
    case 'end':
      return null
  }
}
