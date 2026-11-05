import type { Editor } from '@tiptap/core'
import { useCallback, useEffect, useRef, useState } from 'react'

export type PillView = 'actions' | 'tone' | 'ask'

export interface PillPosition {
  /** Centre of the selection, in viewport pixels. */
  left: number
  top: number
}

/** Where the pill sits and which of its views is open. */
export function useSelectionPill(editor: Editor) {
  const [position, setPosition] = useState<PillPosition | null>(null)
  const [view, setView] = useState<PillView>('actions')
  const [askText, setAskText] = useState('')
  const dragging = useRef(false)

  const reset = useCallback(() => {
    setPosition(null)
    setView('actions')
    setAskText('')
  }, [])

  useEffect(() => {
    const update = () => {
      if (dragging.current) return
      const { from, to, empty } = editor.state.selection
      if (empty || editor.state.doc.textBetween(from, to, ' ').trim() === '') {
        reset()
        return
      }
      const start = editor.view.coordsAtPos(from)
      const end = editor.view.coordsAtPos(to)
      setPosition({ left: (start.left + end.right) / 2, top: Math.min(start.top, end.top) })
    }
    const startDrag = () => {
      dragging.current = true
      reset()
    }
    const endDrag = () => {
      if (!dragging.current) return
      dragging.current = false
      update()
    }

    const dom = editor.view.dom
    editor.on('selectionUpdate', update)
    dom.addEventListener('mousedown', startDrag)
    window.addEventListener('mouseup', endDrag)
    return () => {
      editor.off('selectionUpdate', update)
      dom.removeEventListener('mousedown', startDrag)
      window.removeEventListener('mouseup', endDrag)
    }
  }, [editor, reset])

  return { position, view, setView, askText, setAskText, close: reset }
}
