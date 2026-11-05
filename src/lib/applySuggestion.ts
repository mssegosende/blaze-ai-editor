import type { Editor } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import { Slice } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import type { Transaction } from '@tiptap/pm/state'
import type { SuggestionPlace } from './editorDocument'

/** Marks our own change, so it isn't mistaken for the user editing the text. */
export const APPLY_META = 'blaze-apply'

/**
 * Replaces the place with Markdown in one transaction. History is closed on both
 * sides, so one undo removes exactly this change: not the typing before it, and
 * not the typing after it.
 */
export function applyMarkdown(editor: Editor, place: SuggestionPlace, markdown: string): void {
  const manager = editor.markdown
  if (!manager) throw new Error('The Markdown extension is not loaded')

  const { state, view } = editor
  const tr = closeHistory(state.tr).setMeta(APPLY_META, true)

  if (markdown.trim() === '') {
    tr.delete(place.from, place.to)
  } else {
    const parsed = state.schema.nodeFromJSON(manager.parse(markdown))
    if (place.inline) {
      // An open slice pours the text into the existing paragraph rather than
      // starting a new one, so the words around the selection stay with it.
      tr.replaceRange(place.from, place.to, new Slice(parsed.content, 1, 1))
    } else {
      tr.replaceWith(place.from, place.to, parsed.content)
    }
  }

  tr.setSelection(TextSelection.near(tr.doc.resolve(tr.mapping.map(place.to, -1)), -1))
  view.dispatch(tr)
  view.dispatch(closeHistory(view.state.tr))
}

export interface MappedPlace {
  place: SuggestionPlace
  /** True when the change landed inside the guarded block, so the diff is stale. */
  touched: boolean
}

/** Follows the place through a document change, or reports that it was edited. */
export function mapPlace(place: SuggestionPlace, tr: Transaction): MappedPlace {
  let { from, to, guardFrom, guardTo } = place
  let touched = false

  for (const stepMap of tr.mapping.maps) {
    stepMap.forEach((oldStart, oldEnd) => {
      if (oldStart <= guardTo && oldEnd >= guardFrom) touched = true
    })
    from = stepMap.map(from, 1)
    to = stepMap.map(to, -1)
    guardFrom = stepMap.map(guardFrom, 1)
    guardTo = stepMap.map(guardTo, -1)
  }

  return { place: { ...place, from, to, guardFrom, guardTo }, touched }
}
