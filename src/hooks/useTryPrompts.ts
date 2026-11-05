import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { useMemo } from 'react'
import { TRY_PROMPTS } from '../constants'
import { availablePrompts } from '../lib/editorDocument'

/** The first-open prompts that still have a section to act on, kept up to date. */
export function useTryPrompts(editor: Editor) {
  const availableIds = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      availablePrompts(current, TRY_PROMPTS)
        .map((prompt) => prompt.id)
        .join(),
  })

  return useMemo(() => {
    const ids = availableIds.split(',')
    return TRY_PROMPTS.filter((prompt) => ids.includes(prompt.id))
  }, [availableIds])
}
