import styles from './Sidebar.module.css'

interface SidebarProps {
  appName: string
  documentTitle: string
  documentSubtitle: string
}

export function Sidebar({ appName, documentTitle, documentSubtitle }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <p className={styles.logo}>{appName}</p>
      <h2 className={styles.label}>01 · Document</h2>
      <div className={styles.document}>
        {documentTitle}
        <span className={styles.subtitle}>{documentSubtitle}</span>
      </div>
    </aside>
  )
}
