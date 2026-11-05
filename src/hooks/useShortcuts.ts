import type { Editor } from '@tiptap/core'
import { useEffect } from 'react'
import { keyAction } from '../lib/keyboard'
import type { KeyAction, KeyContext } from '../lib/keyboard'

interface ShortcutOptions {
  overlayOpen: boolean
  reviewing: boolean
  onAction: (action: Exclude<KeyAction, null>) => void
}

function focusOf(editor: Editor): KeyContext['focus'] {
  const active = document.activeElement
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return 'input'
  return active && editor.view.dom.contains(active) ? 'editor' : 'other'
}

/** Listens before the editor does, so a slash that opens the palette isn't typed. */
export function useShortcuts(editor: Editor, { overlayOpen, reviewing, onAction }: ShortcutOptions) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { selection } = editor.state
      const action = keyAction({
        key: event.key,
        mod: event.ctrlKey || event.metaKey,
        focus: focusOf(editor),
        selectionEmpty: selection.empty,
        onEmptyLine: selection.empty && selection.$from.parent.content.size === 0,
        overlayOpen,
        reviewing,
      })
      if (!action) return
      event.preventDefault()
      event.stopPropagation()
      onAction(action)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [editor, onAction, overlayOpen, reviewing])
}
