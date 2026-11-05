import type { SuggestionDiff } from './diff'
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
}

export type SessionAction =
  | { type: 'begin'; place: SuggestionPlace; label: string }
  | { type: 'addIteration'; iteration: Iteration }
  | { type: 'end' }

export function sessionReducer(session: Session | null, action: SessionAction): Session | null {
  switch (action.type) {
    case 'begin':
      return { place: action.place, label: action.label, iterations: [], current: 0 }
    case 'addIteration':
      if (!session) return null
      return {
        ...session,
        iterations: [...session.iterations, action.iteration],
        current: session.iterations.length,
      }
    case 'end':
      return null
  }
}

export function currentIteration(session: Session): Iteration | undefined {
  return session.iterations[session.current]
}
