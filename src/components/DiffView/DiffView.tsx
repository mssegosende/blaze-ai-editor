import type { SuggestionDiff } from '../../lib/diff'
import styles from './DiffView.module.css'

interface DiffViewProps {
  diff: SuggestionDiff
}

/** A change that's only whitespace would be invisible, so it gets a mark. */
function visible(text: string): string {
  if (text === '' || text.trim() !== '') return text
  return text.includes('\n') ? '¶' : '␣'
}

export function DiffView({ diff }: DiffViewProps) {
  if (diff.mode === 'block') {
    const change = diff.segments[0]
    if (change?.kind !== 'change') return null
    return (
      <div className={styles.block}>
        <p className={styles.blockLabel}>Before</p>
        <p className={styles.text}>
          <del className={styles.removed}>{change.removed}</del>
        </p>
        <p className={styles.blockLabel}>After</p>
        <p className={styles.text}>
          <ins className={styles.added}>{change.added}</ins>
        </p>
      </div>
    )
  }

  return (
    <p className={styles.text}>
      {diff.segments.map((segment, index) =>
        segment.kind === 'same' ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <span key={index}>
            {segment.removed !== '' && <del className={styles.removed}>{visible(segment.removed)}</del>}
            {segment.removed !== '' && segment.added !== '' && ' '}
            {segment.added !== '' && <ins className={styles.added}>{visible(segment.added)}</ins>}
          </span>
        ),
      )}
    </p>
  )
}
