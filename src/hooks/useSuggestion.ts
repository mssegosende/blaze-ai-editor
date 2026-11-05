import type { Editor } from '@tiptap/core'
import { useCallback, useReducer } from 'react'
import type { SuggestRequest } from '../../shared/contract'
import type { Command } from '../constants'
import { computeDiff } from '../lib/diff'
import { normalizeMarkdown, placeFromSelection } from '../lib/editorDocument'
import type { SuggestionPlace } from '../lib/editorDocument'
import { currentIteration, sessionReducer } from '../lib/suggestionSession'
import { setTargetHighlight } from '../lib/targetHighlight'
import { useAiRequest } from './useAiRequest'

export type CardView =
  | { kind: 'idle' }
  | { kind: 'loading'; title: string; label: string }
  | { kind: 'error'; title: string; message: string }
  | { kind: 'review'; title: string; label: string; rationale: string; diff: ReturnType<typeof computeDiff> }

function buildRequest(place: SuggestionPlace, instruction: string, currentSuggestion: string | null): SuggestRequest {
  return {
    selection: place.markdown,
    target: place.kind,
    instruction,
    currentSuggestion,
    context: place.context,
  }
}

/** Free text from an Ask field is the instruction, and its own short label. */
export function askCommand(text: string): Command {
  const instruction = text.trim()
  return { id: 'ask', label: `“${instruction}”`, instruction }
}

export function useSuggestion(editor: Editor) {
  const ai = useAiRequest()
  const { run } = ai
  const [session, dispatch] = useReducer(sessionReducer, null)

  const askAbout = useCallback(
    async (place: SuggestionPlace, command: Command) => {
      dispatch({ type: 'begin', place, label: command.label })
      setTargetHighlight(editor, place)

      const suggestion = await run(buildRequest(place, command.instruction, null))
      if (!suggestion) return

      const rewrite = normalizeMarkdown(editor, suggestion.rewrite)
      dispatch({
        type: 'addIteration',
        iteration: {
          label: command.label,
          rewrite,
          rationale: suggestion.rationale,
          diff: computeDiff(place.markdown, rewrite),
        },
      })
    },
    [editor, run],
  )

  const askAboutSelection = useCallback(
    (command: Command) => {
      const place = placeFromSelection(editor)
      if (place) void askAbout(place, command)
    },
    [askAbout, editor],
  )

  let cardView: CardView = { kind: 'idle' }
  if (session) {
    const iteration = currentIteration(session)
    const { title } = session.place
    if (iteration) {
      cardView = {
        kind: 'review',
        title,
        label: iteration.label,
        rationale: iteration.rationale,
        diff: iteration.diff,
      }
    } else if (ai.state.status === 'error') {
      cardView = { kind: 'error', title, message: ai.state.message }
    } else {
      cardView = { kind: 'loading', title, label: session.label }
    }
  }

  return { cardView, askAboutSelection }
}
