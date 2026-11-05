import type { Editor } from '@tiptap/core'
import { EditorContent } from '@tiptap/react'
import styles from './EditorPane.module.css'

interface EditorPaneProps {
  editor: Editor
  fileName: string
}

export function EditorPane({ editor, fileName }: EditorPaneProps) {
  return (
    <main className={styles.column}>
      <div className={styles.top}>
        <span>02 · Write</span>
        <span>Markdown</span>
      </div>
      <article className={styles.sheet}>
        <p className={styles.fileName}>{fileName}</p>
        <EditorContent editor={editor} />
      </article>
    </main>
  )
}
