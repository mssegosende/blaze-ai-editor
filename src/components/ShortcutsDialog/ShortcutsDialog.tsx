import type { KeyboardEvent } from 'react'
import type { ShortcutRow } from '../../constants'
import { ShortcutList } from '../ShortcutList/ShortcutList'
import styles from './ShortcutsDialog.module.css'

interface ShortcutsDialogProps {
  rows: ShortcutRow[]
  onClose: () => void
}

export function ShortcutsDialog({ rows, onClose }: ShortcutsDialogProps) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'Tab') {
      // "Got it" is the only control, so focus stays on it.
      event.preventDefault()
    }
  }

  return (
    <div
      className={styles.scrim}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDown={onKeyDown}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
        <p className={styles.label}>Keyboard</p>
        <h2 id="shortcuts-title" className={styles.title}>
          Shortcuts
        </h2>
        <ShortcutList rows={rows} />
        <button className={styles.done} type="button" onClick={onClose} autoFocus>
          Got it
        </button>
      </div>
    </div>
  )
}
