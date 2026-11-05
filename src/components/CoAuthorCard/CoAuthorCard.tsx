import type { CardView } from '../../hooks/useSuggestion'
import { DiffView } from '../DiffView/DiffView'
import styles from './CoAuthorCard.module.css'

interface CoAuthorCardProps {
  view: CardView
}

function pad(count: number): string {
  return String(count).padStart(2, '0')
}

export function CoAuthorCard({ view }: CoAuthorCardProps) {
  return (
    <aside className={styles.panel} aria-live="polite" aria-label="Co-author">
      <div className={styles.card}>
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

        {view.kind === 'review' && (
          <>
            <h2 className={styles.label}>03 · Suggestion · {view.title}</h2>
            <div className={styles.counterRow}>
              <p className={styles.counter}>{pad(view.diff.changeCount)}</p>
              <p className={styles.counterNote}>
                {view.diff.changeCount === 1 ? 'change' : 'changes'}
                <br />
                to review
              </p>
            </div>
            <p className={styles.chip}>{view.label}</p>
            <p className={styles.why}>{view.rationale}</p>
            <div className={styles.diff}>
              <DiffView diff={view.diff} />
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
