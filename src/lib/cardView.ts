import type { ClientErrorCode } from '../api/suggestClient'
import type { AiRequestState } from '../hooks/useAiRequest'
import type { ChangeDecision, SuggestionDiff } from './diff'
import { currentIteration } from './suggestionSession'
import type { Session } from './suggestionSession'

export interface ReviewView {
  kind: 'review'
  title: string
  label: string
  rationale: string
  diff: SuggestionDiff
  decisions: ReadonlyMap<number, ChangeDecision>
  activeChange: number
  /** The refine trail, such as Shorter → Warmer. */
  history: string[]
  current: number
  /** The refine in flight, if any. The current answer stays visible meanwhile. */
  refining: string | null
  /** Why the last refine failed. The current answer is still there to use. */
  refineError: string | null
}

export type CardView =
  | { kind: 'idle' }
  | { kind: 'loading'; title: string; label: string }
  | { kind: 'error'; title: string; heading: string; message: string }
  | ReviewView

const ERROR_HEADINGS: Partial<Record<ClientErrorCode, string>> = {
  missing_api_key: 'Add your API key',
  budget_exhausted: 'Out of credit',
  network: "Can't reach the server",
}

export function errorHeading(code: ClientErrorCode): string {
  return ERROR_HEADINGS[code] ?? "That didn't work"
}

/** What the card shows, from the session and the request. Pure. */
export function deriveCardView(session: Session | null, request: AiRequestState): CardView {
  if (!session) return { kind: 'idle' }
  const { title } = session.place
  const iteration = currentIteration(session)

  if (!iteration) {
    if (request.status === 'error') {
      return { kind: 'error', title, heading: errorHeading(request.code), message: request.message }
    }
    return { kind: 'loading', title, label: session.ask.label }
  }

  return {
    kind: 'review',
    title,
    label: iteration.label,
    rationale: iteration.rationale,
    diff: iteration.diff,
    decisions: session.decisions,
    activeChange: session.activeChange,
    history: session.iterations.map((item) => item.label),
    current: session.current,
    refining: request.status === 'loading' ? session.ask.label : null,
    refineError: request.status === 'error' ? request.message : null,
  }
}
