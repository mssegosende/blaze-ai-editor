import { useEffect, useRef } from 'react'
import type { CardView } from '../lib/cardView'
import { isStackedLayout } from '../lib/editorDocument'

/** Changes when something new arrives that the user needs to see in the card. */
function arrivalOf(view: CardView): string | null {
  if (view.kind === 'error') return 'error'
  if (view.kind !== 'review') return null
  return view.refineError !== null ? 'refine-error' : `answer-${view.history.length}`
}

/**
 * Under 1024px the card sits below the document, out of sight. When a suggestion
 * or an error arrives, this brings it into view. Stepping back through the refine
 * history isn't an arrival, so it stays put.
 */
export function useCardIntoView(view: CardView) {
  const cardRef = useRef<HTMLElement>(null)
  const arrival = arrivalOf(view)

  useEffect(() => {
    if (arrival !== null && isStackedLayout()) cardRef.current?.scrollIntoView({ block: 'start' })
  }, [arrival])

  return cardRef
}
