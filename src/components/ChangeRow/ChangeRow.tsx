import type { ChangeDecision } from '../../lib/diff'
import styles from './ChangeRow.module.css'

interface ChangeRowProps {
  position: number
  total: number
  decision: ChangeDecision | undefined
  onStep: (delta: 1 | -1) => void
  onDecide: (decision: ChangeDecision) => void
}

export function ChangeRow({ position, total, decision, onStep, onDecide }: ChangeRowProps) {
  return (
    <div className={styles.row} role="group" aria-label="Review one change at a time">
      <span className={styles.position}>
        Change {position} of {total}
      </span>
      <button className={styles.arrow} type="button" aria-label="Previous change" onClick={() => onStep(-1)}>
        <span aria-hidden="true">‹</span>
      </button>
      <button className={styles.arrow} type="button" aria-label="Next change" onClick={() => onStep(1)}>
        <span aria-hidden="true">›</span>
      </button>
      <button
        className={styles.choice}
        type="button"
        aria-pressed={decision === 'keep'}
        onClick={() => onDecide('keep')}
      >
        Keep
      </button>
      <button
        className={styles.choice}
        type="button"
        aria-pressed={decision === 'discard'}
        onClick={() => onDecide('discard')}
      >
        Discard
      </button>
    </div>
  )
}
