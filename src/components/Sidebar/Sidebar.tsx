import styles from './Sidebar.module.css'

interface SidebarProps {
  appName: string
  documentTitle: string
  documentSubtitle: string
  onCommands: () => void
  onShortcuts: () => void
}

export function Sidebar({ appName, documentTitle, documentSubtitle, onCommands, onShortcuts }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <p className={styles.logo}>{appName}</p>
      <h2 className={styles.label}>01 · Document</h2>
      <div className={styles.document}>
        {documentTitle}
        <span className={styles.subtitle}>{documentSubtitle}</span>
      </div>
      <div className={styles.buttons}>
        <button className={styles.button} type="button" onClick={onCommands}>
          Commands <span className={styles.key}>/</span>
        </button>
        <button className={styles.button} type="button" onClick={onShortcuts}>
          Shortcuts <span className={styles.key}>?</span>
        </button>
      </div>
    </aside>
  )
}
