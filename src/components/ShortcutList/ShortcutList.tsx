import type { ShortcutRow } from '../../constants'
import styles from './ShortcutList.module.css'

interface ShortcutListProps {
  rows: ShortcutRow[]
}

export function ShortcutList({ rows }: ShortcutListProps) {
  return (
    <dl className={styles.list}>
      {rows.map((row) => (
        <div key={row.keys} className={styles.row}>
          <dt>
            <kbd className={styles.key}>{row.keys}</kbd>
          </dt>
          <dd>{row.description}</dd>
        </div>
      ))}
    </dl>
  )
}
