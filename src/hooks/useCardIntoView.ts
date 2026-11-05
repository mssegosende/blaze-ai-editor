import { useEffect, useRef } from 'react'
import { TRY_PROMPTS_ID } from '../constants'
import type { CardView } from '../lib/cardView'
import { isStackedLayout } from '../lib/editorDocument'

interface CardMoment {
  /** Changes when something happens that the user needs to see in the card. */
  key: string
  /** Which end of the card has to be on screen. */
  block: 'start' | 'end'
}

function momentOf(view: CardView): CardMoment | null {
  if (view.kind === 'loading') return { key: 'loading', block: 'start' }
  if (view.kind === 'error') return { key: 'error', block: 'start' }
  if (view.kind !== 'review') return null
  // A refine's Cancel, Retry and error sit at the bottom of the card.
  if (view.refining !== null) return { key: `refining-${view.history.length}`, block: 'end' }
  if (view.refineError !== null) return { key: `refine-error-${view.history.length}`, block: 'end' }
  return { key: `answer-${view.history.length}`, block: 'start' }
}

/**
 * Under 1024px the card sits below the document, out of sight. This brings it
 * into view as soon as a request starts, so Cancel can be reached, and again when
 * the reply or an error arrives. Stepping back through the refine history isn't a
 * new moment, so it stays put.
 */
export function useCardIntoView(view: CardView) {
  const cardRef = useRef<HTMLElement>(null)
  const moment = momentOf(view)
  const key = moment?.key
  const block = moment?.block

  useEffect(() => {
    if (key !== undefined && isStackedLayout()) cardRef.current?.scrollIntoView({ block })
  }, [key, block])

  return cardRef
}

/** Takes the user to the "Try one" prompts, for when the card is below the document. */
export function showTryPrompts(): void {
  const prompts = document.getElementById(TRY_PROMPTS_ID)
  prompts?.scrollIntoView({ block: 'center' })
  prompts?.querySelector('button')?.focus({ preventScroll: true })
}
