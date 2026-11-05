import type { SuggestRequest } from '../../shared/contract'
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

/** What was last asked for, so a retry can repeat exactly that. */
export interface Ask {
  label: string
  instruction: string
  /** The rewrite being refined, or null on the first request. */
  currentSuggestion: string | null
}

/** One suggestion under review, from the first ask until it's settled. */
export interface Session {
  place: SuggestionPlace
  ask: Ask
  iterations: Iteration[]
  current: number
  /** Keep and discard marks for the current iteration. */
  decisions: ReadonlyMap<number, ChangeDecision>
  /** The change the row below the diff acts on. */
  activeChange: number
}

export function currentIteration(session: Session): Iteration | undefined {
  return session.iterations[session.current]
}

/** The request for an ask. The selection is always the original text. */
export function buildRequest(place: SuggestionPlace, ask: Ask): SuggestRequest {
  return {
    selection: place.markdown,
    target: place.kind,
    instruction: ask.instruction,
    currentSuggestion: ask.currentSuggestion,
    context: place.context,
  }
}

/**
 * The diff always runs from the original to this rewrite, never from the
 * previous answer: what the user reviews is what accept would apply.
 */
export function makeIteration(
  place: Pick<SuggestionPlace, 'markdown' | 'kind'>,
  label: string,
  rewrite: string,
  rationale: string,
): Iteration {
  return { label, rewrite, rationale, diff: computeDiff(place.markdown, rewrite, place.kind) }
}

export type SessionAction =
  | { type: 'begin'; place: SuggestionPlace; ask: Ask }
  | { type: 'refine'; ask: Ask }
  | { type: 'addIteration'; iteration: Iteration }
  | { type: 'selectIteration'; index: number }
  | { type: 'selectChange'; id: number }
  | { type: 'stepChange'; delta: 1 | -1 }
  | { type: 'decide'; id: number; decision: ChangeDecision }
  | { type: 'movePlace'; place: SuggestionPlace }
  | { type: 'end' }

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
      ask: action.ask,
      iterations: [],
      current: 0,
      decisions: new Map(),
      activeChange: 0,
    }
  }
  if (!session) return null

  switch (action.type) {
    case 'refine':
      return { ...session, ask: action.ask }
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
