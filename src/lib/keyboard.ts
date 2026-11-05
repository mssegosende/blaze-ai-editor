export type KeyAction = 'palette' | 'shortcuts' | 'acceptAll' | 'dismiss' | 'undo' | 'leaveInput' | null

export interface KeyContext {
  key: string
  /** Ctrl, or Cmd on a Mac. */
  mod: boolean
  focus: 'editor' | 'input' | 'other'
  selectionEmpty: boolean
  onEmptyLine: boolean
  /** A palette or dialog is open and handles its own keys. */
  overlayOpen: boolean
  reviewing: boolean
}

/**
 * What a key press means. Pure, because the rule that matters is easy to break:
 * a slash in the middle of a sentence has to stay a slash.
 */
export function keyAction({ key, mod, focus, selectionEmpty, onEmptyLine, overlayOpen, reviewing }: KeyContext): KeyAction {
  if (overlayOpen) return null

  if (key === 'Escape') return focus === 'input' ? 'leaveInput' : 'dismiss'

  if (mod && key === 'Enter') return reviewing && focus !== 'input' ? 'acceptAll' : null

  // In the editor and in inputs, undo already belongs to them.
  if (mod && key.toLowerCase() === 'z') return focus === 'other' ? 'undo' : null

  if (mod) return null

  if (key === '/') {
    if (focus === 'input') return null
    if (focus === 'other') return 'palette'
    return !selectionEmpty || onEmptyLine ? 'palette' : null
  }

  if (key === '?') return focus === 'other' ? 'shortcuts' : null

  return null
}

/** The palette's arrows wrap around. Any other key leaves the highlight alone. */
export function movePaletteIndex(index: number, total: number, key: string): number {
  if (key === 'ArrowDown') return (index + 1) % total
  if (key === 'ArrowUp') return (index - 1 + total) % total
  return index
}
