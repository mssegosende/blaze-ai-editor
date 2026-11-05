import type { FormEvent, KeyboardEvent } from 'react'
import type { Command } from '../../constants'
import styles from './CommandPalette.module.css'

interface CommandPaletteProps {
  appName: string
  /** What a command would act on. Null only when the document has no text. */
  targetTitle: string | null
  commands: Command[]
  index: number
  askText: string
  onAskTextChange: (text: string) => void
  onMove: (key: string) => void
  onHover: (index: number) => void
  onRun: (command: Command) => void
  onAsk: () => void
  onClose: () => void
}

export function CommandPalette({
  appName,
  targetTitle,
  commands,
  index,
  askText,
  onAskTextChange,
  onMove,
  onHover,
  onRun,
  onAsk,
  onClose,
}: CommandPaletteProps) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      onMove(event.key)
    } else if (event.key === 'Tab') {
      // Focus stays inside the palette.
      event.preventDefault()
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (askText.trim() !== '') {
      onAsk()
      return
    }
    const command = commands[index]
    if (command) onRun(command)
  }

  return (
    <div
      className={styles.palette}
      role="dialog"
      aria-modal="true"
      aria-label="Commands"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDown={onKeyDown}
    >
      <div className={styles.box}>
        {targetTitle === null ? (
          <>
            <div className={styles.top}>
              <span className={styles.target}>/ commands</span>
              <button className={styles.close} type="button" onClick={onClose} autoFocus>
                Close
              </button>
            </div>
            <p className={styles.nothing}>Write something first, then ask</p>
          </>
        ) : (
          <>
            <div className={styles.top}>
              <span className={styles.target}>/ commands · on “{targetTitle}”</span>
              <span className={styles.keys}>↑ ↓ to move · ↵ to run · esc to close</span>
              <button className={styles.close} type="button" tabIndex={-1} onClick={onClose}>
                Close
              </button>
            </div>

            <form onSubmit={submit}>
              <label className="visually-hidden" htmlFor="palette-ask">
                Ask {appName} something else
              </label>
              <input
                id="palette-ask"
                className={styles.input}
                value={askText}
                onChange={(event) => onAskTextChange(event.target.value)}
                placeholder={`Or ask ${appName} to…`}
                autoComplete="off"
                autoFocus
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-commands"
                aria-activedescendant={`palette-command-${index}`}
              />
            </form>

            <div id="palette-commands" className={styles.list} role="listbox" aria-label="Commands">
              {commands.map((command, position) => (
                <button
                  key={command.id}
                  id={`palette-command-${position}`}
                  className={position === index ? styles.itemActive : styles.item}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={position === index}
                  onMouseMove={() => onHover(position)}
                  onClick={() => onRun(command)}
                >
                  <span className={styles.dot} aria-hidden="true" />
                  {command.label}
                  {position === index && (
                    <span className={styles.enter} aria-hidden="true">
                      ↵
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
