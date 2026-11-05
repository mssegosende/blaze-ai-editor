import { useCallback, useEffect, useRef, useState } from 'react'

export interface Notice {
  message: string
  /** Offers an Undo button when the notice follows a change to the document. */
  undoable: boolean
}

const VISIBLE_MS = 6000

export function useNotice() {
  const [notice, setNotice] = useState<Notice | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current)
    setNotice(null)
  }, [])

  const show = useCallback((message: string, undoable = false) => {
    window.clearTimeout(timer.current)
    setNotice({ message, undoable })
    timer.current = window.setTimeout(() => setNotice(null), VISIBLE_MS)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return { notice, show, dismiss }
}
