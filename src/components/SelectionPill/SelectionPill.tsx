import type { FormEvent, MouseEvent } from 'react'
import type { Command } from '../../constants'
import type { PillPosition, PillView } from '../../hooks/useSelectionPill'
import styles from './SelectionPill.module.css'

interface SelectionPillProps {
  appName: string
  position: PillPosition
  view: PillView
  commands: Command[]
  toneCommands: Command[]
  askText: string
  onViewChange: (view: PillView) => void
  onAskTextChange: (text: string) => void
  onCommand: (command: Command) => void
  onAsk: () => void
}

/** Keeps the editor's selection while a button is pressed. */
function keepSelection(event: MouseEvent) {
  event.preventDefault()
}

export function SelectionPill({
  appName,
  position,
  view,
  commands,
  toneCommands,
  askText,
  onViewChange,
  onAskTextChange,
  onCommand,
  onAsk,
}: SelectionPillProps) {
  const submitAsk = (event: FormEvent) => {
    event.preventDefault()
    if (askText.trim() !== '') onAsk()
  }

  return (
    <div
      className={styles.pill}
      style={{ left: position.left, top: position.top }}
      role="toolbar"
      aria-label={`Ask ${appName}`}
    >
      {view === 'ask' ? (
        <form className={styles.form} onSubmit={submitAsk}>
          <label className="visually-hidden" htmlFor="pill-ask">
            What should {appName} do with this text?
          </label>
          <input
            id="pill-ask"
            className={styles.input}
            value={askText}
            onChange={(event) => onAskTextChange(event.target.value)}
            placeholder={`Ask ${appName} to…`}
            autoComplete="off"
            autoFocus
          />
          <button className={styles.button} type="submit" aria-label="Send" disabled={askText.trim() === ''}>
            <span aria-hidden="true">↵</span>
          </button>
        </form>
      ) : view === 'tone' ? (
        toneCommands.map((command) => (
          <button
            key={command.id}
            className={styles.button}
            type="button"
            onMouseDown={keepSelection}
            onClick={() => onCommand(command)}
          >
            {command.label}
          </button>
        ))
      ) : (
        <>
          <button
            className={styles.button}
            type="button"
            aria-expanded={false}
            onMouseDown={keepSelection}
            onClick={() => onViewChange('ask')}
          >
            <span aria-hidden="true">✦</span> Ask
          </button>
          <span className={styles.separator} aria-hidden="true" />
          {commands.map((command) => (
            <button
              key={command.id}
              className={styles.button}
              type="button"
              onMouseDown={keepSelection}
              onClick={() => onCommand(command)}
            >
              {command.label}
            </button>
          ))}
          <button
            className={styles.button}
            type="button"
            aria-expanded={false}
            onMouseDown={keepSelection}
            onClick={() => onViewChange('tone')}
          >
            Tone <span aria-hidden="true">▾</span>
          </button>
        </>
      )}
    </div>
  )
}
