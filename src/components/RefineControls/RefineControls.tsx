import type { FormEvent } from 'react'
import type { Command } from '../../constants'
import styles from './RefineControls.module.css'

interface RefineControlsProps {
  appName: string
  commands: Command[]
  text: string
  disabled: boolean
  onTextChange: (text: string) => void
  onCommand: (command: Command) => void
  onSubmitText: () => void
}

export function RefineControls({
  appName,
  commands,
  text,
  disabled,
  onTextChange,
  onCommand,
  onSubmitText,
}: RefineControlsProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!disabled && text.trim() !== '') onSubmitText()
  }

  return (
    <div className={styles.refine}>
      <h3 className={styles.label}>Refine this suggestion</h3>
      <div className={styles.chips}>
        {commands.map((command) => (
          <button
            key={command.id}
            className={styles.chip}
            type="button"
            disabled={disabled}
            onClick={() => onCommand(command)}
          >
            <span className={styles.dot} aria-hidden="true" />
            {command.label}
          </button>
        ))}
      </div>
      <form className={styles.form} onSubmit={submit}>
        <label className="visually-hidden" htmlFor="refine-text">
          Tell {appName} what to change
        </label>
        <input
          id="refine-text"
          className={styles.input}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={`Or tell ${appName} what to change…`}
          autoComplete="off"
        />
        <button className={styles.send} type="submit" aria-label="Send" disabled={disabled || text.trim() === ''}>
          <span aria-hidden="true">↵</span>
        </button>
      </form>
    </div>
  )
}
