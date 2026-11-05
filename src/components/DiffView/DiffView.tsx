import type { ChangeDecision, ChangeSegment, SuggestionDiff } from '../../lib/diff'
import styles from './DiffView.module.css'

interface DiffViewProps {
  diff: SuggestionDiff
  decisions: ReadonlyMap<number, ChangeDecision>
  activeChange: number
  onSelectChange: (id: number) => void
}

/** A change that's only whitespace would be invisible, so it gets a mark. */
function visible(text: string): string {
  if (text === '' || text.trim() !== '') return text
  return text.includes('\n') ? '¶' : '␣'
}

function describe(change: ChangeSegment, decision: ChangeDecision | undefined): string {
  const action =
    change.removed === ''
      ? `add "${change.added}"`
      : change.added === ''
        ? `remove "${change.removed}"`
        : `replace "${change.removed}" with "${change.added}"`
  const state = decision === 'keep' ? ', kept' : decision === 'discard' ? ', discarded' : ''
  return `Change ${change.id + 1}: ${action}${state}`
}

function ChangeContent({ change, decision }: { change: ChangeSegment; decision: ChangeDecision | undefined }) {
  // A settled change with no text left still needs something to click.
  if (decision === 'keep') {
    return change.added === '' ? (
      <span className={styles.mark} />
    ) : (
      <ins className={styles.kept}>{visible(change.added)}</ins>
    )
  }
  if (decision === 'discard') {
    return change.removed === '' ? (
      <span className={styles.mark} />
    ) : (
      <span className={styles.discarded}>{visible(change.removed)}</span>
    )
  }
  return (
    <>
      {change.removed !== '' && <del className={styles.removed}>{visible(change.removed)}</del>}
      {change.removed !== '' && change.added !== '' && ' '}
      {change.added !== '' && <ins className={styles.added}>{visible(change.added)}</ins>}
    </>
  )
}

export function DiffView({ diff, decisions, activeChange, onSelectChange }: DiffViewProps) {
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
      {diff.segments.map((segment, index) => {
        if (segment.kind === 'same') return <span key={index}>{segment.text}</span>
        const decision = decisions.get(segment.id)
        const active = segment.id === activeChange
        // The row below the diff is the keyboard path, with 44px targets, so
        // these stay out of the tab order: a long diff would be dozens of stops.
        return (
          <button
            key={index}
            type="button"
            tabIndex={-1}
            className={active ? styles.changeActive : styles.change}
            aria-pressed={active}
            aria-label={describe(segment, decision)}
            onClick={() => onSelectChange(segment.id)}
          >
            <ChangeContent change={segment} decision={decision} />
          </button>
        )
      })}
    </p>
  )
}
