import type { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'
import { useCallback, useEffect, useReducer, useState } from 'react'
import type { Command } from '../constants'
import { APPLY_META, applyMarkdown, mapPlace } from '../lib/applySuggestion'
import { deriveCardView } from '../lib/cardView'
import { applyDecisions, keepAll } from '../lib/diff'
import type { ChangeDecision } from '../lib/diff'
import { normalizeMarkdown, placeFromHeading, placeFromSelection } from '../lib/editorDocument'
import type { SuggestionPlace } from '../lib/editorDocument'
import { buildRequest, currentIteration, makeIteration, sessionReducer } from '../lib/suggestionSession'
import type { Ask } from '../lib/suggestionSession'
import { setTargetHighlight } from '../lib/targetHighlight'
import { useAiRequest } from './useAiRequest'

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
  /** The first-open hint has done its job once the user has asked for something. */
  const [hasAsked, setHasAsked] = useState(false)

  const endSession = useCallback(() => {
    reset()
    dispatch({ type: 'end' })
    setRefineText('')
  }, [reset])

  const place = session?.place
  const loading = ai.state.status === 'loading'

  // Draws the target, sweeping while the model works. Decorations aren't part
  // of the document, so this never changes it.
  useEffect(() => {
    setTargetHighlight(editor, place ?? null, loading)
  }, [editor, place, loading])

  // Follows the place through edits elsewhere, and drops the suggestion if its
  // own paragraph changed. Transactions catch paste and undo, not just typing.
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

  const send = useCallback(
    async (target: SuggestionPlace, ask: Ask) => {
      const suggestion = await run(buildRequest(target, ask))
      if (!suggestion) return
      const rewrite = normalizeMarkdown(editor, suggestion.rewrite)
      dispatch({
        type: 'addIteration',
        iteration: makeIteration(target.markdown, ask.label, rewrite, suggestion.rationale),
      })
      setRefineText('')
    },
    [editor, run],
  )

  const askAbout = useCallback(
    (target: SuggestionPlace, command: Command) => {
      const ask: Ask = { label: command.label, instruction: command.instruction, currentSuggestion: null }
      // The highlight takes over from the selection. If the selection stayed,
      // choosing the same words again wouldn't count as a change and the pill
      // wouldn't come back after a cancel or reject.
      if (target.kind === 'selection') editor.commands.setTextSelection(target.to)
      setHasAsked(true)
      dispatch({ type: 'begin', place: target, ask })
      void send(target, ask)
    },
    [editor, send],
  )

  const askAboutSelection = useCallback(
    (command: Command) => {
      const target = placeFromSelection(editor)
      if (target) askAbout(target, command)
    },
    [askAbout, editor],
  )

  const askAboutHeading = useCallback(
    (heading: string, command: Command) => {
      const target = placeFromHeading(editor, heading)
      if (target) askAbout(target, command)
    },
    [askAbout, editor],
  )

  const iteration = session ? currentIteration(session) : undefined

  const refine = useCallback(
    (command: Command) => {
      if (!session || !iteration) return
      const ask: Ask = {
        label: command.label,
        instruction: command.instruction,
        currentSuggestion: iteration.rewrite,
      }
      dispatch({ type: 'refine', ask })
      void send(session.place, ask)
    },
    [iteration, send, session],
  )

  /** One click, one new call. Nothing retries on its own. */
  const retry = useCallback(() => {
    if (session) void send(session.place, session.ask)
  }, [send, session])

  // The button just pressed disappears with the review, so focus would be lost
  // and Ctrl+Z would no longer reach the editor.
  const returnToDocument = useCallback(() => {
    editor.commands.focus(undefined, { scrollIntoView: false })
  }, [editor])

  const cancel = useCallback(() => {
    if (iteration) {
      // Cancelling a refine keeps the answer already on screen.
      reset()
      return
    }
    endSession()
    returnToDocument()
    showNotice('Cancelled. Your text is unchanged.')
  }, [endSession, iteration, reset, returnToDocument, showNotice])

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
    askAbout,
    /** What the palette should act on during a review: the same text, as a refine. */
    reviewingPlace: iteration ? session?.place ?? null : null,
    askAboutSelection,
    askAboutHeading,
    hasAsked,
    refineText,
    review: {
      acceptAll,
      applyDecided,
      rejectAll,
      close,
      cancel,
      retry,
      decide,
      selectChange,
      stepChange,
      selectIteration,
      refine,
      setRefineText,
    },
  }
}
