import type { Editor } from '@tiptap/core'
import { useCallback, useEffect, useRef, useState } from 'react'

export type PillView = 'actions' | 'tone' | 'ask'

export interface PillPosition {
  /** Centre of the selection in viewport pixels, kept far enough from the edges. */
  left: number
  /** The line the pill sits against. */
  top: number
  /** True when there's no room above the selection, so the pill goes under it. */
  below: boolean
}

/** About half the pill's width, so it can't hang off the side of the screen. */
const PILL_HALF_WIDTH = 216
/** The app bar plus the pill wrapped onto two rows. */
const ROOM_NEEDED_ABOVE = 130
/** The pill wrapped onto two rows, plus its gap from the selection. */
const ROOM_NEEDED_BELOW = 120
const BELOW_APP_BAR = 68
const EDGE_MARGIN = 8

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * The pill is fixed to the viewport, so scrolling can't reach it if it lands
 * outside. Part of a selection can be off-screen, so it's always kept inside.
 */
function measure(editor: Editor): PillPosition {
  const { from, to } = editor.state.selection
  const start = editor.view.coordsAtPos(from)
  const end = editor.view.coordsAtPos(to)
  const centre = (start.left + end.right) / 2
  const below = start.top < ROOM_NEEDED_ABOVE
  return {
    left: clamp(centre, PILL_HALF_WIDTH, window.innerWidth - PILL_HALF_WIDTH),
    top: below
      ? clamp(end.bottom, BELOW_APP_BAR, window.innerHeight - ROOM_NEEDED_BELOW)
      : Math.min(start.top, window.innerHeight - EDGE_MARGIN),
    below,
  }
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
      setPosition(measure(editor))
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
    // Follows the text while the page scrolls. A closed pill stays closed.
    const followScroll = () => {
      setPosition((current) => current && measure(editor))
    }

    const dom = editor.view.dom
    editor.on('selectionUpdate', update)
    dom.addEventListener('mousedown', startDrag)
    window.addEventListener('mouseup', endDrag)
    window.addEventListener('scroll', followScroll, { passive: true })
    return () => {
      editor.off('selectionUpdate', update)
      dom.removeEventListener('mousedown', startDrag)
      window.removeEventListener('mouseup', endDrag)
      window.removeEventListener('scroll', followScroll)
    }
  }, [editor, reset])

  return { position, view, setView, askText, setAskText, close: reset }
}
