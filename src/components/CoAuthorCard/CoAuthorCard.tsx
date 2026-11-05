import type { Command, TryPrompt } from '../../constants'
import type { CardView, ReviewView } from '../../lib/cardView'
import type { ChangeDecision } from '../../lib/diff'
import { changesOf } from '../../lib/diff'
import { ChangeRow } from '../ChangeRow/ChangeRow'
import { DiffView } from '../DiffView/DiffView'
import { EmptyState } from '../EmptyState/EmptyState'
import { RefineControls } from '../RefineControls/RefineControls'
import styles from './CoAuthorCard.module.css'

export interface ReviewActions {
  acceptAll: () => void
  applyDecided: () => void
  rejectAll: () => void
  close: () => void
  decide: (id: number, decision: ChangeDecision) => void
  selectChange: (id: number) => void
  stepChange: (delta: 1 | -1) => void
  selectIteration: (index: number) => void
  refine: (command: Command) => void
  setRefineText: (text: string) => void
}

interface CoAuthorCardProps {
  appName: string
  view: CardView
  actions: ReviewActions
  refineCommands: Command[]
  refineText: string
  onSubmitRefineText: () => void
  tryPrompts: TryPrompt[]
  onTry: (prompt: TryPrompt) => void
}

function pad(count: number): string {
  return String(count).padStart(2, '0')
}

function History({ view, onSelect }: { view: ReviewView; onSelect: (index: number) => void }) {
  if (view.history.length === 1) return <p className={styles.chip}>{view.label}</p>
  return (
    <ol className={styles.history} aria-label="Refine history">
      {view.history.map((label, index) => (
        <li key={index} className={styles.historyItem}>
          {index > 0 && <span aria-hidden="true">→</span>}
          <button
            className={index === view.current ? styles.historyCurrent : styles.historyButton}
            type="button"
            aria-current={index === view.current ? 'step' : undefined}
            onClick={() => onSelect(index)}
          >
            {label}
          </button>
        </li>
      ))}
    </ol>
  )
}

function Review({
  appName,
  view,
  actions,
  refineCommands,
  refineText,
  onSubmitRefineText,
}: Omit<CoAuthorCardProps, 'view' | 'tryPrompts' | 'onTry'> & { view: ReviewView }) {
  const changes = changesOf(view.diff)
  const total = changes.length
  const decided = changes.filter((change) => view.decisions.has(change.id)).length
  const kept = changes.filter((change) => view.decisions.get(change.id) === 'keep').length
  const left = total - decided
  const position = changes.findIndex((change) => change.id === view.activeChange)
  const busy = view.refining !== null

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
      <History view={view} onSelect={actions.selectIteration} />
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

      <RefineControls
        appName={appName}
        commands={refineCommands.filter((command) => command.label !== view.label)}
        text={refineText}
        disabled={busy}
        onTextChange={actions.setRefineText}
        onCommand={actions.refine}
        onSubmitText={onSubmitRefineText}
      />
      {view.refining !== null && <p className={styles.status}>Refining: {view.refining}…</p>}
      {view.refineError !== null && (
        <p className={styles.refineError} role="alert">
          {view.refineError} Your current suggestion is still here.
        </p>
      )}
    </>
  )
}

export function CoAuthorCard({
  appName,
  view,
  actions,
  refineCommands,
  refineText,
  onSubmitRefineText,
  tryPrompts,
  onTry,
}: CoAuthorCardProps) {
  return (
    <aside className={styles.panel} aria-label="Co-author">
      <div className={styles.card} aria-live="polite">
        {view.kind === 'idle' && <EmptyState prompts={tryPrompts} onTry={onTry} />}

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
          <Review
            appName={appName}
            view={view}
            actions={actions}
            refineCommands={refineCommands}
            refineText={refineText}
            onSubmitRefineText={onSubmitRefineText}
          />
        )}
      </div>
      {view.kind === 'review' && view.diff.mode === 'inline' && view.diff.changeCount > 0 && (
        <p className={styles.tip}>Click a change to select it, or use the arrows.</p>
      )}
    </aside>
  )
}
