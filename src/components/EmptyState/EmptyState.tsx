import type { TryPrompt } from '../../constants'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  prompts: TryPrompt[]
  onTry: (prompt: TryPrompt) => void
}

export function EmptyState({ prompts, onTry }: EmptyStateProps) {
  return (
    <>
      <h2 className={styles.label}>03 · Co-author</h2>
      <p className={styles.counter}>00</p>
      <p className={styles.title}>Nothing to review yet</p>
      <p className={styles.body}>
        Select text in the document and pick an action
        <span className={styles.keyHint}>
          , or press <kbd className={styles.key}>/</kbd>
        </span>
        . Suggestions appear here as a diff, and nothing changes until you accept.
      </p>
      {prompts.length > 0 && (
        <div className={styles.try}>
          <h3 className={styles.label}>Try one</h3>
          <div className={styles.prompts}>
            {prompts.map((prompt) => (
              <button key={prompt.id} className={styles.prompt} type="button" onClick={() => onTry(prompt)}>
                <span className={styles.dot} aria-hidden="true" />
                {prompt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
