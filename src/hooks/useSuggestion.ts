import type { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'
import { useCallback, useEffect, useReducer, useState } from 'react'
import type { SuggestRequest } from '../../shared/contract'
import type { Command } from '../constants'
import { APPLY_META, applyMarkdown, mapPlace } from '../lib/applySuggestion'
import { deriveCardView } from '../lib/cardView'
import { applyDecisions, keepAll } from '../lib/diff'
import type { ChangeDecision } from '../lib/diff'
import { normalizeMarkdown, placeFromSelection } from '../lib/editorDocument'
import type { SuggestionPlace } from '../lib/editorDocument'
import { currentIteration, makeIteration, sessionReducer } from '../lib/suggestionSession'
import { setTargetHighlight } from '../lib/targetHighlight'
import { useAiRequest } from './useAiRequest'

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

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function useSuggestion(editor: Editor, showNotice: (message: string, undoable?: boolean) => void) {
  const ai = useAiRequest()
  const { run, reset } = ai
  const [session, dispatch] = useReducer(sessionReducer, null)
  const [refineText, setRefineText] = useState('')

  const endSession = useCallback(() => {
    reset()
    dispatch({ type: 'end' })
    setRefineText('')
    setTargetHighlight(editor, null)
  }, [editor, reset])

  // Follows the place through edits elsewhere, and drops the suggestion if its
  // own paragraph changed. Transactions catch paste and undo, not just typing.
  const place = session?.place
  useEffect(() => {
    if (!place) return
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged || transaction.getMeta(APPLY_META)) return
      const mapped = mapPlace(place, transaction)
      if (mapped.touched) {
        endSession()
        showNotice('You edited this text, so the suggestion was discarded.')
      } else {
        dispatch({ type: 'movePlace', place: mapped.place })
      }
    }
    editor.on('transaction', onTransaction)
    return () => {
      editor.off('transaction', onTransaction)
    }
  }, [editor, endSession, place, showNotice])

  const request = useCallback(
    async (target: SuggestionPlace, command: Command, currentSuggestion: string | null) => {
      const suggestion = await run(buildRequest(target, command.instruction, currentSuggestion))
      if (!suggestion) return
      const rewrite = normalizeMarkdown(editor, suggestion.rewrite)
      dispatch({
        type: 'addIteration',
        iteration: makeIteration(target.markdown, command.label, rewrite, suggestion.rationale),
      })
      setRefineText('')
    },
    [editor, run],
  )

  const askAbout = useCallback(
    (target: SuggestionPlace, command: Command) => {
      dispatch({ type: 'begin', place: target, label: command.label })
      setTargetHighlight(editor, target)
      void request(target, command, null)
    },
    [editor, request],
  )

  const askAboutSelection = useCallback(
    (command: Command) => {
      const target = placeFromSelection(editor)
      if (target) askAbout(target, command)
    },
    [askAbout, editor],
  )

  const iteration = session ? currentIteration(session) : undefined

  const refine = useCallback(
    (command: Command) => {
      if (!session || !iteration) return
      dispatch({ type: 'refine', label: command.label })
      void request(session.place, command, iteration.rewrite)
    },
    [iteration, request, session],
  )

  // The button just pressed disappears with the review, so focus would be lost
  // and Ctrl+Z would no longer reach the editor.
  const returnToDocument = useCallback(() => {
    editor.commands.focus(undefined, { scrollIntoView: false })
  }, [editor])

  const settle = useCallback(
    (decisions: ReadonlyMap<number, ChangeDecision>) => {
      if (!session || !iteration) return
      const kept = [...decisions.values()].filter((decision) => decision === 'keep').length
      const markdown = applyDecisions(iteration.diff, decisions)

      endSession()
      if (kept === 0 || markdown === session.place.markdown) {
        returnToDocument()
        showNotice('No changes applied. Your text is unchanged.')
        return
      }
      applyMarkdown(editor, session.place, markdown)
      returnToDocument()
      showNotice(`Applied ${plural(kept, 'change')}.`, true)
    },
    [editor, endSession, iteration, returnToDocument, session, showNotice],
  )

  const acceptAll = useCallback(() => {
    if (iteration) settle(keepAll(iteration.diff))
  }, [iteration, settle])

  const applyDecided = useCallback(() => {
    if (session) settle(session.decisions)
  }, [session, settle])

  const rejectAll = useCallback(() => {
    endSession()
    returnToDocument()
    showNotice('Suggestion rejected. Your text is unchanged.')
  }, [endSession, returnToDocument, showNotice])

  const close = useCallback(() => {
    endSession()
    returnToDocument()
  }, [endSession, returnToDocument])

  const decide = useCallback((id: number, decision: ChangeDecision) => {
    dispatch({ type: 'decide', id, decision })
  }, [])
  const selectChange = useCallback((id: number) => dispatch({ type: 'selectChange', id }), [])
  const stepChange = useCallback((delta: 1 | -1) => dispatch({ type: 'stepChange', delta }), [])
  const selectIteration = useCallback((index: number) => dispatch({ type: 'selectIteration', index }), [])

  return {
    cardView: deriveCardView(session, ai.state),
    askAboutSelection,
    refineText,
    review: {
      acceptAll,
      applyDecided,
      rejectAll,
      close,
      decide,
      selectChange,
      stepChange,
      selectIteration,
      refine,
      setRefineText,
    },
  }
}
