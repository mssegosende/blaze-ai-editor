import type { Editor } from '@tiptap/core'
import { EditorContent } from '@tiptap/react'
import styles from './EditorPane.module.css'

interface EditorPaneProps {
  editor: Editor
  fileName: string
  showHint: boolean
}

export function EditorPane({ editor, fileName, showHint }: EditorPaneProps) {
  return (
    <main className={styles.column}>
      <div className={styles.top}>
        <span>02 · Write</span>
        <span>Markdown</span>
      </div>
      {showHint && (
        <p className={styles.hint}>
          <span className={styles.hintDot} aria-hidden="true" />
          Select any sentence to ask for a rewrite, or press <kbd className={styles.key}>/</kbd>
        </p>
      )}
      <article className={styles.sheet}>
        <p className={styles.fileName}>{fileName}</p>
        <EditorContent editor={editor} />
      </article>
    </main>
  )
}
