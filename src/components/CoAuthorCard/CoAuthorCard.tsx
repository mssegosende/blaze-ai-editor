import type { ChangeDecision } from '../../lib/diff'
import { changesOf } from '../../lib/diff'
import type { CardView, ReviewView } from '../../hooks/useSuggestion'
import { ChangeRow } from '../ChangeRow/ChangeRow'
import { DiffView } from '../DiffView/DiffView'
import styles from './CoAuthorCard.module.css'

export interface ReviewActions {
  acceptAll: () => void
  applyDecided: () => void
  rejectAll: () => void
  close: () => void
  decide: (id: number, decision: ChangeDecision) => void
  selectChange: (id: number) => void
  stepChange: (delta: 1 | -1) => void
}

interface CoAuthorCardProps {
  view: CardView
  actions: ReviewActions
}

function pad(count: number): string {
  return String(count).padStart(2, '0')
}

function Review({ view, actions }: { view: ReviewView; actions: ReviewActions }) {
  const changes = changesOf(view.diff)
  const total = changes.length
  const decided = changes.filter((change) => view.decisions.has(change.id)).length
  const kept = changes.filter((change) => view.decisions.get(change.id) === 'keep').length
  const left = total - decided
  const position = changes.findIndex((change) => change.id === view.activeChange)

  return (
    <>
      <h2 className={styles.label}>03 · Suggestion · {view.title}</h2>
      {total === 0 ? (
        <p className={styles.noChanges}>No changes suggested</p>
      ) : (
        <div className={styles.counterRow}>
          <p className={styles.counter}>{pad(left)}</p>
          <p className={styles.counterNote}>
            {left === 1 ? 'change' : 'changes'} left
            <br />
            to review · {total} total
          </p>
        </div>
      )}
      <p className={styles.chip}>{view.label}</p>
      <p className={styles.why}>{view.rationale}</p>

      {total > 0 && (
        <div className={styles.diff}>
          <DiffView
            diff={view.diff}
            decisions={view.decisions}
            activeChange={view.activeChange}
            onSelectChange={actions.selectChange}
          />
          {view.diff.mode === 'inline' && (
            <ChangeRow
              position={position + 1}
              total={total}
              decision={view.decisions.get(view.activeChange)}
              onStep={actions.stepChange}
              onDecide={(decision) => actions.decide(view.activeChange, decision)}
            />
          )}
        </div>
      )}

      {total === 0 ? (
        <div className={styles.actionsSingle}>
          <button className={styles.ghost} type="button" onClick={actions.close}>
            Close
          </button>
        </div>
      ) : (
        <div className={styles.actions}>
          <button className={styles.primary} type="button" onClick={actions.acceptAll}>
            Accept all
          </button>
          <button className={styles.ghost} type="button" onClick={actions.rejectAll}>
            Reject all
          </button>
        </div>
      )}
      {decided > 0 && (
        <button className={styles.apply} type="button" onClick={actions.applyDecided}>
          Apply · {kept} kept, {total - kept} dropped
        </button>
      )}
    </>
  )
}

export function CoAuthorCard({ view, actions }: CoAuthorCardProps) {
  return (
    <aside className={styles.panel} aria-label="Co-author">
      <div className={styles.card} aria-live="polite">
        {view.kind === 'idle' && (
          <>
            <h2 className={styles.label}>03 · Co-author</h2>
            <p className={styles.counter}>00</p>
            <p className={styles.title}>Nothing to review yet</p>
            <p className={styles.body}>Select text in the document and pick an action.</p>
          </>
        )}

        {view.kind === 'loading' && (
          <>
            <h2 className={styles.label}>03 · {view.title}</h2>
            <p className={styles.thinking}>Thinking…</p>
            <p className={styles.body}>{view.label} — only this text, nothing else in the document.</p>
          </>
        )}

        {view.kind === 'error' && (
          <>
            <h2 className={styles.label}>03 · {view.title}</h2>
            <p className={styles.title}>That didn't work</p>
            <p className={styles.body} role="alert">
              {view.message}
            </p>
          </>
        )}

        {view.kind === 'review' && <Review view={view} actions={actions} />}
      </div>
      {view.kind === 'review' && view.diff.mode === 'inline' && view.diff.changeCount > 0 && (
        <p className={styles.tip}>Click a change to select it, or use the arrows.</p>
      )}
    </aside>
  )
}
