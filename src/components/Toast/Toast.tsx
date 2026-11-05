import type { Notice } from '../../hooks/useNotice'
import styles from './Toast.module.css'

interface ToastProps {
  notice: Notice | null
  onUndo: () => void
}

/** Always mounted, so screen readers announce the message when it appears. */
export function Toast({ notice, onUndo }: ToastProps) {
  return (
    <div className={notice ? styles.toast : styles.hidden} role="status">
      {notice && (
        <>
          {notice.message}
          {notice.undoable && (
            <button className={styles.undo} type="button" onClick={onUndo}>
              Undo
            </button>
          )}
        </>
      )}
    </div>
  )
}
