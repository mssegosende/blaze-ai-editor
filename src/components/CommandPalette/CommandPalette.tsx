import type { FormEvent, KeyboardEvent } from 'react'
import type { Command } from '../../constants'
import styles from './CommandPalette.module.css'

interface CommandPaletteProps {
  appName: string
  /** What a command would act on, or null if there's nothing to act on. */
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
  const available = targetTitle !== null

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      onMove(event.key)
    } else if (event.key === 'Tab') {
      // The field drives the list, so focus stays inside the palette.
      event.preventDefault()
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!available) return
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
        <div className={styles.top}>
          <span>
            / commands ·{' '}
            {available ? `on “${targetTitle}”` : 'select text, or put the cursor in a section with text'}
          </span>
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
            // Read-only, not disabled: a disabled field can't hold focus, and
            // then Esc would never reach the palette to close it.
            readOnly={!available}
            aria-disabled={!available}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-commands"
            aria-activedescendant={available ? `palette-command-${index}` : undefined}
          />
        </form>

        <div id="palette-commands" className={styles.list} role="listbox" aria-label="Commands">
          {commands.map((command, position) => (
            <button
              key={command.id}
              id={`palette-command-${position}`}
              className={position === index && available ? styles.itemActive : styles.item}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={position === index}
              disabled={!available}
              onMouseMove={() => onHover(position)}
              onClick={() => onRun(command)}
            >
              <span className={styles.dot} aria-hidden="true" />
              {command.label}
              {position === index && available && (
                <span className={styles.enter} aria-hidden="true">
                  ↵
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
