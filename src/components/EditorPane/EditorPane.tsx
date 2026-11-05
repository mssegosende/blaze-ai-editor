import type { Editor } from '@tiptap/core'
import { EditorContent } from '@tiptap/react'
import styles from './EditorPane.module.css'

interface EditorPaneProps {
  editor: Editor
  fileName: string
  showHint: boolean
  /** Only ever visible under 1024px, where the prompts are below the document. */
  showTryButton: boolean
  onTry: () => void
}

export function EditorPane({ editor, fileName, showHint, showTryButton, onTry }: EditorPaneProps) {
  return (
    <main className={styles.column}>
      <div className={styles.top}>
        <span>02 · Write</span>
        <span>Markdown</span>
      </div>
      {(showHint || showTryButton) && (
        <div className={styles.intro}>
          {showHint && (
            <p className={styles.hint}>
              <span className={styles.hintDot} aria-hidden="true" />
              <span>
                Select any sentence to ask for a rewrite
                <span className={styles.keyHint}>
                  , or press <kbd className={styles.key}>/</kbd>
                </span>
              </span>
            </p>
          )}
          {showTryButton && (
            <button className={styles.tryButton} type="button" onClick={onTry}>
              Try a suggestion
            </button>
          )}
        </div>
      )}
      <article className={styles.sheet}>
        <p className={styles.fileName}>{fileName}</p>
        <EditorContent editor={editor} />
      </article>
    </main>
  )
}
